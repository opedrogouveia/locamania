import { Inject, Injectable } from '@nestjs/common';
import {
  firstName,
  ParameterKey,
  whatsappLink,
  type CreateCustomerRequest,
  type CustomerDocumentChecklistItem,
  type CustomerDto,
  type CustomerListItemDto,
  type ListCustomersQuery,
  type PaginatedResponse,
  type PortalInviteResponse,
  type SetCustomerStatusRequest,
  type UpdateCustomerRequest,
} from '@locamania/shared';

import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import type { Principal } from '../../../shared/auth/principal';
import { SessionResolverService } from '../../../shared/auth/session-resolver.service';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { paginated, pageParams, searchTerm } from '../../../shared/http/pagination';
import { MailService } from '../../../shared/mail/mail.service';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { ClockService } from '../../../shared/time/clock.service';
import { AuthTokensService } from '../../auth/application/auth-tokens.service';
import { normalizeCustomerInput } from '../domain/customer-rules';
import { CUSTOMERS_REPOSITORY, type CustomerRecord, type CustomersRepository } from '../domain/customers.ports';
import { CustomerStatusService } from './customer-status.service';
import { toCustomerDto, toCustomerListItem } from './customers.mapper';

@Injectable()
export class CustomersService {
  constructor(
    @Inject(CUSTOMERS_REPOSITORY) private readonly repo: CustomersRepository,
    private readonly params: ParametersService,
    private readonly clock: ClockService,
    private readonly catalog: CatalogLabelsService,
    private readonly status: CustomerStatusService,
    private readonly tokens: AuthTokensService,
    private readonly mail: MailService,
    private readonly sessions: SessionResolverService,
  ) {}

  async list(query: ListCustomersQuery, actor: Principal): Promise<PaginatedResponse<CustomerListItemDto>> {
    const p = pageParams(query);
    const { items, total } = await this.repo.list({
      skip: p.skip,
      take: p.take,
      search: searchTerm(query.search),
      status: query.status,
      inCollection: query.inCollection,
    });
    const ctx = await this.context(items);
    return paginated(items.map((c) => toCustomerListItem(c, ctx(c.id), actor)), total, p);
  }

  async get(id: string, actor: Principal): Promise<CustomerDto> {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundError('Cliente não encontrado.');
    const [ctxOf, rules, docs, required, labels] = await Promise.all([
      this.context([c]),
      this.params.chargeRules(),
      this.repo.documents(id),
      this.params.requiredCustomerDocuments(),
      this.catalog.resolver(),
    ]);
    const today = this.clock.today();
    const [totals, nextCharge] = await Promise.all([this.repo.totals(id, today, rules.graceDays), this.repo.nextCharge(id)]);
    const checklist: CustomerDocumentChecklistItem[] = required.map((typeCode) => {
      const doc = docs.find((d) => d.typeCode === typeCode);
      return {
        typeCode,
        label: labels('DOCUMENT_TYPE', typeCode),
        delivered: !!doc,
        documentId: doc?.id ?? null,
        expiresAt: typeCode === 'CNH' ? (c.cnhExpiresAt ?? doc?.expiresAt ?? null) : (doc?.expiresAt ?? null),
      };
    });
    return toCustomerDto(c, { ...ctxOf(id), checklist, totals, nextCharge }, actor);
  }

  async create(input: CreateCustomerRequest, actor: Principal): Promise<CustomerDto> {
    const data = normalizeCustomerInput(input, this.clock.today());
    if (!data.name || !data.cpf) throw new ValidationError('Nome e CPF são obrigatórios.');
    const existing = await this.repo.findByCpf(data.cpf);
    if (existing) throw new ConflictError(`Já existe um cliente com este CPF (cliente nº ${existing.number}).`, 'CPF_TAKEN');
    const created = await this.repo.create({ ...data, name: data.name, cpf: data.cpf });
    return this.get(created.id, actor);
  }

