import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  chargeDisplayStatus,
  CHARGE_KIND_LABELS,
  computeLateFees,
  diffDays,
  firstName,
  formatBRL,
  formatCnpj,
  formatCpf,
  formatDateTime,
  formatYmd,
  fromCents,
  instantToYmd,
  ParameterKey,
  PAYMENT_METHOD_LABELS,
  Permission,
  toCents,
  whatsappLink,
  type ChargeDto,
  type ChargeRules,
  type ChargesSummaryDto,
  type CreateChargeRequest,
  type DelinquentCustomerDto,
  type ListChargesQuery,
  type PaginatedResponse,
  type PixPaymentDto,
  type RegisterPaymentRequest,
} from '@locamania/shared';
import * as QRCode from 'qrcode';

import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import type { Principal, StaffPrincipal } from '../../../shared/auth/principal';
import { NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso, toDecimalInput } from '../../../shared/http/mappers';
import { paginated, pageParams, searchTerm } from '../../../shared/http/pagination';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { PdfService } from '../../../shared/pdf/pdf.service';
import { ClockService } from '../../../shared/time/clock.service';
import { CustomerStatusService } from '../../customers/application/customer-status.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { SettingsService } from '../../settings/application/settings.service';
import {
  CHARGES_REPOSITORY,
  PAYMENT_GATEWAY,
  type ChargeRecord,
  type ChargesRepository,
  type PaymentGateway,
} from '../domain/charges.ports';
import { assertPayable, paidOnToInstant, paymentAmounts } from '../domain/payment-rules';

@Injectable()
export class ChargesService {
  private readonly logger = new Logger(ChargesService.name);

  constructor(
    @Inject(CHARGES_REPOSITORY) private readonly repo: ChargesRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly params: ParametersService,
    private readonly clock: ClockService,
    private readonly customerStatus: CustomerStatusService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly catalog: CatalogLabelsService,
    private readonly pdf: PdfService,
  ) {}

  // ───────────────────────────── Leitura ─────────────────────────────

  toDto(c: ChargeRecord, rules: ChargeRules): ChargeDto {
    const today = this.clock.today();
    const display = chargeDisplayStatus(c, today, rules);
    const open = c.status === 'PENDING' || c.status === 'OVERDUE';
    const fees = open ? computeLateFees({ amount: c.amount, dueDate: c.dueDate, today, rules }) : null;
    return {
      id: c.id,
      number: c.number,
      kind: c.kind,
      sequence: c.sequence,
      description: c.description,
      customer: { id: c.customer.id, label: c.customer.name },
      contract: c.contract,
      motorcycle: c.motorcycle,
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
      dueDate: c.dueDate,
      amount: c.amount,
      status: c.status,
      displayStatus: display,
      paidAt: iso(c.paidAt),
      paidAmount: c.paidAmount,
      fineAmount: c.fineAmount,
      interestAmount: c.interestAmount,
      discountAmount: c.discountAmount,
      method: c.method,
      notes: c.notes,
      lateFees: fees && fees.chargeable ? { daysLate: fees.daysLate, fine: fees.fine, interest: fees.interest, total: fees.total } : null,
      receiptDocumentId: c.receiptDocumentId,
      registeredBy: c.registeredByName ?? (c.gatewayPaidAt ? 'PIX automático' : null),
      confirmedByGateway: !!c.gatewayPaidAt,
      createdAt: iso(c.createdAt),
    };
  }

  async list(query: ListChargesQuery): Promise<PaginatedResponse<ChargeDto>> {
    const p = pageParams(query, 25);
    const rules = await this.params.chargeRules();
    const { items, total } = await this.repo.list({ ...query, search: searchTerm(query.search) }, this.clock.today(), rules, p);
    return paginated(items.map((c) => this.toDto(c, rules)), total, p);
  }

