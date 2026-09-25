import { Inject, Injectable } from '@nestjs/common';
import {
  diffDays,
  fromCents,
  instantToYmd,
  maintenanceDueStatus,
  nextMaintenanceDue,
  Permission,
  type CreateMotorcycleRequest,
  type CreateOdometerReadingRequest,
  type ListMotorcyclesQuery,
  type MaintenanceAlertRules,
  type MaintenanceDueStatus,
  type MotorcycleDto,
  type MotorcycleHistoryItemDto,
  type MotorcycleListItemDto,
  type OdometerReadingDto,
  type PaginatedResponse,
  type SetMotorcycleStatusRequest,
  type UpdateMotorcycleRequest,
  type Ymd,
} from '@locamania/shared';

import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import { hasPermission, type Principal, type StaffPrincipal } from '../../../shared/auth/principal';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso, toDecimalInput } from '../../../shared/http/mappers';
import { paginated, pageParams, searchTerm } from '../../../shared/http/pagination';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { ClockService } from '../../../shared/time/clock.service';
import {
  assertManualStatusChange,
  assertOdometerForward,
  assertYears,
  normalizeChassis,
  normalizeRenavam,
  normalizeValidPlate,
} from '../domain/motorcycle-rules';
import {
  MOTORCYCLES_REPOSITORY,
  type CurrentRental,
  type MotorcycleRecord,
  type MotorcyclesRepository,
  type MotorcycleWriteData,
  type PlanForDue,
} from '../domain/motorcycles.ports';

const RANK: Record<MaintenanceDueStatus, number> = { OK: 0, DUE_SOON: 1, OVERDUE: 2 };

interface Ctx {
  today: Ymd;
  rules: MaintenanceAlertRules;
  plans: PlanForDue[];
  rentals: Map<string, CurrentRental>;
  label: (group: 'MOTORCYCLE_BRAND' | 'MOTORCYCLE_MODEL', code: string) => string;
}

/** Situação da manutenção da moto = a pior entre os planos; "próxima" = a mais urgente. */
function maintenanceSummary(m: MotorcycleRecord, ctx: Ctx) {
  let worst: MaintenanceDueStatus = 'OK';
  let next: MotorcycleListItemDto['nextMaintenance'] = null;
  let bestScore = Infinity;
  for (const plan of ctx.plans.filter((p) => p.motorcycleId === m.id)) {
    const due = maintenanceDueStatus(plan, { currentKm: m.currentKm, today: ctx.today, rules: ctx.rules });
    if (RANK[due.status] > RANK[worst]) worst = due.status;
    // Urgência comparável: km restantes ~ dias × 150 km/dia (uso típico de entregador).
    const score = Math.min(due.kmRemaining ?? Infinity, (due.daysRemaining ?? Infinity) * 150);
    if (score < bestScore) {
      bestScore = score;
      next = { typeName: plan.typeName, kmRemaining: due.kmRemaining, daysRemaining: due.daysRemaining, nextDueDate: plan.nextDueDate };
    }
  }
  return { worst, next };
}

export function toMotorcycleListItem(m: MotorcycleRecord, ctx: Ctx): MotorcycleListItemDto {
  const { worst, next } = maintenanceSummary(m, ctx);
  const brandLabel = ctx.label('MOTORCYCLE_BRAND', m.brandCode);
  const modelLabel = ctx.label('MOTORCYCLE_MODEL', m.modelCode);
  const rental = ctx.rentals.get(m.id);
  return {
    id: m.id,
    plate: m.plate,
    brandCode: m.brandCode,
    brandLabel,
    modelCode: m.modelCode,
    modelLabel,
    label: `${brandLabel} ${modelLabel}`,
    manufactureYear: m.manufactureYear,
    modelYear: m.modelYear,
    color: m.color,
    currentKm: m.currentKm,
    status: m.status,
    statusReason: m.statusReason,
    hasTracker: m.hasTracker,
    currentRental: rental ? { contractId: rental.contractId, customerId: rental.customerId, customerName: rental.customerName } : null,
    maintenanceDue: worst,
    nextMaintenance: next,
    idleDays:
      m.status === 'AVAILABLE' && m.availableSince
        ? Math.max(0, diffDays(instantToYmd(m.availableSince), ctx.today))
        : null,
  };
}

