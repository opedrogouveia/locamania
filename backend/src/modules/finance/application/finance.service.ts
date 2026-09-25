import { Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  diffDays,
  formatYmdShort,
  fromCents,
  instantToYmd,
  startOfMonth,
  startOfWeek,
  addMonths,
  type CreateFinancialEntryRequest,
  type FinanceSummaryDto,
  type FinancialEntryDto,
  type ListFinancialEntriesQuery,
  type PaginatedResponse,
  type UpdateFinancialEntryRequest,
  type Ymd,
} from '@locamania/shared';

import type { StaffPrincipal } from '../../../shared/auth/principal';
import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso, toDecimalInput } from '../../../shared/http/mappers';
import { paginated, pageParams, searchTerm } from '../../../shared/http/pagination';
import { ParametersService } from '../../../shared/parameters/parameters.service';
import { ClockService } from '../../../shared/time/clock.service';
import { FINANCE_REPOSITORY, type EntryRecord, type FinanceRepository } from '../domain/finance.ports';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Granularidade da série: dia (até 31 dias), semana (até ~4 meses) ou mês. */
export function bucketOf(date: Ymd, span: number): { key: Ymd; label: string } {
  if (span <= 31) return { key: date, label: formatYmdShort(date) };
  if (span <= 124) {
    const w = startOfWeek(date);
    return { key: w, label: formatYmdShort(w) };
  }
  const m = startOfMonth(date);
  return { key: m, label: `${MONTHS[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}` };
}

function bucketKeys(from: Ymd, to: Ymd, span: number): { key: Ymd; label: string }[] {
  const out: { key: Ymd; label: string }[] = [];
  let cursor = bucketOf(from, span).key;
  while (cursor <= to && out.length < 400) {
    out.push(bucketOf(cursor, span));
    cursor = span <= 31 ? addDays(cursor, 1) : span <= 124 ? addDays(cursor, 7) : addMonths(cursor, 1, 1);
  }
  return out;
}

@Injectable()
export class FinanceService {
  constructor(
    @Inject(FINANCE_REPOSITORY) private readonly repo: FinanceRepository,
    private readonly catalog: CatalogLabelsService,
    private readonly params: ParametersService,
    private readonly clock: ClockService,
  ) {}

  private async toDto(e: EntryRecord): Promise<FinancialEntryDto> {
    const label = await this.catalog.resolver();
    return {
      id: e.id,
      type: e.type,
      categoryCode: e.categoryCode,
      categoryLabel: label(e.type === 'INCOME' ? 'INCOME_CATEGORY' : 'EXPENSE_CATEGORY', e.categoryCode),
      description: e.description,
      amount: e.amount,
      date: e.date,
      motorcycle: e.motorcycle,
      customer: e.customer ? { id: e.customer.id, label: e.customer.name } : null,
      supplier: e.supplier,
      method: e.method,
      createdBy: e.createdByName,
      createdAt: iso(e.createdAt),
    };
  }

  async list(query: ListFinancialEntriesQuery): Promise<PaginatedResponse<FinancialEntryDto>> {
    const p = pageParams(query, 30);
    const { items, total } = await this.repo.list({ ...query, search: searchTerm(query.search), skip: p.skip, take: p.take });
    return paginated(await Promise.all(items.map((e) => this.toDto(e))), total, p);
  }

  async create(input: CreateFinancialEntryRequest, actor: StaffPrincipal): Promise<FinancialEntryDto> {
    const amount = toDecimalInput(input.amount);
    if (!amount || Number(amount) <= 0) throw new ValidationError('Informe o valor.');
    if (!input.description.trim()) throw new ValidationError('Descreva o lançamento.');
    const group = input.type === 'INCOME' ? 'INCOME_CATEGORY' : 'EXPENSE_CATEGORY';
    if (!(await this.catalog.exists(group, input.categoryCode))) throw new ValidationError('Categoria inválida.');
    const id = await this.repo.create(
      { ...input, amount, description: input.description.trim(), supplier: input.supplier?.trim() || null },
      actor.id,
    );
    return this.toDto((await this.repo.findById(id))!);
  }

  async update(id: string, input: UpdateFinancialEntryRequest): Promise<FinancialEntryDto> {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundError('Lançamento não encontrado.');
    const amount = input.amount !== undefined ? toDecimalInput(input.amount) : undefined;
    if (amount !== undefined && (!amount || Number(amount) <= 0)) throw new ValidationError('Informe o valor.');
    await this.repo.update(id, { ...input, amount: amount ?? undefined, description: input.description?.trim() });
    return this.toDto((await this.repo.findById(id))!);
  }

  async archive(id: string): Promise<void> {
    if (!(await this.repo.findById(id))) throw new NotFoundError('Lançamento não encontrado.');
    await this.repo.archive(id);
  }