  async summary(query: Omit<ListChargesQuery, 'status'>): Promise<ChargesSummaryDto> {
    const rules = await this.params.chargeRules();
    const today = this.clock.today();
    const [byStatus, dueToday] = await Promise.all([
      this.repo.summary({ ...query, search: searchTerm(query.search) }, today, rules),
      this.repo.summary({ ...query, dueFrom: today, dueTo: today }, today, rules),
    ]);
    const map = Object.fromEntries(
      Object.entries(byStatus).map(([k, v]) => [k, { count: v.count, amount: fromCents(v.cents) }]),
    ) as ChargesSummaryDto['byStatus'];
    const todayOpen = { count: dueToday.DUE_SOON.count, cents: dueToday.DUE_SOON.cents };
    return { byStatus: map, dueToday: { count: todayOpen.count, amount: fromCents(todayOpen.cents) } };
  }

  async get(id: string): Promise<ChargeDto> {
    const rules = await this.params.chargeRules();
    return this.toDto(await this.find(id), rules);
  }

  // ───────────────────────────── Baixa manual (§11) ─────────────────────────────

  async registerPayment(id: string, input: RegisterPaymentRequest, actor: StaffPrincipal): Promise<ChargeDto> {
    const c = await this.find(id);
    assertPayable(c.status);
    const today = this.clock.today();
    if (input.paidAt > today) throw new ValidationError('A data do pagamento não pode ser no futuro.');
    const rules = await this.params.chargeRules();
    const amounts = paymentAmounts({
      amount: c.amount,
      dueDate: c.dueDate,
      paidOn: input.paidAt,
      rules,
      fine: input.fineAmount != null ? toDecimalInput(input.fineAmount) : null,
      interest: input.interestAmount != null ? toDecimalInput(input.interestAmount) : null,
      discount: input.discountAmount != null ? toDecimalInput(input.discountAmount) : null,
    });
    const paidAmount = toDecimalInput(input.paidAmount);
    if (!paidAmount || Number(paidAmount) <= 0) throw new ValidationError('Informe o valor pago.');
    await this.repo.markPaid(id, {
      paidAt: paidOnToInstant(input.paidAt, today, this.clock.now()),
      paidAmount,
      fineAmount: amounts.fine,
      interestAmount: amounts.interest,
      discountAmount: amounts.discount,
      method: input.method,
      notes: input.notes?.trim() || null,
      receiptDocumentId: input.receiptDocumentId ?? null,
      registeredById: actor.id,
    });
    await this.afterPayment(c, paidAmount, false);
    return this.get(id);
  }

  async reversePayment(id: string, reason: string): Promise<ChargeDto> {
    const c = await this.find(id);
    if (c.status !== 'PAID') throw new ValidationError('Só um pagamento registrado pode ser estornado.');
    if (!reason.trim()) throw new ValidationError('Informe o motivo do estorno.');
    const rules = await this.params.chargeRules();
    const back = chargeDisplayStatus({ status: 'PENDING', dueDate: c.dueDate }, this.clock.today(), rules) === 'OVERDUE' ? 'OVERDUE' : 'PENDING';
    await this.repo.reverse(id, back, `Estorno: ${reason.trim()}${c.notes ? ` · ${c.notes}` : ''}`);
    await this.customerStatus.recompute(c.customer.id);
    return this.get(id);
  }

  async cancel(id: string, reason: string): Promise<ChargeDto> {
    const c = await this.find(id);
    if (c.status === 'PAID') throw new ValidationError('Cobrança paga não é cancelada: faça o estorno antes.');
    if (c.status === 'CANCELLED') throw new ValidationError('Esta cobrança já está cancelada.');
    if (!reason.trim()) throw new ValidationError('Informe o motivo do cancelamento.');
    await this.repo.cancel(id, reason.trim());
    await this.customerStatus.recompute(c.customer.id);
    return this.get(id);
  }

  /** Cobrança avulsa (multa repassada, avaria, taxa...). */
  async create(input: CreateChargeRequest, occurrenceId?: string | null): Promise<ChargeDto> {
    const amount = toDecimalInput(input.amount);
    if (!amount || Number(amount) <= 0) throw new ValidationError('Informe o valor.');
    if (!input.description.trim()) throw new ValidationError('Descreva a cobrança.');
    const created = await this.repo.create({
      customerId: input.customerId,
      contractId: input.contractId ?? null,
      motorcycleId: input.motorcycleId ?? null,
      occurrenceId: occurrenceId ?? null,
      kind: input.kind,
      description: input.description.trim(),
      dueDate: input.dueDate,
      amount,
    });
    await this.notifications.notifyCustomer(created.customer.id, {
      type: 'CONTRACT_UPDATED',
      title: `Nova cobrança: ${CHARGE_KIND_LABELS[input.kind].toLowerCase()}`,
      body: `${input.description.trim()} — ${formatBRL(amount)}, vencimento ${formatYmd(input.dueDate)}.`,
      severity: 'INFO',
      link: '/app/payments',
      entityType: 'Charge',
      entityId: created.id,
      dedupeKey: `charge:${created.id}:created`,
    });
    await this.customerStatus.recompute(created.customer.id);
    return this.get(created.id);
  }

