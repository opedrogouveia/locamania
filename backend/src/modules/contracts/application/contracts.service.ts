import { Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  buildRentSchedule,
  diffDays,
  firstName,
  formatBRL,
  formatYmd,
  fromCents,
  PERIODICITY_UNIT,
  Permission,
  rentalBlockers,
  toCents,
  whatsappLink,
  type AdjustRentRequest,
  type ContractDto,
  type ContractListItemDto,
  type CreateContractRequest,
  type DeliverContractRequest,
  type ListContractsQuery,
  type PaginatedResponse,
  type ReturnContractRequest,
  type SendContractResponse,
  type UpdateContractRequest,
} from '@locamania/shared';

import { hasPermission, type Principal, type StaffPrincipal } from '../../../shared/auth/principal';
import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso, toDecimalInput } from '../../../shared/http/mappers';
import { paginated, pageParams, searchTerm } from '../../../shared/http/pagination';
import { MailService } from '../../../shared/mail/mail.service';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { ClockService } from '../../../shared/time/clock.service';
import { CustomerStatusService } from '../../customers/application/customer-status.service';
import { CUSTOMERS_REPOSITORY, type CustomersRepository } from '../../customers/domain/customers.ports';
import { cnhAllowsMotorcycle } from '../../customers/domain/customer-rules';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { assertContractDates, assertPositiveMoney, rentChargeDescription } from '../domain/contract-rules';
import {
  CONTRACTS_REPOSITORY,
  type ContractChargeStats,
  type ContractRecord,
  type ContractsRepository,
  type NewChargeData,
} from '../domain/contracts.ports';
import { ContractDocumentService } from './contract-document.service';

const EMPTY_STATS: ContractChargeStats = { nextDueDate: null, overdueCount: 0, paidCents: 0, pendingCents: 0, overdueCents: 0 };