@Injectable()
export class MotorcyclesService {
  constructor(
    @Inject(MOTORCYCLES_REPOSITORY) private readonly repo: MotorcyclesRepository,
    private readonly params: ParametersService,
    private readonly clock: ClockService,
    private readonly catalog: CatalogLabelsService,
  ) {}

  private async ctx(ids: string[]): Promise<Ctx> {
    const [rules, plans, rentals, resolver] = await Promise.all([
      this.params.maintenanceRules(),
      this.repo.plansForDue(ids),
      this.repo.currentRentals(ids),
      this.catalog.resolver(),
    ]);
    return { today: this.clock.today(), rules, plans, rentals, label: resolver };
  }

  async list(query: ListMotorcyclesQuery): Promise<PaginatedResponse<MotorcycleListItemDto>> {
    const p = pageParams(query, 24);
    const search = searchTerm(query.search);
    let ids: string[] | undefined;
    // Filtro por manutenção é calculado (depende do km atual e de hoje): resolve os ids antes.
    if (query.maintenanceDue) {
      const all = await this.repo.allIds(query.status);
      const { items } = await this.repo.list({ skip: 0, take: 10_000, ids: all });
      const c = await this.ctx(all);
      ids = items.filter((m) => maintenanceSummary(m, c).worst === query.maintenanceDue).map((m) => m.id);
    }
    const modelCodes = search ? await this.matchingCatalogCodes(search) : undefined;
    const { items, total } = await this.repo.list({ skip: p.skip, take: p.take, search, modelCodes, status: query.status, ids });
    const c = await this.ctx(items.map((m) => m.id));
    return paginated(items.map((m) => toMotorcycleListItem(m, c)), total, p);
  }

  async get(id: string, actor: Principal): Promise<MotorcycleDto> {
    const m = await this.repo.findById(id);
    if (!m) throw new NotFoundError('Moto não encontrada.');
    const [c, lastOdometerAt] = await Promise.all([this.ctx([id]), this.repo.lastOdometerAt(id)]);
    return {
      ...toMotorcycleListItem(m, c),
      renavam: m.renavam,
      chassis: m.chassis,
      acquiredAt: m.acquiredAt,
      purchasePrice: hasPermission(actor, Permission.FINANCE_VIEW) && m.purchasePriceCents != null ? fromCents(m.purchasePriceCents) : null,
      trackerProvider: m.trackerProvider,
      trackerDeviceId: m.trackerDeviceId,
      notes: m.notes,
      lastOdometerAt: iso(lastOdometerAt),
      createdAt: iso(m.createdAt),
      updatedAt: iso(m.updatedAt),
    };
  }

  async create(input: CreateMotorcycleRequest, actor: StaffPrincipal): Promise<MotorcycleDto> {
    const data = await this.normalize(input);
    if (!Number.isInteger(input.currentKm) || input.currentKm < 0) throw new ValidationError('Quilometragem inválida.');
    const plate = data.plate!;
    const existing = await this.repo.findByPlate(plate);
    if (existing) throw new ConflictError('Já existe uma moto com esta placa.', 'PLATE_TAKEN');

    // Planos de manutenção nascem com a moto, a partir dos intervalos padrão de cada tipo.
    const today = this.clock.today();
    const types = await this.repo.maintenanceTypes();
    const plans = types
      .filter((t) => t.defaultIntervalKm || t.defaultIntervalDays)
      .map((t) => {
        const next = nextMaintenanceDue(
          { intervalKm: t.defaultIntervalKm, intervalDays: t.defaultIntervalDays },
          { km: input.currentKm, date: today },
        );
        return {
          typeId: t.id,
          intervalKm: t.defaultIntervalKm,
          intervalDays: t.defaultIntervalDays,
          lastDoneKm: input.currentKm,
          lastDoneAt: today,
          nextDueKm: next.nextDueKm,
          nextDueDate: next.nextDueDate,
        };
      });
    const created = await this.repo.create(
      { ...data, brandCode: data.brandCode!, modelCode: data.modelCode!, plate, currentKm: input.currentKm },
      plans,
      actor.id,
    );
    return this.get(created.id, actor);
  }

