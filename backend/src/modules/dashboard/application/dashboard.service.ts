import { Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  diffDays,
  formatBRL,
  formatPlate,
  formatYmd,
  fromCents,
  ParameterKey,
  Permission,
  relativeDays,
  startOfMonth,
  startOfWeek,
  type DashboardAlertDto,
  type DashboardDto,
  type Ymd,
} from '@locamania/shared';

import { hasPermission, type StaffPrincipal } from '../../../shared/auth/principal';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { ClockService } from '../../../shared/time/clock.service';
import { DocumentsService } from '../../documents/application/documents.service';
import { FinanceService } from '../../finance/application/finance.service';
import { MaintenanceService } from '../../maintenance/application/maintenance.service';

export const DASHBOARD_QUERY = Symbol('DashboardQuery');

export interface DashboardQuery {
  fleet(): Promise<Record<string, number>>;
  customers(today: Ymd, graceDays: number): Promise<{ active: number; delinquent: number; inCollection: number; total: number }>;
  dueBetween(from: Ymd, to: Ymd, graceLimit: Ymd): Promise<{ count: number; cents: number }>;
  overdue(graceLimit: Ymd): Promise<{ count: number; cents: number }>;
  receivedSince(since: Ymd): Promise<number>;
  overdueByCustomer(graceLimit: Ymd, take: number): Promise<{ customerId: string; name: string; count: number; cents: number; oldest: Ymd }[]>;
  dueTodayList(today: Ymd, take: number): Promise<{ id: string; customerId: string; name: string; cents: number }[]>;
  dueTomorrowList(tomorrow: Ymd, take: number): Promise<{ customerId: string; name: string; cents: number }[]>;
  contractsEnding(until: Ymd): Promise<{ id: string; number: string; customerName: string; endDate: Ymd; plate: string }[]>;
  idleMotorcycles(before: Date): Promise<{ id: string; plate: string; availableSince: Date }[]>;
  recentPayments(since: Date, take: number): Promise<{ id: string; customerId: string; name: string; cents: number; paidAt: Date }[]>;
  recentOccurrences(since: Ymd, take: number): Promise<{ id: string; type: string; description: string; plate: string | null; occurredAt: Ymd }[]>;
  openSupport(): Promise<number>;
}

const SEVERITY_RANK = { DANGER: 0, WARNING: 1, INFO: 2, SUCCESS: 3 } as const;