  async update(id: string, input: UpdateCustomerRequest, actor: Principal): Promise<CustomerDto> {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundError('Cliente não encontrado.');
    const data = normalizeCustomerInput(input, this.clock.today());
    if (data.cpf && data.cpf !== current.cpf) {
      const other = await this.repo.findByCpf(data.cpf);
      if (other && other.id !== id) throw new ConflictError('Já existe outro cliente com este CPF.', 'CPF_TAKEN');
    }
    await this.repo.update(id, data);
    return this.get(id, actor);
  }

  /** Bloquear / inativar / voltar à situação calculada (§3). */
  async setStatus(id: string, input: SetCustomerStatusRequest, actor: Principal): Promise<CustomerDto> {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundError('Cliente não encontrado.');
    if (input.manualStatus === 'BLOCKED' && !input.reason?.trim()) {
      throw new ValidationError('Informe o motivo do bloqueio.');
    }
    await this.repo.update(id, {
      manualStatus: input.manualStatus,
      blockedReason: input.manualStatus === 'BLOCKED' ? input.reason!.trim() : null,
    });
    await this.status.recompute(id);
    return this.get(id, actor);
  }

  async setCollection(id: string, inCollection: boolean, actor: Principal): Promise<CustomerDto> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Cliente não encontrado.');
    await this.repo.update(id, { inCollection, collectionSince: inCollection ? this.clock.today() : null });
    return this.get(id, actor);
  }

  /**
   * Convite de primeiro acesso ao app (§39 etapa 11): gera o link, manda por
   * e-mail (se tiver) e devolve o link do WhatsApp com a mensagem pronta.
   */
  async invite(id: string): Promise<PortalInviteResponse> {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundError('Cliente não encontrado.');
    const { link, expiresAt } = await this.tokens.issue('CUSTOMER_INVITE', { customerId: id });
    await this.repo.setPortal(id, true);
    this.sessions.forget('customer', id);
    const hello = `Olá, ${firstName(c.name)}!`;
    const message = `${hello} Este é o seu acesso ao aplicativo da Locamania, onde você acompanha seu aluguel, paga pelo PIX e recebe os avisos da sua moto. Crie sua senha aqui: ${link}`;
    let emailSent = false;
    if (c.email) {
      const result = await this.mail.send({
        to: c.email,
        subject: 'Seu acesso ao aplicativo Locamania',
        title: 'Seu aplicativo Locamania',
        greeting: hello,
        paragraphs: [
          'Pelo aplicativo você acompanha o seu aluguel, vê o próximo pagamento, paga pelo PIX, consulta o contrato e recebe os avisos da manutenção da sua moto.',
          'Crie a sua senha no botão abaixo. Depois é só entrar com o seu CPF e essa senha. O link vale por 7 dias.',
        ],
        button: { label: 'Criar minha senha', url: link },
      });
      emailSent = result.sent;
    }
    return {
      link,
      whatsappLink: whatsappLink(c.whatsapp ?? c.phone, message),
      emailSent,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async disablePortal(id: string): Promise<void> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Cliente não encontrado.');
    await this.repo.setPortal(id, false);
    this.sessions.forget('customer', id);
  }

  async archive(id: string): Promise<void> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Cliente não encontrado.');
    if (await this.repo.hasActiveContract(id)) {
      throw new ValidationError('Este cliente tem contrato ativo ou em rascunho. Encerre ou cancele antes de arquivar.');
    }
    await this.repo.archive(id);
    this.sessions.forget('customer', id);
  }

  /** Dados agregados para montar a lista/ficha: aluguel atual, atrasos, validade da CNH. */
  private async context(items: CustomerRecord[]) {
    const ids = items.map((c) => c.id);
    const today = this.clock.today();
    const rules = await this.params.chargeRules();
    const [cnhWarnDays, rentals, overdue, labels] = await Promise.all([
      this.params.number(ParameterKey.DOCUMENT_WARN_DAYS),
      this.repo.activeRentals(ids),
      this.repo.overdueSummary(ids, today, rules.graceDays),
      this.catalog.resolver(),
    ]);
    const motorcycleLabel = (b: string, m: string) => `${labels('MOTORCYCLE_BRAND', b)} ${labels('MOTORCYCLE_MODEL', m)}`;
    return (id: string) => ({ today, cnhWarnDays, rental: rentals.get(id), overdue: overdue.get(id), motorcycleLabel });
  }
}