  async update(id: string, input: UpdateMotorcycleRequest, actor: Principal): Promise<MotorcycleDto> {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundError('Moto não encontrada.');
    const data = await this.normalize(input);
    if (data.plate && data.plate !== current.plate) {
      const other = await this.repo.findByPlate(data.plate);
      if (other && other.id !== id) throw new ConflictError('Já existe uma moto com esta placa.', 'PLATE_TAKEN');
    }
    assertYears(data.manufactureYear ?? current.manufactureYear, data.modelYear ?? current.modelYear);
    await this.repo.update(id, data);
    return this.get(id, actor);
  }

  async setStatus(id: string, input: SetMotorcycleStatusRequest, actor: Principal): Promise<MotorcycleDto> {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundError('Moto não encontrada.');
    assertManualStatusChange(input.status, current.status, await this.repo.hasOpenContract(id), input.reason);
    await this.repo.setStatus(id, input.status, input.reason?.trim() || null);
    return this.get(id, actor);
  }

  async archive(id: string): Promise<void> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Moto não encontrada.');
    if (await this.repo.hasOpenContract(id)) throw new ValidationError('A moto tem contrato aberto. Encerre ou cancele antes de arquivar.');
    await this.repo.archive(id);
  }

  async odometer(id: string): Promise<OdometerReadingDto[]> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Moto não encontrada.');
    return (await this.repo.odometer(id, 100)).map((r) => ({ ...r, readAt: iso(r.readAt) }));
  }

  async addOdometer(id: string, input: CreateOdometerReadingRequest, actor: StaffPrincipal): Promise<MotorcycleDto> {
    const m = await this.repo.findById(id);
    if (!m) throw new NotFoundError('Moto não encontrada.');
    assertOdometerForward(input.km, m.currentKm);
    await this.repo.addOdometer(id, input.km, 'MANUAL', input.notes?.trim() || null, { userId: actor.id });
    return this.get(id, actor);
  }

  async history(id: string, actor: Principal): Promise<MotorcycleHistoryItemDto[]> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Moto não encontrada.');
    // Gasto é lançamento financeiro (traz o valor): some para quem não tem `finance.view`.
    const canFinance = hasPermission(actor, Permission.FINANCE_VIEW);
    return (await this.repo.history(id)).filter((h) => canFinance || h.kind !== 'EXPENSE').map((h) => ({ ...h, date: iso(h.date) }));
  }

  /** Busca "CG 160" encontra as motos cujo modelo/marca tem esse rótulo. */
  private matchingCatalogCodes(term: string): Promise<string[]> {
    return this.catalog.codesMatching(['MOTORCYCLE_MODEL', 'MOTORCYCLE_BRAND'], term);
  }

  private async normalize(input: Partial<CreateMotorcycleRequest>): Promise<MotorcycleWriteData> {
    const data: MotorcycleWriteData = {};
    if (input.plate !== undefined) data.plate = normalizeValidPlate(input.plate);
    for (const [key, group] of [['brandCode', 'MOTORCYCLE_BRAND'], ['modelCode', 'MOTORCYCLE_MODEL']] as const) {
      const code = input[key];
      if (code === undefined) continue;
      if (!(await this.catalog.exists(group, code))) throw new ValidationError(key === 'brandCode' ? 'Marca inválida.' : 'Modelo inválido.');
      data[key] = code;
    }
    assertYears(input.manufactureYear, input.modelYear);
    if (input.manufactureYear !== undefined) data.manufactureYear = input.manufactureYear;
    if (input.modelYear !== undefined) data.modelYear = input.modelYear;
    if (input.color !== undefined) data.color = input.color?.trim() || null;
    data.renavam = normalizeRenavam(input.renavam);
    data.chassis = normalizeChassis(input.chassis);
    if (data.renavam === undefined) delete data.renavam;
    if (data.chassis === undefined) delete data.chassis;
    if (input.acquiredAt !== undefined) data.acquiredAt = input.acquiredAt;
    if (input.purchasePrice !== undefined) data.purchasePrice = toDecimalInput(input.purchasePrice);
    if (input.hasTracker !== undefined) data.hasTracker = input.hasTracker;
    if (input.trackerProvider !== undefined) data.trackerProvider = input.trackerProvider?.trim() || null;
    if (input.trackerDeviceId !== undefined) data.trackerDeviceId = input.trackerDeviceId?.trim() || null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    return data;
  }
}