/**
 * Tela inicial (§2.1): indicadores e alertas da operação, calculados na hora
 * (nada de alerta velho gravado — mudar um parâmetro corrige a tela).
 */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(DASHBOARD_QUERY) private readonly query: DashboardQuery,
    private readonly params: ParametersService,
    private readonly clock: ClockService,
    private readonly maintenance: MaintenanceService,
    private readonly documents: DocumentsService,
    private readonly finance: FinanceService,
  ) {}

  async get(actor: StaffPrincipal): Promise<DashboardDto> {
    const today = this.clock.today();
    const rules = await this.params.chargeRules();
    const graceLimit = addDays(today, -rules.graceDays);
    const endingDays = await this.params.number(ParameterKey.CONTRACT_ENDING_WARN_DAYS);
    const idleDays = await this.params.number(ParameterKey.IDLE_MOTORCYCLE_DAYS);
    const canPay = hasPermission(actor, Permission.PAYMENTS_VIEW);
    const canFinance = hasPermission(actor, Permission.FINANCE_VIEW);
    const money = (cents: number) => (canPay ? fromCents(cents) : null);

    const [fleet, customers, dueToday, dueNext, overdue, received, plans, expiring, ending, idle] = await Promise.all([
      this.query.fleet(),
      this.query.customers(today, rules.graceDays),
      this.query.dueBetween(today, today, graceLimit),
      this.query.dueBetween(addDays(today, 1), addDays(today, rules.dueSoonDays), graceLimit),
      this.query.overdue(graceLimit),
      this.query.receivedSince(startOfMonth(today)),
      this.maintenance.allPlanStatuses(),
      this.documents.expiring(),
      this.query.contractsEnding(addDays(today, endingDays)),
      this.query.idleMotorcycles(new Date(Date.now() - idleDays * 86_400_000)),
    ]);

    const alerts: DashboardAlertDto[] = [];

    if (canPay) {
      for (const o of await this.query.overdueByCustomer(graceLimit, 8)) {
        const days = diffDays(o.oldest, today);
        alerts.push({
          id: `overdue-${o.customerId}`,
          severity: 'DANGER',
          kind: 'PAYMENT_OVERDUE',
          title: `Pagamento atrasado — ${o.name}`,
          description: `${o.count === 1 ? '1 cobrança' : `${o.count} cobranças`} · ${formatBRL(fromCents(o.cents))} · há ${days} ${days === 1 ? 'dia' : 'dias'}`,
          link: `/admin/customers/${o.customerId}?tab=payments`,
          date: o.oldest,
        });
      }
      for (const d of await this.query.dueTodayList(today, 5)) {
        alerts.push({
          id: `today-${d.id}`,
          severity: 'WARNING',
          kind: 'PAYMENT_DUE_TODAY',
          title: `Pagamento vence hoje — ${d.name}`,
          description: formatBRL(fromCents(d.cents)),
          link: `/admin/customers/${d.customerId}?tab=payments`,
          date: today,
        });
      }
      for (const d of await this.query.dueTomorrowList(addDays(today, 1), 5)) {
        alerts.push({
          id: `tomorrow-${d.customerId}`,
          severity: 'WARNING',
          kind: 'PAYMENT_DUE_SOON',
          title: `Pagamento vence amanhã — ${d.name}`,
          description: formatBRL(fromCents(d.cents)),
          link: `/admin/customers/${d.customerId}?tab=payments`,
          date: addDays(today, 1),
        });
      }
    }

    for (const p of plans.filter((pl) => pl.due.status !== 'OK').slice(0, 40)) {
      const overdueP = p.due.status === 'OVERDUE';
      const detail =
        p.due.trigger === 'KM' && p.due.kmRemaining !== null
          ? overdueP
            ? `passou ${Math.abs(p.due.kmRemaining).toLocaleString('pt-BR')} km do limite`
            : `faltam ${p.due.kmRemaining.toLocaleString('pt-BR')} km`
          : p.nextDueDate
            ? overdueP
              ? `vencida desde ${formatYmd(p.nextDueDate)}`
              : `prevista ${relativeDays(p.nextDueDate, today)} (${formatYmd(p.nextDueDate)})`
            : '';
      alerts.push({
        id: `maint-${p.id}`,
        severity: overdueP ? 'DANGER' : 'WARNING',
        kind: overdueP ? 'MAINTENANCE_OVERDUE' : 'MAINTENANCE_DUE_SOON',
        title: `${overdueP ? 'Manutenção vencida' : p.type.name} — ${formatPlate(p.motorcycle.plate)}`,
        description: `${overdueP ? `${p.type.name}: ` : ''}${detail}${p.renter ? ` · com ${p.renter.name}` : ''}`,
        link: `/admin/motorcycles/${p.motorcycle.id}?tab=maintenance`,
        date: p.nextDueDate,
      });
    }

    for (const e of expiring.slice(0, 20)) {
      const expired = e.state === 'EXPIRED';
      alerts.push({
        id: `doc-${e.id}`,
        severity: expired ? 'DANGER' : 'WARNING',
        kind: expired ? 'DOCUMENT_EXPIRED' : 'DOCUMENT_EXPIRING',
        title: `${e.title} ${expired ? 'vencido' : `vence ${relativeDays(e.expiresAt, today)}`} — ${e.owner.label}`,
        description: `Validade ${formatYmd(e.expiresAt)}`,
        link: e.owner.type === 'CUSTOMER' ? `/admin/customers/${e.owner.id}?tab=documents` : e.owner.type === 'MOTORCYCLE' ? `/admin/motorcycles/${e.owner.id}?tab=documents` : '/admin/documents',
        date: e.expiresAt,
      });
    }

    for (const c of ending) {
      alerts.push({
        id: `ending-${c.id}`,
        severity: 'WARNING',
        kind: 'CONTRACT_ENDING',
        title: `Contrato termina ${relativeDays(c.endDate, today)} — ${c.customerName}`,
        description: `${c.number} · ${formatPlate(c.plate)} · término ${formatYmd(c.endDate)}`,
        link: `/admin/contracts/${c.id}`,
        date: c.endDate,
      });
    }

    for (const m of idle) {
      const days = diffDays(m.availableSince.toISOString().slice(0, 10), today);
      alerts.push({
        id: `idle-${m.id}`,
        severity: 'INFO',
        kind: 'MOTORCYCLE_IDLE',
        title: `Moto parada — ${formatPlate(m.plate)}`,
        description: `Disponível há ${days} dias sem aluguel`,
        link: `/admin/motorcycles/${m.id}`,
        date: null,
      });
    }

    for (const o of await this.query.recentOccurrences(addDays(today, -3), 5)) {
      alerts.push({
        id: `occ-${o.id}`,
        severity: 'WARNING',
        kind: 'OCCURRENCE_CREATED',
        title: `Nova ocorrência${o.plate ? ` — ${formatPlate(o.plate)}` : ''}`,
        description: o.description,
        link: `/admin/occurrences/${o.id}`,
        date: o.occurredAt,
      });
    }

    if (canPay) {
      for (const p of await this.query.recentPayments(new Date(Date.now() - 2 * 86_400_000), 5)) {
        alerts.push({
          id: `paid-${p.id}`,
          severity: 'SUCCESS',
          kind: 'PAYMENT_CONFIRMED',
          title: `Pagamento recebido — ${p.name}`,
          description: formatBRL(fromCents(p.cents)),
          link: `/admin/customers/${p.customerId}?tab=payments`,
          date: p.paidAt.toISOString(),
        });
      }
    }

    alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

    let revenueTrend: DashboardDto['revenueTrend'] = null;
    if (canFinance) {
      const from = startOfWeek(addDays(today, -7 * 11));
      const summary = await this.finance.summary(from, today);
      revenueTrend = summary.series.map((s) => ({ label: s.label, start: s.start, amount: s.income }));
    }

    return {
      today,
      fleet: {
        total: Object.entries(fleet).filter(([s]) => s !== 'INACTIVE').reduce((a, [, n]) => a + n, 0),
        rented: fleet.RENTED ?? 0,
        available: fleet.AVAILABLE ?? 0,
        reserved: fleet.RESERVED ?? 0,
        maintenance: fleet.MAINTENANCE ?? 0,
        blocked: fleet.BLOCKED ?? 0,
        inactive: fleet.INACTIVE ?? 0,
      },
      customers,
      payments: {
        dueToday: { count: dueToday.count, amount: money(dueToday.cents) },
        dueNextDays: { count: dueNext.count, amount: money(dueNext.cents), days: rules.dueSoonDays },
        overdue: { count: overdue.count, amount: money(overdue.cents) },
        receivedThisMonth: money(received),
      },
      contractsEndingSoon: ending.length,
      maintenanceDueSoon: plans.filter((p) => p.due.status === 'DUE_SOON').length,
      maintenanceOverdue: plans.filter((p) => p.due.status === 'OVERDUE').length,
      documentsExpiring: expiring.length,
      alerts: alerts.slice(0, 60),
      revenueTrend,
    };
  }
}