@Injectable()
export class ContractsService {
  constructor(
    @Inject(CONTRACTS_REPOSITORY) private readonly repo: ContractsRepository,
    @Inject(CUSTOMERS_REPOSITORY) private readonly customers: CustomersRepository,
    private readonly documents: ContractDocumentService,
    private readonly params: ParametersService,
    private readonly clock: ClockService,
    private readonly catalog: CatalogLabelsService,
    private readonly customerStatus: CustomerStatusService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  // ───────────────────────────── Leitura ─────────────────────────────

  async list(query: ListContractsQuery, actor: Principal): Promise<PaginatedResponse<ContractListItemDto>> {
    const p = pageParams(query);
    const today = this.clock.today();
    const { items, total } = await this.repo.list({
      skip: p.skip,
      take: p.take,
      search: searchTerm(query.search),
      status: query.status,
      customerId: query.customerId,
      motorcycleId: query.motorcycleId,
      endingBefore: query.endingWithinDays ? addDays(today, query.endingWithinDays) : undefined,
    });
    const rules = await this.params.chargeRules();
    const stats = await this.repo.chargeStats(items.map((c) => c.id), today, rules.graceDays);
    const label = await this.catalog.resolver();
    return paginated(items.map((c) => this.listItem(c, stats.get(c.id) ?? EMPTY_STATS, actor, label)), total, p);
  }

  async get(id: string, actor: Principal): Promise<ContractDto> {
    const c = await this.find(id);
    const rules = await this.params.chargeRules();
    const stats = (await this.repo.chargeStats([id], this.clock.today(), rules.graceDays)).get(id) ?? EMPTY_STATS;
    const label = await this.catalog.resolver();
    const canMoney = hasPermission(actor, Permission.PAYMENTS_VIEW);
    const phone = c.customer.whatsapp ?? c.customer.phone;
    return {
      ...this.listItem(c, stats, actor, label),
      firstDueDate: c.firstDueDate,
      depositAmount: canMoney ? c.depositAmount : null,
      initialKm: c.initialKm,
      rules: c.rules,
      notes: c.notes,
      signatureMethod: c.signatureMethod,
      signedAt: iso(c.signedAt),
      signatureIp: c.signatureIp,
      documentHash: c.documentHash,
      sentAt: iso(c.sentAt),
      deliveredAt: iso(c.deliveredAt),
      endedAt: iso(c.endedAt),
      cancelledAt: iso(c.cancelledAt),
      cancelReason: c.cancelReason,
      returnInspection: c.returnInspection
        ? {
            ...c.returnInspection,
            kmDriven: c.returnInspection.finalKm - (c.initialKm ?? c.returnInspection.finalKm),
            nextMotorcycleStatus: c.returnInspection.nextMotorcycleStatus as 'AVAILABLE' | 'MAINTENANCE',
            depositRetainedAmount: canMoney ? c.returnInspection.depositRetainedAmount : null,
            createdBy: c.returnInspection.createdByName,
            createdAt: iso(c.returnInspection.createdAt),
          }
        : null,
      totals: canMoney
        ? { paid: fromCents(stats.paidCents), pending: fromCents(stats.pendingCents), overdue: fromCents(stats.overdueCents) }
        : null,
      createdBy: c.createdByName,
      customerPhone: c.customer.phone,
      customerWhatsapp: c.customer.whatsapp,
      customerEmail: c.customer.email,
      customerPortalEnabled: c.customer.portalEnabled,
      whatsappLink: whatsappLink(
        phone,
        `Olá, ${firstName(c.customer.name)}! Aqui é da Locamania. Seu contrato ${c.number} está disponível no aplicativo para você conferir e aceitar.`,
      ),
      updatedAt: iso(c.updatedAt),
    };
  }

  /** Prévia do texto (para a tela "ver contrato" sem baixar o PDF). */
  async text(id: string): Promise<{ text: string; hash: string; frozen: boolean }> {
    const c = await this.find(id);
    const r = await this.documents.ensureText(c);
    return { ...r, frozen: c.signatureStatus === 'SIGNED' };
  }

  async pdf(id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const c = await this.find(id);
    return { buffer: await this.documents.pdf(c), fileName: `${c.number}.pdf` };
  }

  // ───────────────────────────── Novo aluguel (§10, §39) ─────────────────────────────

  async create(input: CreateContractRequest, actor: StaffPrincipal): Promise<ContractDto> {
    const today = this.clock.today();
    const customer = await this.customers.findById(input.customerId);
    if (!customer) throw new NotFoundError('Cliente não encontrado.');
    const blockers = rentalBlockers({ status: customer.status, cnhExpiresAt: customer.cnhExpiresAt, today });
    if (!cnhAllowsMotorcycle(customer.cnhCategory)) blockers.push('A CNH do cliente não é de categoria A.');
    if (blockers.length) throw new ValidationError(`Não é possível alugar para este cliente: ${blockers.join(' ')}`, 'RENTAL_BLOCKED');
    if (await this.repo.customerOpenContract(input.customerId)) {
      throw new ValidationError('Este cliente já tem um contrato ativo ou em rascunho.', 'CUSTOMER_HAS_CONTRACT');
    }

    await this.assertMotorcycleAvailable(input.motorcycleId);
    const firstDueDate = input.firstDueDate ?? input.startDate;
    assertContractDates({ startDate: input.startDate, endDate: input.endDate, firstDueDate, periodicity: input.periodicity, today });
    const rentAmount = toDecimalInput(input.rentAmount);
    assertPositiveMoney(rentAmount, 'o valor do aluguel');
    const depositAmount = toDecimalInput(input.depositAmount ?? null);

    const created = await this.repo.createDraft({
      customerId: input.customerId,
      motorcycleId: input.motorcycleId,
      startDate: input.startDate,
      endDate: input.endDate,
      firstDueDate,
      periodicity: input.periodicity,
      rentAmount: rentAmount!,
      depositAmount: depositAmount && Number(depositAmount) > 0 ? depositAmount : null,
      rules: input.rules?.trim() || null,
      notes: input.notes?.trim() || null,
      createdById: actor.id,
    });
    return this.get(created.id, actor);
  }

  async update(id: string, input: UpdateContractRequest, actor: StaffPrincipal): Promise<ContractDto> {
    const c = await this.find(id);
    if (c.status !== 'DRAFT') throw new ValidationError('Só dá para editar o contrato enquanto é rascunho. Depois, use reajuste ou prorrogação.');
    if (c.signatureStatus === 'SIGNED') throw new ValidationError('O contrato já foi assinado. Cancele e crie outro para mudar as condições.');
    if (input.motorcycleId && input.motorcycleId !== c.motorcycle.id) await this.assertMotorcycleAvailable(input.motorcycleId);
    const startDate = input.startDate ?? c.startDate;
    const endDate = input.endDate ?? c.endDate;
    const periodicity = input.periodicity ?? c.periodicity;
    const firstDueDate = input.firstDueDate ?? (input.startDate ? input.startDate : c.firstDueDate);
    assertContractDates({ startDate, endDate, firstDueDate, periodicity, today: this.clock.today() });
    const rentAmount = input.rentAmount !== undefined ? toDecimalInput(input.rentAmount) : undefined;
    if (rentAmount !== undefined) assertPositiveMoney(rentAmount, 'o valor do aluguel');
    await this.repo.updateDraft(
      id,
      {
        motorcycleId: input.motorcycleId,
        startDate: input.startDate,
        endDate: input.endDate,
        firstDueDate,
        periodicity: input.periodicity,
        rentAmount: rentAmount ?? undefined,
        depositAmount: input.depositAmount !== undefined ? toDecimalInput(input.depositAmount) : undefined,
        rules: input.rules !== undefined ? input.rules?.trim() || null : undefined,
        notes: input.notes !== undefined ? input.notes?.trim() || null : undefined,
      },
      c.motorcycle.id,
    );
    return this.get(id, actor);
  }

  async cancel(id: string, reason: string, actor: StaffPrincipal): Promise<ContractDto> {
    const c = await this.find(id);
    if (c.status !== 'DRAFT') {
      throw new ValidationError('Contrato ativo não é cancelado: registre a devolução para encerrá-lo.');
    }
    if (!reason.trim()) throw new ValidationError('Informe o motivo do cancelamento.');
    await this.repo.cancelDraft(id, reason.trim(), c.motorcycle.id);
    return this.get(id, actor);
  }

  // ───────────────────────────── Assinatura e envio ─────────────────────────────

  /** Presencial: o contrato impresso foi assinado (o escaneado pode ir junto). */
  async registerSignature(id: string, documentId: string | null, actor: StaffPrincipal): Promise<ContractDto> {
    const c = await this.find(id);
    if (c.status !== 'DRAFT') throw new ValidationError('A assinatura é registrada antes da entrega da moto.');
    if (c.signatureStatus === 'SIGNED') throw new ValidationError('Este contrato já está assinado.');
    await this.documents.ensureText(c);
    await this.repo.registerSignature(id, { method: 'IN_PERSON', ip: null, userAgent: null, documentId });
    return this.get(id, actor);
  }

  /** Aceite eletrônico pelo app (a senha já foi conferida pelo portal). */
  async acceptElectronically(id: string, customerId: string, ip: string | null, userAgent: string | null): Promise<void> {
    const c = await this.find(id);
    if (c.customer.id !== customerId) throw new NotFoundError('Contrato não encontrado.');
    if (c.status !== 'DRAFT' && c.status !== 'ACTIVE') throw new ValidationError('Este contrato não está aberto para aceite.');
    if (c.signatureStatus === 'SIGNED') throw new ValidationError('Este contrato já foi aceito.');
    await this.documents.ensureText(c);
    await this.repo.registerSignature(id, { method: 'ELECTRONIC_ACCEPTANCE', ip, userAgent, documentId: null });
    await this.notifications.notifyStaff({
      type: 'CONTRACT_UPDATED',
      title: `Contrato aceito no app — ${c.customer.name}`,
      body: `${c.number} foi aceito eletronicamente. A moto já pode ser entregue.`,
      severity: 'SUCCESS',
      link: `/admin/contracts/${c.id}`,
      entityType: 'Contract',
      entityId: c.id,
      dedupeKey: `contract:${c.id}:accepted`,
    }, Permission.CONTRACTS_VIEW);
  }

  /** Envia ao cliente: e-mail com o PDF + aviso no app + link do WhatsApp (§10). */
  async send(id: string): Promise<SendContractResponse> {
    const c = await this.find(id);
    const { buffer } = await this.pdf(id);
    let emailSent = false;
    const hello = `Olá, ${firstName(c.customer.name)}!`;
    if (c.customer.email) {
      const r = await this.mail.send({
        to: c.customer.email,
        subject: `Seu contrato ${c.number} — Locamania`,
        title: 'Seu contrato de locação',
        greeting: hello,
        paragraphs: [
          `Segue em anexo o contrato ${c.number}, da moto placa ${c.motorcycle.plate}.`,
          c.customer.portalEnabled
            ? 'Você também pode ver e aceitar o contrato pelo aplicativo, em "Meu contrato".'
            : 'Qualquer dúvida, fale com a Locamania.',
        ],
        attachments: [{ filename: `${c.number}.pdf`, content: buffer, contentType: 'application/pdf' }],
      });
      emailSent = r.sent;
    }
    await this.notifications.notifyCustomer(c.customer.id, {
      type: 'CONTRACT_UPDATED',
      title: c.signatureStatus === 'SIGNED' ? 'Seu contrato' : 'Seu contrato está pronto para aceite',
      body: `O contrato ${c.number} está disponível em "Meu contrato".`,
      severity: 'INFO',
      link: '/app/contract',
      entityType: 'Contract',
      entityId: c.id,
      dedupeKey: `contract:${c.id}:sent:${c.documentHash ?? 'v1'}`,
    });
    await this.repo.markSent(id);
    return {
      emailSent,
      whatsappLink: whatsappLink(
        c.customer.whatsapp ?? c.customer.phone,
        `${hello} Aqui é da Locamania. Seu contrato ${c.number} está disponível${c.customer.portalEnabled ? ' no aplicativo, em "Meu contrato"' : ''}. Qualquer dúvida, é só chamar.`,
      ),
    };
  }

  // ───────────────────────────── Entrega (§39 etapas 9–13) ─────────────────────────────

  async deliver(id: string, input: DeliverContractRequest, actor: StaffPrincipal): Promise<ContractDto> {
    const c = await this.find(id);
    if (c.status !== 'DRAFT') throw new ValidationError('Este contrato já foi entregue ou encerrado.');
    if (c.signatureStatus !== 'SIGNED') {
      throw new ValidationError('Registre a assinatura do contrato antes de entregar a moto.', 'NOT_SIGNED');
    }
    if (!['RESERVED', 'AVAILABLE'].includes(c.motorcycle.status)) {
      throw new ValidationError('A moto não está disponível para entrega.');
    }
    if (!Number.isInteger(input.initialKm) || input.initialKm < c.motorcycle.currentKm) {
      throw new ValidationError(`A quilometragem de saída não pode ser menor que a atual da moto (${c.motorcycle.currentKm.toLocaleString('pt-BR')} km).`);
    }

    const schedule = buildRentSchedule({
      startDate: c.startDate,
      endDate: c.endDate,
      firstDueDate: c.firstDueDate,
      periodicity: c.periodicity,
      amount: c.rentAmount,
    });
    const charges: NewChargeData[] = schedule.map((s) => ({
      kind: 'RENT',
      sequence: s.sequence,
      description: rentChargeDescription(s.sequence, c.periodicity, c.number),
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      dueDate: s.dueDate,
      amount: s.amount,
    }));
    if (c.depositAmount && Number(c.depositAmount) > 0) {
      charges.unshift({
        kind: 'DEPOSIT',
        sequence: null,
        description: `Caução — ${c.number}`,
        periodStart: null,
        periodEnd: null,
        dueDate: c.startDate,
        amount: c.depositAmount,
      });
    }
    await this.repo.deliver(id, { initialKm: input.initialKm, notes: input.notes?.trim() || null, userId: actor.id, charges });
    await this.customerStatus.recompute(c.customer.id);
    await this.notifications.notifyCustomer(
      c.customer.id,
      {
        type: 'CONTRACT_UPDATED',
        title: 'Seu aluguel começou',
        body: `Moto ${c.motorcycle.plate} entregue. Próximo pagamento: ${formatBRL(schedule[0]?.amount ?? c.rentAmount)} em ${formatYmd(schedule[0]?.dueDate ?? c.firstDueDate)}.`,
        severity: 'SUCCESS',
        link: '/app',
        entityType: 'Contract',
        entityId: c.id,
        dedupeKey: `contract:${c.id}:delivered`,
      },
      {
        email: {
          subject: 'Seu aluguel começou — Locamania',
          paragraphs: [
            `A moto placa ${c.motorcycle.plate} foi entregue com ${input.initialKm.toLocaleString('pt-BR')} km.`,
            `O aluguel é de ${formatBRL(c.rentAmount)} por ${PERIODICITY_UNIT[c.periodicity]}, até ${formatYmd(c.endDate)}.`,
            'Pelo aplicativo você acompanha os pagamentos, paga pelo PIX e recebe os avisos de manutenção.',
          ],
          button: { label: 'Abrir o aplicativo', path: '/app' },
        },
      },
    );
    return this.get(id, actor);
  }

  // ───────────────────────────── Durante o aluguel ─────────────────────────────

  async adjustRent(id: string, input: AdjustRentRequest, actor: StaffPrincipal): Promise<ContractDto> {
    const c = await this.find(id);
    if (c.status !== 'ACTIVE') throw new ValidationError('Só contratos ativos podem ser reajustados.');
    const amount = toDecimalInput(input.rentAmount);
    assertPositiveMoney(amount, 'o novo valor');
    if (amount === c.rentAmount) throw new ValidationError('O valor informado é igual ao atual.');
    if (input.effectiveFrom < this.clock.today()) throw new ValidationError('O reajuste vale a partir de hoje ou de uma data futura.');
    await this.repo.adjustRent(id, amount!, input.effectiveFrom, c.rentAmount);
    await this.notifications.notifyCustomer(c.customer.id, {
      type: 'CONTRACT_UPDATED',
      title: 'Alteração no valor do aluguel',
      body: `A partir de ${formatYmd(input.effectiveFrom)}, o aluguel passa de ${formatBRL(c.rentAmount)} para ${formatBRL(amount)} por ${PERIODICITY_UNIT[c.periodicity]}.${input.reason ? ` Motivo: ${input.reason}` : ''}`,
      severity: 'INFO',
      link: '/app/payments',
      entityType: 'Contract',
      entityId: c.id,
      dedupeKey: `contract:${c.id}:adjust:${amount}:${input.effectiveFrom}`,
    });
    return this.get(id, actor);
  }

  async extend(id: string, endDate: string, actor: StaffPrincipal): Promise<ContractDto> {
    const c = await this.find(id);
    if (c.status !== 'ACTIVE') throw new ValidationError('Só contratos ativos podem ser prorrogados.');
    if (endDate <= c.endDate) throw new ValidationError('A nova data de término precisa ser depois da atual.');
    if (diffDays(c.startDate, endDate) > 366 * 3) throw new ValidationError('O contrato pode ter no máximo 3 anos.');
    const schedule = buildRentSchedule({ startDate: c.startDate, endDate, firstDueDate: c.firstDueDate, periodicity: c.periodicity, amount: c.rentAmount });
    const existing = await this.repo.existingRentCharges(id);
    const bySeq = new Map(existing.map((e) => [e.sequence, e]));
    const updates: { sequence: number; amount: string; periodEnd: string }[] = [];
    const newCharges: NewChargeData[] = [];
    for (const s of schedule) {
      const current = bySeq.get(s.sequence);
      if (!current) {
        newCharges.push({
          kind: 'RENT',
          sequence: s.sequence,
          description: rentChargeDescription(s.sequence, c.periodicity, c.number),
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
          dueDate: s.dueDate,
          amount: s.amount,
        });
      } else if (current.periodEnd !== s.periodEnd && ['PENDING', 'OVERDUE'].includes(current.status)) {
        // A antiga última parcela era proporcional; agora vira período inteiro.
        updates.push({ sequence: s.sequence, amount: s.amount, periodEnd: s.periodEnd });
      }
    }
    await this.repo.extend(id, endDate, updates, newCharges);
    await this.notifications.notifyCustomer(c.customer.id, {
      type: 'CONTRACT_UPDATED',
      title: 'Seu contrato foi prorrogado',
      body: `O aluguel da moto ${c.motorcycle.plate} agora vai até ${formatYmd(endDate)}.`,
      severity: 'INFO',
      link: '/app/contract',
      entityType: 'Contract',
      entityId: c.id,
      dedupeKey: `contract:${c.id}:extend:${endDate}`,
    });
    return this.get(id, actor);
  }

  // ───────────────────────────── Devolução (§23) ─────────────────────────────

  async returnContract(id: string, input: ReturnContractRequest, actor: StaffPrincipal): Promise<ContractDto> {
    const c = await this.find(id);
    if (c.status !== 'ACTIVE') throw new ValidationError('Só contratos ativos têm devolução.');
    const minKm = Math.max(c.initialKm ?? 0, c.motorcycle.currentKm);
    if (!Number.isInteger(input.finalKm) || input.finalKm < minKm) {
      throw new ValidationError(`A quilometragem final não pode ser menor que ${minKm.toLocaleString('pt-BR')} km.`);
    }
    if (input.returnedAt > this.clock.today()) throw new ValidationError('A data da devolução não pode ser no futuro.');
    if (input.returnedAt < c.startDate) throw new ValidationError('A devolução não pode ser antes do início do contrato.');
    const retained = toDecimalInput(input.depositRetainedAmount ?? null);
    if (input.depositOutcome === 'PARTIALLY_RETAINED' && !(retained && Number(retained) > 0)) {
      throw new ValidationError('Informe quanto da caução foi retido.');
    }
    const depositRetainedAmount =
      input.depositOutcome === 'RETAINED' ? c.depositAmount : input.depositOutcome === 'PARTIALLY_RETAINED' ? retained : null;
    if (depositRetainedAmount && c.depositAmount && toCents(depositRetainedAmount) > toCents(c.depositAmount)) {
      throw new ValidationError('O valor retido não pode ser maior que a caução.');
    }
    const extraCharges: NewChargeData[] = (input.extraCharges ?? []).map((e) => {
      const amount = toDecimalInput(e.amount);
      assertPositiveMoney(amount, 'o valor de cada pendência');
      if (!e.description.trim()) throw new ValidationError('Descreva cada pendência cobrada.');
      return {
        kind: e.kind,
        sequence: null,
        description: `${e.description.trim()} — ${c.number}`,
        periodStart: null,
        periodEnd: null,
        dueDate: e.dueDate ?? input.returnedAt,
        amount: amount!,
      };
    });
    await this.repo.endWithReturn(id, {
      returnedAt: input.returnedAt,
      finalKm: input.finalKm,
      condition: input.condition,
      fuelLevel: input.fuelLevel ?? null,
      damages: input.damages?.trim() || null,
      pendingItems: input.pendingItems?.trim() || null,
      notes: input.notes?.trim() || null,
      nextMotorcycleStatus: input.nextMotorcycleStatus,
      depositOutcome: c.depositAmount ? input.depositOutcome : 'NONE',
      depositRetainedAmount,
      extraCharges,
      userId: actor.id,
    });
    await this.customerStatus.recompute(c.customer.id);
    await this.notifications.notifyCustomer(c.customer.id, {
      type: 'CONTRACT_UPDATED',
      title: 'Contrato encerrado',
      body: `A devolução da moto ${c.motorcycle.plate} foi registrada em ${formatYmd(input.returnedAt)}.${extraCharges.length ? ' Há pendências a pagar em "Pagamentos".' : ' Obrigado por alugar com a Locamania!'}`,
      severity: extraCharges.length ? 'WARNING' : 'INFO',
      link: extraCharges.length ? '/app/payments' : '/app',
      entityType: 'Contract',
      entityId: c.id,
      dedupeKey: `contract:${c.id}:ended`,
    });
    return this.get(id, actor);
  }

  // ───────────────────────────── Auxiliares ─────────────────────────────

  private async find(id: string): Promise<ContractRecord> {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundError('Contrato não encontrado.');
    return c;
  }

  private async assertMotorcycleAvailable(motorcycleId: string): Promise<true> {
    if (await this.repo.motorcycleOpenContract(motorcycleId)) {
      throw new ValidationError('Esta moto já tem um contrato ativo ou em rascunho.', 'MOTORCYCLE_TAKEN');
    }
    return true;
  }

  private listItem(
    c: ContractRecord,
    stats: ContractChargeStats,
    actor: Principal,
    label: Awaited<ReturnType<CatalogLabelsService['resolver']>>,
  ): ContractListItemDto {
    const today = this.clock.today();
    return {
      id: c.id,
      number: c.number,
      status: c.status,
      signatureStatus: c.signatureStatus,
      customer: { id: c.customer.id, label: c.customer.name },
      motorcycle: {
        id: c.motorcycle.id,
        plate: c.motorcycle.plate,
        label: `${label('MOTORCYCLE_BRAND', c.motorcycle.brandCode)} ${label('MOTORCYCLE_MODEL', c.motorcycle.modelCode)}`,
      },
      startDate: c.startDate,
      endDate: c.endDate,
      periodicity: c.periodicity,
      rentAmount: hasPermission(actor, Permission.PAYMENTS_VIEW) ? c.rentAmount : null,
      nextDueDate: stats.nextDueDate,
      overdueCount: stats.overdueCount,
      daysToEnd: c.status === 'ACTIVE' ? diffDays(today, c.endDate) : null,
      createdAt: iso(c.createdAt),
    };
  }
}
