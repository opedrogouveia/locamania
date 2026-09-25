import { Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  fromCents,
  maintenanceDueStatus,
  nextMaintenanceDue,
  Permission,
  type CompleteMaintenanceRequest,
  type CreateMaintenanceRecordRequest,
  type ListMaintenanceQuery,
  type MaintenanceOverviewDto,
  type MaintenancePlanDto,
  type MaintenanceRecordDto,
  type PaginatedResponse,
  type UpdateMaintenanceRecordRequest,
  type UpsertMaintenancePlanRequest,
} from '@locamania/shared';

import { hasPermission, type Principal, type StaffPrincipal } from '../../../shared/auth/principal';
import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso, toDecimalInput } from '../../../shared/http/mappers';
import { paginated, pageParams, searchTerm } from '../../../shared/http/pagination';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { ClockService } from '../../../shared/time/clock.service';
import { MAINTENANCE_REPOSITORY, type MaintenanceRepository, type PlanRecord, type RecordRow } from '../domain/maintenance.ports';

const RANK = { OVERDUE: 0, DUE_SOON: 1, OK: 2 } as const;

@Injectable()
export class MaintenanceService {
  constructor(
    @Inject(MAINTENANCE_REPOSITORY) private readonly repo: MaintenanceRepository,
    private readonly params: ParametersService,
    private readonly clock: ClockService,
    private readonly catalog: CatalogLabelsService,
  ) {}

  private async planDtos(plans: PlanRecord[]): Promise<MaintenancePlanDto[]> {
    const rules = await this.params.maintenanceRules();
    const today = this.clock.today();
    const label = await this.catalog.resolver();
    return plans.map((p) => ({
      id: p.id,
      motorcycle: {
        id: p.motorcycle.id,
        plate: p.motorcycle.plate,
        label: `${label('MOTORCYCLE_BRAND', p.motorcycle.brandCode)} ${label('MOTORCYCLE_MODEL', p.motorcycle.modelCode)}`,
        currentKm: p.motorcycle.currentKm,
        status: p.motorcycle.status,
      },
      type: p.type,
      intervalKm: p.intervalKm,
      intervalDays: p.intervalDays,
      lastDoneKm: p.lastDoneKm,
      lastDoneAt: p.lastDoneAt,
      nextDueKm: p.nextDueKm,
      nextDueDate: p.nextDueDate,
      due: maintenanceDueStatus(p, { currentKm: p.motorcycle.currentKm, today, rules }),
      active: p.active,
      renter: p.renter,
    }));
  }

  private async recordDto(r: RecordRow, actor: Principal): Promise<MaintenanceRecordDto> {
    const label = await this.catalog.resolver();
    return {
      id: r.id,
      motorcycle: {
        id: r.motorcycle.id,
        plate: r.motorcycle.plate,
        label: `${label('MOTORCYCLE_BRAND', r.motorcycle.brandCode)} ${label('MOTORCYCLE_MODEL', r.motorcycle.modelCode)}`,
      },
      status: r.status,
      types: r.types,
      scheduledFor: r.scheduledFor,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      km: r.km,
      workshop: r.workshop,
      parts: r.parts,
      cost: hasPermission(actor, Permission.FINANCE_VIEW) ? r.cost : null,
      notes: r.notes,
      documentsCount: r.documentsCount,
      createdBy: r.createdByName,
      createdAt: iso(r.createdAt),
    };
  }

  // ───────────────────────────── Planos ─────────────────────────────

  async plansOf(motorcycleId: string): Promise<MaintenancePlanDto[]> {
    return this.planDtos(await this.repo.plans({ motorcycleId }));
  }

  /** Planos próximos ou vencidos da frota inteira (abas "Próximas" e "Vencidas"). */
  async due(tab: 'upcoming' | 'overdue', query: ListMaintenanceQuery): Promise<PaginatedResponse<MaintenancePlanDto>> {
    const p = pageParams(query, 30);
    const all = await this.planDtos(await this.repo.plans({ activeOnly: true, motorcycleId: query.motorcycleId }));
    const term = searchTerm(query.search)?.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
    const filtered = all
      .filter((pl) => (tab === 'overdue' ? pl.due.status === 'OVERDUE' : pl.due.status === 'DUE_SOON'))
      .filter((pl) => !term || pl.motorcycle.plate.includes(term.replace(/ /g, '')) || pl.type.name.toUpperCase().includes(term) || pl.motorcycle.label.toUpperCase().includes(term))
      .sort(
        (a, b) =>
          RANK[a.due.status] - RANK[b.due.status] ||
          Math.min(a.due.kmRemaining ?? 1e9, (a.due.daysRemaining ?? 1e9) * 150) - Math.min(b.due.kmRemaining ?? 1e9, (b.due.daysRemaining ?? 1e9) * 150),
      );
    return paginated(filtered.slice(p.skip, p.skip + p.take), filtered.length, p);
  }

