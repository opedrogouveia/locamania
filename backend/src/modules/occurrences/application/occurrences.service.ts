import { Inject, Injectable } from '@nestjs/common';
import {
  OCCURRENCE_TYPE_LABELS,
  Permission,
  type ChargeOccurrenceRequest,
  type CreateOccurrenceRequest,
  type ListOccurrencesQuery,
  type OccurrenceDto,
  type PaginatedResponse,
  type UpdateOccurrenceRequest,
} from '@locamania/shared';

import { hasPermission, type Principal, type StaffPrincipal } from '../../../shared/auth/principal';
import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso, toDecimalInput } from '../../../shared/http/mappers';
import { paginated, pageParams, searchTerm } from '../../../shared/http/pagination';
import { ClockService } from '../../../shared/time/clock.service';
import { ChargesService } from '../../charges/application/charges.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { OCCURRENCES_REPOSITORY, type OccurrenceRecord, type OccurrencesRepository } from '../domain/occurrences.ports';

@Injectable()
export class OccurrencesService {
  constructor(
    @Inject(OCCURRENCES_REPOSITORY) private readonly repo: OccurrencesRepository,
    private readonly catalog: CatalogLabelsService,
    private readonly charges: ChargesService,
    private readonly notifications: NotificationsService,
    private readonly clock: ClockService,
  ) {}

  private async toDto(o: OccurrenceRecord, actor: Principal): Promise<OccurrenceDto> {
    const label = await this.catalog.resolver();
    return {
      id: o.id,
      type: o.type,
      status: o.status,
      occurredAt: o.occurredAt,
      motorcycle: o.motorcycle
        ? { id: o.motorcycle.id, plate: o.motorcycle.plate, label: `${label('MOTORCYCLE_BRAND', o.motorcycle.brandCode)} ${label('MOTORCYCLE_MODEL', o.motorcycle.modelCode)}` }
        : null,
      customer: o.customer ? { id: o.customer.id, label: o.customer.name } : null,
      contract: o.contract,
      description: o.description,
      amount: hasPermission(actor, Permission.PAYMENTS_VIEW) ? o.amount : null,
      fineNumber: o.fineNumber,
      fineDueDate: o.fineDueDate,
      charge: o.charge,
      notes: o.notes,
      documentsCount: o.documentsCount,
      createdBy: o.createdByName,
      createdAt: iso(o.createdAt),
    };
  }

  async list(query: ListOccurrencesQuery, actor: Principal): Promise<PaginatedResponse<OccurrenceDto>> {
    const p = pageParams(query);
    const { items, total } = await this.repo.list({ ...query, search: searchTerm(query.search), skip: p.skip, take: p.take });
    return paginated(await Promise.all(items.map((o) => this.toDto(o, actor))), total, p);
  }

  async get(id: string, actor: Principal): Promise<OccurrenceDto> {
    const o = await this.repo.findById(id);
    if (!o) throw new NotFoundError('Ocorrência não encontrada.');
    return this.toDto(o, actor);
  }

  async create(input: CreateOccurrenceRequest, actor: StaffPrincipal): Promise<OccurrenceDto> {
    if (!input.description.trim()) throw new ValidationError('Descreva a ocorrência.');
    if (!input.motorcycleId && !input.customerId) throw new ValidationError('Informe a moto ou o cliente.');
    if (input.occurredAt > this.clock.today()) throw new ValidationError('A data não pode ser no futuro.');
    let { customerId, contractId } = input;
    // Multa/avaria na moto: liga a quem estava com ela na data, se não foi informado.
    if (input.motorcycleId && !customerId) {
      const c = await this.repo.contractOn(input.motorcycleId, input.occurredAt);
      if (c) {
        customerId = c.customerId;
        contractId = contractId ?? c.id;
      }
    }
    const id = await this.repo.create(
      {
        type: input.type,
        status: input.status ?? 'OPEN',
        occurredAt: input.occurredAt,
        motorcycleId: input.motorcycleId ?? null,
        customerId: customerId ?? null,
        contractId: contractId ?? null,
        description: input.description.trim(),
        amount: toDecimalInput(input.amount ?? null),
        fineNumber: input.fineNumber?.trim() || null,
        fineDueDate: input.fineDueDate ?? null,
        notes: input.notes?.trim() || null,
      },
      actor.id,
    );
    const created = await this.get(id, actor);
    await this.notifications.notifyStaff({
      type: 'OCCURRENCE_CREATED',
      title: `Nova ocorrência: ${OCCURRENCE_TYPE_LABELS[input.type].toLowerCase()}${created.motorcycle ? ` — ${created.motorcycle.plate}` : ''}`,
      body: `${input.description.trim()}${created.customer ? ` · ${created.customer.label}` : ''}`,
      severity: input.type === 'THEFT' || input.type === 'ACCIDENT' ? 'DANGER' : 'WARNING',
      link: `/admin/occurrences/${id}`,
      entityType: 'Occurrence',
      entityId: id,
      dedupeKey: `occurrence:${id}:created`,
    }, Permission.OCCURRENCES_VIEW);
    return created;
  }

  async update(id: string, input: UpdateOccurrenceRequest, actor: Principal): Promise<OccurrenceDto> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Ocorrência não encontrada.');
    await this.repo.update(id, {
      ...input,
      description: input.description?.trim(),
      amount: input.amount !== undefined ? toDecimalInput(input.amount) : undefined,
      fineNumber: input.fineNumber !== undefined ? input.fineNumber?.trim() || null : undefined,
      notes: input.notes !== undefined ? input.notes?.trim() || null : undefined,
    });
    return this.get(id, actor);
  }

  /** Repasse ao cliente (§22): vira cobrança avulsa ligada à ocorrência. */
  async chargeCustomer(id: string, input: ChargeOccurrenceRequest, actor: Principal): Promise<OccurrenceDto> {
    const o = await this.repo.findById(id);
    if (!o) throw new NotFoundError('Ocorrência não encontrada.');
    if (!o.customer) throw new ValidationError('Informe o cliente da ocorrência antes de cobrar.');
    if (o.charge) throw new ValidationError('Esta ocorrência já foi cobrada do cliente.');
    const kind = o.type === 'TRAFFIC_FINE' ? 'FINE' : o.type === 'DAMAGE' || o.type === 'ACCIDENT' ? 'DAMAGE' : 'OTHER';
    const amount = toDecimalInput(input.amount);
    await this.charges.create(
      {
        customerId: o.customer.id,
        contractId: o.contract?.id ?? null,
        motorcycleId: o.motorcycle?.id ?? null,
        kind,
        description:
          input.description?.trim() ||
          `${OCCURRENCE_TYPE_LABELS[o.type]}${o.fineNumber ? ` ${o.fineNumber}` : ''} — ${o.description}`.slice(0, 200),
        dueDate: input.dueDate,
        amount: amount ?? '0',
      },
      o.id,
    );
    await this.repo.update(id, { status: o.status === 'OPEN' ? 'IN_PROGRESS' : o.status, amount: o.amount ?? amount });
    return this.get(id, actor);
  }

  async archive(id: string): Promise<void> {
    const o = await this.repo.findById(id);
    if (!o) throw new NotFoundError('Ocorrência não encontrada.');
    if (o.charge && o.charge.status !== 'CANCELLED') throw new ValidationError('Cancele a cobrança ligada antes de arquivar a ocorrência.');
    await this.repo.archive(id);
  }
}