  // ───────────────────────────── Inadimplência (§14) ─────────────────────────────

  async delinquents(): Promise<DelinquentCustomerDto[]> {
    const today = this.clock.today();
    const rules = await this.params.chargeRules();
    const rows = await this.repo.delinquents(today, rules.graceDays);
    const info = await this.repo.customersInfo(rows.map((r) => r.customerId));
    const label = await this.catalog.resolver();
    const out: DelinquentCustomerDto[] = [];
    for (const r of rows) {
      const c = info.get(r.customerId);
      if (!c) continue;
      const cents = r.charges.reduce((a, ch) => a + toCents(ch.amount), 0);
      const withFees = r.charges.reduce(
        (a, ch) => a + toCents(computeLateFees({ amount: ch.amount, dueDate: ch.dueDate, today, rules }).total),
        0,
      );
      const oldest = r.charges[0]!.dueDate;
      const message =
        `Olá, ${firstName(c.name)}! Aqui é da Locamania. Identificamos ${r.charges.length === 1 ? '1 pagamento' : `${r.charges.length} pagamentos`} em atraso, ` +
        `total de ${formatBRL(fromCents(withFees))} com encargos. Você pode pagar pelo PIX no aplicativo, em "Pagamentos". Qualquer dúvida, estamos à disposição.`;
      out.push({
        customer: { id: r.customerId, name: c.name, phone: c.phone, whatsapp: c.whatsapp, status: c.status, inCollection: c.inCollection },
        motorcycle: c.motorcycle
          ? { id: c.motorcycle.id, plate: c.motorcycle.plate, label: `${label('MOTORCYCLE_BRAND', c.motorcycle.brandCode)} ${label('MOTORCYCLE_MODEL', c.motorcycle.modelCode)}` }
          : null,
        overdueCount: r.charges.length,
        overdueAmount: fromCents(cents),
        totalWithFees: fromCents(withFees),
        oldestDueDate: oldest,
        daysLate: diffDays(oldest, today),
        whatsappLink: whatsappLink(c.whatsapp ?? c.phone, message),
      });
    }
    return out.sort((a, b) => b.daysLate - a.daysLate);
  }

  // ───────────────────────────── Recibo ─────────────────────────────

  async receiptPdf(id: string, viewer: Principal): Promise<{ buffer: Buffer; fileName: string }> {
    const c = await this.find(id);
    if (viewer.kind === 'customer' && viewer.id !== c.customer.id) throw new NotFoundError('Cobrança não encontrada.');
    if (c.status !== 'PAID') throw new ValidationError('O recibo sai depois do pagamento registrado.');
    const company = await this.settings.company();
    const doc = this.pdf.create();
    doc.header({
      companyName: company.tradeName,
      companyLine: [company.legalName, company.cnpj ? `CNPJ ${formatCnpj(company.cnpj)}` : null].filter(Boolean).join(' · '),
      title: 'Recibo de pagamento',
      subtitle: `${c.number} · pago em ${formatDateTime(c.paidAt)}`,
    });
    doc.paragraph(
      `Recebemos de ${c.customer.name}, CPF ${formatCpf(c.customer.cpf)}, a importância de ${formatBRL(c.paidAmount)} referente a: ${c.description}.`,
      { size: 11 },
    );
    doc.keyValues([
      ['Cobrança', c.number],
      ['Contrato', c.contract?.number ?? '—'],
      ['Vencimento', formatYmd(c.dueDate)],
      ['Pago em', formatDateTime(c.paidAt)],
      ['Valor', formatBRL(c.amount)],
      ['Multa', formatBRL(c.fineAmount ?? '0')],
      ['Juros', formatBRL(c.interestAmount ?? '0')],
      ['Desconto', formatBRL(c.discountAmount ?? '0')],
      ['Total pago', formatBRL(c.paidAmount)],
      ['Forma de pagamento', c.method ? PAYMENT_METHOD_LABELS[c.method] : '—'],
    ]);
    doc.paragraph(c.gatewayPaidAt ? 'Pagamento confirmado automaticamente pelo gateway de pagamento.' : `Registrado por ${c.registeredByName ?? 'Locamania'}.`, {
      muted: true,
      size: 9,
    });
    return { buffer: await doc.finish(`${company.tradeName} · recibo ${c.number}`), fileName: `recibo-${c.number}.pdf` };
  }