  async upsertPlan(motorcycleId: string, input: UpsertMaintenancePlanRequest): Promise<MaintenancePlanDto[]> {
    const type = await this.repo.typeById(input.typeId);
    if (!type) throw new NotFoundError('Tipo de manutenção não encontrado.');
    const intervalKm = input.intervalKm ?? null;
    const intervalDays = input.intervalDays ?? null;
    if (!intervalKm && !intervalDays && input.active !== false) {
      throw new ValidationError('Informe o intervalo em km, em dias ou os dois.');
    }
    const current = (await this.repo.plans({ motorcycleId })).find((p) => p.type.id === input.typeId);
    const lastDoneKm = input.lastDoneKm ?? current?.lastDoneKm ?? current?.motorcycle.currentKm ?? null;
    const lastDoneAt = input.lastDoneAt ?? current?.lastDoneAt ?? this.clock.today();
    const computed = nextMaintenanceDue({ intervalKm, intervalDays }, { km: lastDoneKm, date: lastDoneAt });
    await this.repo.upsertPlan(motorcycleId, input.typeId, {
      intervalKm,
      intervalDays,
      lastDoneKm,
      lastDoneAt,
      // Data/km informados à mão ("revisão prevista para 20/10") vencem o cálculo.
      nextDueKm: input.nextDueKm !== undefined ? input.nextDueKm : computed.nextDueKm,
      nextDueDate: input.nextDueDate !== undefined ? input.nextDueDate : computed.nextDueDate,
      active: input.active ?? true,
    });
    return this.plansOf(motorcycleId);
  }

  // ───────────────────────────── Registros ─────────────────────────────

  async records(status: 'in_progress' | 'done' | 'scheduled', query: ListMaintenanceQuery, actor: Principal): Promise<PaginatedResponse<MaintenanceRecordDto>> {
    const p = pageParams(query, 30);
    const map = { in_progress: ['IN_PROGRESS'], done: ['DONE'], scheduled: ['SCHEDULED'] } as const;
    const { items, total } = await this.repo.records({
      status: [...map[status]],
      motorcycleId: query.motorcycleId,
      from: query.from,
      to: query.to,
      search: searchTerm(query.search),
      skip: p.skip,
      take: p.take,
    });
    return paginated(await Promise.all(items.map((r) => this.recordDto(r, actor))), total, p);
  }

  async record(id: string, actor: Principal): Promise<MaintenanceRecordDto> {
    const r = await this.repo.findRecord(id);
    if (!r) throw new NotFoundError('Manutenção não encontrada.');
    return this.recordDto(r, actor);
  }

  async create(input: CreateMaintenanceRecordRequest, actor: StaffPrincipal): Promise<MaintenanceRecordDto> {
    if (!input.typeIds.length) throw new ValidationError('Escolha pelo menos um serviço.');
    const today = this.clock.today();
    if (input.status === 'DONE') {
      if (!input.completedAt || input.km == null) throw new ValidationError('Para registrar uma manutenção já feita, informe a data e a quilometragem.');
    }
    if (input.status === 'SCHEDULED' && !input.scheduledFor) throw new ValidationError('Informe a data agendada.');
    const id = await this.repo.createRecord(
      input.motorcycleId,
      {
        typeIds: input.typeIds,
        status: input.status === 'DONE' ? 'IN_PROGRESS' : input.status,
        scheduledFor: input.scheduledFor ?? null,
        startedAt: input.status === 'IN_PROGRESS' ? (input.startedAt ?? today) : (input.startedAt ?? null),
        km: input.km ?? null,
        workshop: input.workshop?.trim() || null,
        parts: input.parts?.trim() || null,
        cost: toDecimalInput(input.cost ?? null),
        notes: input.notes?.trim() || null,
      },
      actor.id,
    );
    if (input.status === 'IN_PROGRESS' && input.setMotorcycleInMaintenance !== false) {
      await this.repo.setMotorcycleStatus(input.motorcycleId, 'MAINTENANCE', 'Em manutenção');
    }
    if (input.status === 'DONE') {
      return this.complete(
        id,
        { completedAt: input.completedAt!, km: input.km!, cost: input.cost, workshop: input.workshop, parts: input.parts, notes: input.notes },
        actor,
      );
    }
    return this.record(id, actor);
  }