  /**
   * Painel financeiro (§25). Receita = pagamentos recebidos no período, **sem a
   * caução** (é dinheiro do cliente, não receita — caução retida entra como
   * lançamento). Despesa = custo das manutenções realizadas + lançamentos.
   */
  async summary(from: Ymd, to: Ymd): Promise<FinanceSummaryDto> {
    if (to < from) throw new ValidationError('O fim do período precisa ser depois do início.');
    if (diffDays(from, to) > 366 * 3) throw new ValidationError('Período máximo de 3 anos.');
    const tz = this.clock.timezone;
    const rules = await this.params.chargeRules();
    const facts = await this.repo.periodFacts(from, to, this.clock.today(), rules.graceDays);
    const label = await this.catalog.resolver();
    const span = diffDays(from, to) + 1;

    const revenue = facts.payments.filter((p) => p.kind !== 'DEPOSIT');
    const receivedCents = revenue.reduce((a, p) => a + p.cents, 0);
    const maintCents = facts.maintenance.reduce((a, m) => a + m.cents, 0);
    const otherExpCents = facts.entries.filter((e) => e.type === 'EXPENSE').reduce((a, e) => a + e.cents, 0);
    const otherIncCents = facts.entries.filter((e) => e.type === 'INCOME').reduce((a, e) => a + e.cents, 0);

    const buckets = bucketKeys(from, to, span);
    const income = new Map<string, number>();
    const expense = new Map<string, number>();
    const add = (map: Map<string, number>, date: Ymd, cents: number) => {
      const k = bucketOf(date, span).key;
      map.set(k, (map.get(k) ?? 0) + cents);
    };
    for (const p of revenue) add(income, instantToYmd(p.paidAt, tz), p.cents);
    for (const e of facts.entries) add(e.type === 'INCOME' ? income : expense, e.date, e.cents);
    for (const m of facts.maintenance) add(expense, m.date, m.cents);

    const byMoto = new Map<string, { income: number; expense: number }>();
    const moto = (id: string) => byMoto.get(id) ?? byMoto.set(id, { income: 0, expense: 0 }).get(id)!;
    for (const p of revenue) if (p.motorcycleId) moto(p.motorcycleId).income += p.cents;
    for (const m of facts.maintenance) moto(m.motorcycleId).expense += m.cents;
    for (const e of facts.entries) if (e.motorcycleId && e.type === 'EXPENSE') moto(e.motorcycleId).expense += e.cents;

    const byCustomer = new Map<string, { name: string; paid: number; overdue: number }>();
    for (const p of revenue) {
      const c = byCustomer.get(p.customerId) ?? { name: p.customerName, paid: 0, overdue: 0 };
      c.paid += p.cents;
      byCustomer.set(p.customerId, c);
    }
    for (const o of facts.overdue.byCustomer) {
      const c = byCustomer.get(o.customerId);
      if (c) c.overdue += o.cents;
    }

    const categories = new Map<string, number>();
    if (maintCents) categories.set('__MAINTENANCE', maintCents);
    for (const e of facts.entries.filter((x) => x.type === 'EXPENSE')) categories.set(e.categoryCode, (categories.get(e.categoryCode) ?? 0) + e.cents);

    return {
      period: { from, to },
      received: fromCents(receivedCents),
      receivedCount: revenue.length,
      pending: fromCents(facts.pending.cents),
      pendingCount: facts.pending.count,
      overdue: fromCents(facts.overdue.cents),
      overdueCount: facts.overdue.count,
      maintenanceExpenses: fromCents(maintCents),
      otherExpenses: fromCents(otherExpCents),
      otherIncome: fromCents(otherIncCents),
      result: fromCents(receivedCents + otherIncCents - maintCents - otherExpCents),
      series: buckets.map((b) => ({ label: b.label, start: b.key, income: fromCents(income.get(b.key) ?? 0), expense: fromCents(expense.get(b.key) ?? 0) })),
      byMotorcycle: [...byMoto.entries()]
        .map(([id, v]) => {
          const m = facts.motorcycles.get(id);
          return {
            id,
            plate: m?.plate ?? '—',
            label: m ? `${label('MOTORCYCLE_BRAND', m.brandCode)} ${label('MOTORCYCLE_MODEL', m.modelCode)}` : '—',
            income: fromCents(v.income),
            expense: fromCents(v.expense),
            result: fromCents(v.income - v.expense),
          };
        })
        .sort((a, b) => Number(b.income) - Number(a.income))
        .slice(0, 50),
      byCustomer: [...byCustomer.entries()]
        .map(([id, v]) => ({ id, name: v.name, paid: fromCents(v.paid), overdue: fromCents(v.overdue) }))
        .sort((a, b) => Number(b.paid) - Number(a.paid))
        .slice(0, 50),
      expensesByCategory: [...categories.entries()]
        .map(([code, cents]) => ({ code, label: code === '__MAINTENANCE' ? 'Manutenção' : label('EXPENSE_CATEGORY', code), amount: fromCents(cents) }))
        .sort((a, b) => Number(b.amount) - Number(a.amount)),
    };
  }
}