  // ───────────────────────────── PIX pelo app (§13) ─────────────────────────────

  async createPix(chargeId: string, customerId: string): Promise<PixPaymentDto> {
    const c = await this.find(chargeId);
    if (c.customer.id !== customerId) throw new NotFoundError('Cobrança não encontrada.');
    assertPayable(c.status);
    if (!this.gateway.enabled) throw new ValidationError('O pagamento pelo app ainda não está disponível. Fale com a Locamania.');
    const rules = await this.params.chargeRules();
    const amount = computeLateFees({ amount: c.amount, dueDate: c.dueDate, today: this.clock.today(), rules }).total;

    let code = c.gatewayPixCode;
    let gatewayId = c.gatewayChargeId;
    let expiresAt = c.gatewayExpiresAt;
    // Reaproveita o PIX ainda válido e do mesmo valor (o cliente abre a tela várias vezes).
    const stillValid = code && gatewayId && expiresAt && expiresAt.getTime() > Date.now() + 60_000 && code.includes(`54${String(Number(amount).toFixed(2).length).padStart(2, '0')}${Number(amount).toFixed(2)}`);
    if (!stillValid) {
      const pix = await this.gateway.createPix({
        chargeNumber: c.number,
        amount,
        description: c.description,
        payer: { name: c.customer.name, cpf: c.customer.cpf, email: c.customer.email },
      });
      await this.repo.setGateway(c.id, { provider: this.gateway.provider, gatewayChargeId: pix.gatewayChargeId, pixCode: pix.pixCode, expiresAt: pix.expiresAt });
      code = pix.pixCode;
      gatewayId = pix.gatewayChargeId;
      expiresAt = pix.expiresAt;
    }
    return {
      chargeId: c.id,
      provider: this.gateway.provider,
      amount,
      pixCode: code!,
      qrCodeDataUrl: await QRCode.toDataURL(code!, { margin: 1, width: 320, errorCorrectionLevel: 'M' }),
      expiresAt: expiresAt!.toISOString(),
      sandbox: this.gateway.sandbox,
    };
  }

  /** Só em sandbox: dispara o webhook assinado como o gateway faria. */
  async simulatePixPayment(chargeId: string, customerId?: string): Promise<ChargeDto> {
    if (!this.gateway.sandbox || !this.gateway.simulatePayment) throw new ValidationError('Simulação disponível só no ambiente de testes.');
    let c = await this.find(chargeId);
    if (customerId && c.customer.id !== customerId) throw new NotFoundError('Cobrança não encontrada.');
    if (!c.gatewayChargeId) {
      await this.createPix(chargeId, c.customer.id);
      c = await this.find(chargeId);
    }
    const rules = await this.params.chargeRules();
    const amount = computeLateFees({ amount: c.amount, dueDate: c.dueDate, today: this.clock.today(), rules }).total;
    const { signature, body } = this.gateway.simulatePayment(c.gatewayChargeId!, amount);
    await this.handleWebhook(signature, body);
    return this.get(chargeId);
  }