  async update(id: string, input: UpdateMaintenanceRecordRequest, actor: StaffPrincipal): Promise<MaintenanceRecordDto> {
    const r = await this.repo.findRecord(id);
    if (!r) throw new NotFoundError('Manutenção não encontrada.');
    if (r.status === 'DONE' && input.status && input.status !== 'DONE') {
      throw new ValidationError('Manutenção realizada não volta para agendada ou em andamento.');
    }
    if (input.status === 'DONE') throw new ValidationError('Use "Concluir" para finalizar a manutenção.');
    await this.repo.updateRecord(id, {
      typeIds: input.typeIds,
      status: input.status,
      scheduledFor: input.scheduledFor,
      startedAt: input.status === 'IN_PROGRESS' && !r.startedAt ? this.clock.today() : input.startedAt,
      km: input.km,
      workshop: input.workshop !== undefined ? input.workshop?.trim() || null : undefined,
      parts: input.parts !== undefined ? input.parts?.trim() || null : undefined,
      cost: input.cost !== undefined ? toDecimalInput(input.cost) : undefined,
      notes: input.notes !== undefined ? input.notes?.trim() || null : undefined,
    });
    if (input.status === 'IN_PROGRESS' && r.status !== 'IN_PROGRESS' && input.setMotorcycleInMaintenance !== false) {
      await this.repo.setMotorcycleStatus(r.motorcycle.id, 'MAINTENANCE', 'Em manutenção');
    }
    if (input.status === 'CANCELLED' && r.status === 'IN_PROGRESS') await this.releaseMotorcycle(r.motorcycle.id, id);
    return this.record(id, actor);
  }

  /**
   * Concluir (§41): grava o serviço, recalcula o próximo intervalo de cada
   * tipo feito a partir do km/data reais e devolve a moto para a situação certa.
   */
  async complete(id: string, input: CompleteMaintenanceRequest, actor: StaffPrincipal): Promise<MaintenanceRecordDto> {
    const r = await this.repo.findRecord(id);
    if (!r) throw new NotFoundError('Manutenção não encontrada.');
    if (r.status === 'DONE') throw new ValidationError('Esta manutenção já foi concluída.');
    if (r.status === 'CANCELLED') throw new ValidationError('Esta manutenção foi cancelada.');
    if (input.completedAt > this.clock.today()) throw new ValidationError('A data da manutenção não pode ser no futuro.');
    if (!Number.isInteger(input.km) || input.km < 0) throw new ValidationError('Quilometragem inválida.');
    if (input.km + 5000 < r.motorcycle.currentKm) {
      throw new ValidationError(`A quilometragem informada está muito abaixo da atual da moto (${r.motorcycle.currentKm.toLocaleString('pt-BR')} km).`);
    }

    const plans = (await this.repo.plans({ motorcycleId: r.motorcycle.id })).filter((p) => r.types.some((t) => t.id === p.type.id));
    const planUpdates = plans.map((p) => {
      const next = nextMaintenanceDue({ intervalKm: p.intervalKm, intervalDays: p.intervalDays }, { km: input.km, date: input.completedAt });
      return { planId: p.id, lastDoneKm: input.km, lastDoneAt: input.completedAt, nextDueKm: next.nextDueKm, nextDueDate: next.nextDueDate };
    });
    const others = await this.repo.countOpenRecords(r.motorcycle.id, id);
    const nextStatus =
      r.motorcycle.status === 'MAINTENANCE' && others === 0
        ? (input.nextMotorcycleStatus ?? ((await this.repo.hasActiveContract(r.motorcycle.id)) ? 'RENTED' : 'AVAILABLE'))
        : null;
    await this.repo.complete(id, {
      completedAt: input.completedAt,
      km: input.km,
      cost: toDecimalInput(input.cost ?? r.cost),
      workshop: input.workshop?.trim() || r.workshop,
      parts: input.parts?.trim() || r.parts,
      notes: input.notes?.trim() || r.notes,
      plans: planUpdates,
      nextMotorcycleStatus: nextStatus,
      userId: actor.id,
    });
    return this.record(id, actor);
  }

  async overview(actor: Principal): Promise<MaintenanceOverviewDto> {
    const [plans, summary] = await Promise.all([
      this.planDtos(await this.repo.plans({ activeOnly: true })),
      this.repo.summary(addDays(this.clock.today(), -30)),
    ]);
    return {
      upcoming: plans.filter((p) => p.due.status === 'DUE_SOON').length,
      overdue: plans.filter((p) => p.due.status === 'OVERDUE').length,
      inProgress: summary.inProgress,
      scheduled: summary.scheduled,
      doneLast30Days: summary.doneCount,
      costLast30Days: hasPermission(actor, Permission.FINANCE_VIEW) ? fromCents(summary.doneCostCents) : null,
    };
  }

  /** Planos da frota inteira com a situação calculada (usado por jobs, portal e dashboard). */
  async allPlanStatuses(): Promise<MaintenancePlanDto[]> {
    return this.planDtos(await this.repo.plans({ activeOnly: true }));
  }

  private async releaseMotorcycle(motorcycleId: string, exceptRecordId: string): Promise<void> {
    if ((await this.repo.countOpenRecords(motorcycleId, exceptRecordId)) > 0) return;
    const rented = await this.repo.hasActiveContract(motorcycleId);
    await this.repo.setMotorcycleStatus(motorcycleId, rented ? 'RENTED' : 'AVAILABLE', null);
  }
}