  /**
   * Webhook do gateway: confere a assinatura, grava o evento (idempotente) e dá
   * a baixa. O mesmo evento chegando duas vezes não paga duas vezes.
   */
  async handleWebhook(signature: string | undefined, body: unknown): Promise<{ ok: boolean }> {
    const { valid, event } = this.gateway.parseWebhook(signature, body);
    const eventId = (body as { eventId?: string })?.eventId ?? `invalid_${Date.now()}`;
    const charge = event ? await this.repo.findByGatewayId(event.gatewayChargeId) : null;
    const recorded = await this.repo.recordGatewayEvent({
      provider: this.gateway.provider,
      eventId,
      type: event?.type ?? 'UNKNOWN',
      payload: body,
      signatureValid: valid,
      chargeId: charge?.id ?? null,
    });
    if (!valid) {
      await this.repo.finishGatewayEvent(recorded.id, 'Assinatura inválida');
      throw new ValidationError('Assinatura do webhook inválida.');
    }
    if (!recorded.isNew) return { ok: true };
    if (!event || event.type !== 'PAYMENT_CONFIRMED') {
      await this.repo.finishGatewayEvent(recorded.id, event ? null : 'Evento não reconhecido');
      return { ok: true };
    }
    if (!charge) {
      await this.repo.finishGatewayEvent(recorded.id, 'Cobrança não encontrada');
      return { ok: true };
    }
    if (charge.status === 'PAID' || charge.status === 'CANCELLED') {
      await this.repo.finishGatewayEvent(recorded.id, `Cobrança já ${charge.status === 'PAID' ? 'paga' : 'cancelada'}`);
      return { ok: true };
    }
    const paidAt = event.paidAt ? new Date(event.paidAt) : this.clock.now();
    const rules = await this.params.chargeRules();
    const paidOn = instantToYmd(paidAt, this.clock.timezone);
    const amounts = paymentAmounts({ amount: charge.amount, dueDate: charge.dueDate, paidOn, rules });
    const paidAmount = event.paidAmount ?? amounts.expected;
    await this.repo.markPaid(charge.id, {
      paidAt,
      paidAmount,
      fineAmount: amounts.fine,
      interestAmount: amounts.interest,
      discountAmount: '0.00',
      method: 'PIX',
      notes: 'Confirmado automaticamente pelo gateway',
      receiptDocumentId: null,
      registeredById: null,
      gatewayPaidAt: paidAt,
    });
    await this.repo.finishGatewayEvent(recorded.id, null);
    await this.afterPayment(charge, paidAmount, true);
    return { ok: true };
  }

  // ───────────────────────────── Auxiliares ─────────────────────────────

  /** Depois de pagar: situação do cliente, aviso ao cliente (§34) e à equipe. */
  private async afterPayment(c: ChargeRecord, paidAmount: string, byGateway: boolean): Promise<void> {
    await this.customerStatus.recompute(c.customer.id);
    await this.notifications.notifyCustomer(
      c.customer.id,
      {
        type: 'PAYMENT_CONFIRMED',
        title: 'Pagamento confirmado',
        body: `Recebemos ${formatBRL(paidAmount)} referente a ${c.description}. Obrigado!`,
        severity: 'SUCCESS',
        link: '/app/payments',
        entityType: 'Charge',
        entityId: c.id,
        dedupeKey: `charge:${c.id}:paid`,
      },
      {
        email: {
          subject: 'Pagamento confirmado — Locamania',
          paragraphs: [
            `Confirmamos o pagamento de ${formatBRL(paidAmount)} referente a ${c.description}.`,
            'O recibo fica disponível no aplicativo, em "Pagamentos".',
          ],
          button: { label: 'Ver meus pagamentos', path: '/app/payments' },
        },
      },
    );
    if (await this.params.bool(ParameterKey.NOTIFY_STAFF_PAYMENT_CONFIRMED)) {
      await this.notifications.notifyStaff(
        {
          type: 'PAYMENT_CONFIRMED',
          title: `Pagamento recebido — ${c.customer.name}`,
          body: `${formatBRL(paidAmount)} · ${c.description}${byGateway ? ' · PIX confirmado automaticamente' : ''}`,
          severity: 'SUCCESS',
          link: `/admin/customers/${c.customer.id}?tab=payments`,
          entityType: 'Customer',
          entityId: c.customer.id,
          dedupeKey: `charge:${c.id}:paid`,
        },
        Permission.PAYMENTS_VIEW,
      );
    }
    this.logger.log(`Pagamento ${c.number} confirmado${byGateway ? ' pelo gateway' : ''}.`);
  }

  private async find(id: string): Promise<ChargeRecord> {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundError('Cobrança não encontrada.');
    return c;
  }
}
