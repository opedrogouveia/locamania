'use client';

import {
  PAYMENT_METHOD_LABELS,
  Permission,
  diffDays,
  formatPlate,
  fromCents,
  toCents,
  type FinanceSummaryDto,
  type FinancialEntryDto,
  type Ymd,
} from '@locamania/shared';
import { AlertTriangle, Lock, Plus, Receipt, Table2, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import { compactBRL } from '@/components/charts/use-width';
import { BarList } from '@/components/finance/bar-list';
import { EntryDialog } from '@/components/finance/entry-dialog';
import { KpiTile } from '@/components/finance/kpi-tile';
import { IncomeExpenseChart, type IncomeExpenseDatum } from '@/components/finance/income-expense-chart';
import { PeriodPicker } from '@/components/finance/period-picker';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips, MobileRow, SearchInput, SectionCard } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { isPreset, periodRange, type PeriodPreset } from '@/lib/finance/period';
import { useFinanceEntries, useFinanceSummary } from '@/lib/queries';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { cn, formatBRL, formatYmd, plural, todayYmd } from '@/lib/utils';

const num = (v: string) => toCents(v) / 100;

/** Título do tooltip conforme a granularidade que a API escolheu (dia, semana ou mês). */
function bucketTitle(label: string, from: Ymd, to: Ymd): string {
  const span = diffDays(from, to) + 1;
  if (span <= 31) return label;
  if (span <= 124) return `Semana de ${label}`;
  return label;
}

function granularity(from: Ymd, to: Ymd): string {
  const span = diffDays(from, to) + 1;
  return span <= 31 ? 'por dia' : span <= 124 ? 'por semana' : 'por mês';
}

function Legend({ income, expense }: { income: string; expense: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-2">
        <span className="size-2.5 rounded-[3px] bg-chart-1" aria-hidden />
        <span className="text-muted-foreground">Entradas</span>
        <span className="font-semibold tabular">{formatBRL(income)}</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="size-2.5 rounded-[3px] bg-chart-3" aria-hidden />
        <span className="text-muted-foreground">Saídas</span>
        <span className="font-semibold tabular">{formatBRL(expense)}</span>
      </span>
    </div>
  );
}

function Kpis({ s }: { s: FinanceSummaryDto | undefined }) {
  if (!s) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={cn('h-[98px] rounded-xl', i === 4 && 'col-span-2 lg:col-span-1')} />
        ))}
      </div>
    );
  }
  const expenses = fromCents(toCents(s.maintenanceExpenses) + toCents(s.otherExpenses));
  const income = fromCents(toCents(s.received) + toCents(s.otherIncome));
  const negative = toCents(s.result) < 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <KpiTile label="Recebido" value={formatBRL(s.received)} hint={`${plural(s.receivedCount, 'pagamento', 'pagamentos')} de clientes`} tone="success" />
      <KpiTile label="A receber" value={formatBRL(s.pending)} hint={s.pendingCount ? `${plural(s.pendingCount, 'cobrança vence', 'cobranças vencem')} no período` : 'Nada a vencer no período'} tone="warning" />
      <KpiTile
        label="Em atraso hoje"
        value={formatBRL(s.overdue)}
        hint={s.overdueCount ? plural(s.overdueCount, 'cobrança atrasada', 'cobranças atrasadas') : 'Ninguém em atraso'}
        tone="danger"
        href="/admin/delinquency"
      />
      <KpiTile label="Despesas" value={formatBRL(expenses)} hint={`Manutenção ${formatBRL(s.maintenanceExpenses)} · outras ${formatBRL(s.otherExpenses)}`} tone="muted" />
      <KpiTile
        label="Resultado"
        value={formatBRL(s.result)}
        hint={`Entradas ${formatBRL(income)} menos despesas`}
        tone={negative ? 'danger' : 'success'}
        emphasis
        className="col-span-2 lg:col-span-1"
      />
    </div>
  );
}

function ChartCard({ s }: { s: FinanceSummaryDto }) {
  const [asTable, setAsTable] = useState(false);
  const today = todayYmd();
  const data: IncomeExpenseDatum[] = s.series.map((b, i) => ({
    key: b.start,
    label: b.label,
    title: bucketTitle(b.label, s.period.from, s.period.to),
    income: num(b.income),
    expense: num(b.expense),
    partial: i === s.series.length - 1 && s.period.to >= today,
  }));
  const income = fromCents(toCents(s.received) + toCents(s.otherIncome));
  const expense = fromCents(toCents(s.maintenanceExpenses) + toCents(s.otherExpenses));
  return (
    <SectionCard
      title="Entradas e saídas"
      description={`${granularity(s.period.from, s.period.to)} · recebimentos e receitas × manutenção e despesas`}
      actions={
        <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? <TrendingUp /> : <Table2 />}
          <span className="hidden sm:inline">{asTable ? 'Gráfico' : 'Tabela'}</span>
        </Button>
      }
    >
      <Legend income={income} expense={expense} />
      {asTable ? (
        <div className="mt-3 max-h-[300px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.key}>
                  <TableCell className="whitespace-nowrap">
                    {d.title}
                    {d.partial && <span className="ml-1 text-xs text-muted-foreground">(em andamento)</span>}
                  </TableCell>
                  <TableCell className="text-right tabular">{formatBRL(d.income)}</TableCell>
                  <TableCell className="text-right tabular">{formatBRL(d.expense)}</TableCell>
                  <TableCell className={cn('hidden text-right tabular sm:table-cell', d.income - d.expense < 0 && 'text-destructive')}>{formatBRL(d.income - d.expense)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <IncomeExpenseChart className="mt-4" data={data} format={(v) => formatBRL(v)} formatAxis={compactBRL} ariaLabel={`Entradas e saídas ${granularity(s.period.from, s.period.to)}`} />
      )}
    </SectionCard>
  );
}

function Breakdown({ s }: { s: FinanceSummaryDto }) {
  const totalExpense = s.expensesByCategory.reduce((a, c) => a + toCents(c.amount), 0) || 1;
  const pct = (cents: number) => `${Math.round((cents / totalExpense) * 100)}%`;
  const empty = (text: string) => <p className="px-4 pb-5 text-sm text-muted-foreground sm:px-5">{text}</p>;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
      <SectionCard title="Despesas por categoria" description="Manutenção e lançamentos do período" contentClassName="p-0 sm:p-0">
        {s.expensesByCategory.length === 0 ? (
          empty('Nenhuma despesa no período.')
        ) : (
          <BarList
            colorClass="bg-chart-3"
            unit="categorias"
            items={s.expensesByCategory.map((c) => ({ key: c.code, label: c.label, value: num(c.amount), display: formatBRL(c.amount), aside: pct(toCents(c.amount)) }))}
          />
        )}
      </SectionCard>
      <SectionCard title="Receita por moto" description="O que cada moto trouxe e custou" contentClassName="p-0 sm:p-0">
        {s.byMotorcycle.length === 0 ? (
          empty('Nenhuma receita de moto no período.')
        ) : (
          <BarList
            colorClass="bg-chart-1"
            unit="motos"
            items={s.byMotorcycle.map((m) => ({
              key: m.id,
              label: (
                <>
                  <span className="font-mono">{formatPlate(m.plate)}</span> <span className="font-normal text-muted-foreground">· {m.label}</span>
                </>
              ),
              hint: `Custo ${formatBRL(m.expense)}`,
              aside: <span className={toCents(m.result) < 0 ? 'text-destructive' : undefined}>saldo {formatBRL(m.result)}</span>,
              value: num(m.income),
              display: formatBRL(m.income),
              href: `/admin/motorcycles/${m.id}`,
            }))}
          />
        )}
      </SectionCard>
      <SectionCard title="Receita por cliente" description="Quem mais pagou no período" contentClassName="p-0 sm:p-0">
        {s.byCustomer.length === 0 ? (
          empty('Nenhum pagamento no período.')
        ) : (
          <BarList
            colorClass="bg-chart-1"
            unit="clientes"
            items={s.byCustomer.map((c) => ({
              key: c.id,
              label: c.name,
              hint: toCents(c.overdue) > 0 ? <span className="text-destructive">Em atraso {formatBRL(c.overdue)}</span> : 'Em dia',
              value: num(c.paid),
              display: formatBRL(c.paid),
              href: `/admin/customers/${c.id}?tab=payments`,
            }))}
          />
        )}
      </SectionCard>
    </div>
  );
}

type EntryFilter = 'all' | 'INCOME' | 'EXPENSE';

function Entries({ from, to, filter, search, page, onQuery, canManage, onEdit, ready }: {
  ready: boolean;
  from: Ymd;
  to: Ymd;
  filter: EntryFilter;
  search: string;
  page: number;
  onQuery: (p: { type?: string; search?: string; page?: string }) => void;
  canManage: boolean;
  onEdit: (e: FinancialEntryDto) => void;
}) {
  const { data, isLoading, isFetching, error } = useFinanceEntries({ from, to, type: filter === 'all' ? undefined : filter, search: search || undefined, page, pageSize: 20 }, ready);

  const amountCell = (e: FinancialEntryDto) => (
    <span className={cn('whitespace-nowrap font-semibold tabular', e.type === 'INCOME' ? 'text-success' : 'text-foreground')}>
      {e.type === 'INCOME' ? '+ ' : '− '}
      {formatBRL(e.amount)}
    </span>
  );

  const columns: Column<FinancialEntryDto>[] = [
    { key: 'date', header: 'Data', className: 'w-28', cell: (e) => <span className="tabular">{formatYmd(e.date)}</span> },
    {
      key: 'desc',
      header: 'Lançamento',
      cell: (e) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate font-medium">{e.description}</p>
          <p className="text-xs text-muted-foreground">{e.categoryLabel}</p>
        </div>
      ),
    },
    { key: 'moto', header: 'Moto', cell: (e) => (e.motorcycle ? <span className="font-mono text-sm">{formatPlate(e.motorcycle.plate)}</span> : <span className="text-muted-foreground">—</span>) },
    { key: 'method', header: 'Forma', hideBelow: 'lg', cell: (e) => (e.method ? PAYMENT_METHOD_LABELS[e.method] : <span className="text-muted-foreground">—</span>) },
    { key: 'by', header: 'Lançado por', hideBelow: 'xl', cell: (e) => <span className="text-sm text-muted-foreground">{e.createdBy ?? 'Sistema'}</span> },
    { key: 'amount', header: 'Valor', align: 'right', cell: amountCell },
  ];

  return (
    <SectionCard title="Lançamentos" description="Receitas e despesas lançadas no período" contentClassName="p-0 sm:p-0">
      <div className="space-y-3 px-4 pb-3 sm:px-5 lg:flex lg:items-center lg:justify-between lg:space-y-0">
        <FilterChips
          value={filter}
          onChange={(v) => onQuery({ type: v, page: '1' })}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'EXPENSE', label: 'Despesas' },
            { value: 'INCOME', label: 'Receitas' },
          ]}
        />
        <SearchInput value={search} onChange={(v) => onQuery({ search: v, page: '1' })} placeholder="Buscar na descrição" className="lg:w-72" />
      </div>
      <div className={cn('border-t border-border', isFetching && !isLoading && 'opacity-70 transition-opacity')}>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <DataTable
            rows={ready ? data?.data : undefined}
            loading={isLoading || !ready}
            columns={columns}
            rowKey={(e) => e.id}
            onRowClick={canManage ? onEdit : undefined}
            empty={{ icon: Receipt, title: search || filter !== 'all' ? 'Nenhum lançamento neste filtro' : 'Nenhum lançamento no período', description: canManage ? 'Use "Novo lançamento" para registrar uma despesa ou receita.' : undefined }}
            mobileCard={(e) => (
              <MobileRow
                title={e.description}
                wrapTitle
                subtitle={`${e.categoryLabel}${e.motorcycle ? ` · ${formatPlate(e.motorcycle.plate)}` : ''}`}
                meta={<span className="tabular">{formatYmd(e.date)}</span>}
                right={amountCell(e)}
              />
            )}
          />
        )}
      </div>
      {data && data.totalPages > 1 && (
        <div className="border-t border-border p-3">
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} unit="lançamentos" onPageChange={(p) => onQuery({ page: String(p) })} />
        </div>
      )}
    </SectionCard>
  );
}

export default function FinancePage() {
  const canView = useCan(Permission.FINANCE_VIEW);
  const canManage = useCan(Permission.FINANCE_MANAGE);
  const [q, setQ, ready] = useUrlState({ p: 'month', from: '', to: '', type: 'all', search: '', page: '1' });
  const preset: PeriodPreset = isPreset(q.p) ? q.p : 'month';
  const range = periodRange(preset, todayYmd(), q.from, q.to);
  const summary = useFinanceSummary(range.from, range.to, ready && canView);
  const [dialog, setDialog] = useState<{ open: boolean; entry: FinancialEntryDto | null }>({ open: false, entry: null });
  const filter: EntryFilter = q.type === 'INCOME' || q.type === 'EXPENSE' ? q.type : 'all';

  if (!canView) {
    return <EmptyState icon={Lock} title="Sem acesso ao financeiro" description="Seu perfil não vê receitas, despesas e resultado. Fale com a proprietária se precisar." />;
  }

  const s = summary.data;
  const oneDay = range.from === range.to;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Financeiro"
        description={range.from === range.to ? formatYmd(range.from) : `${formatYmd(range.from)} a ${formatYmd(range.to)}`}
        actions={
          canManage && (
            <Button className="w-full sm:w-auto" onClick={() => setDialog({ open: true, entry: null })}>
              <Plus /> Novo lançamento
            </Button>
          )
        }
      />
      <PeriodPicker
        preset={preset}
        from={range.from}
        to={range.to}
        onChange={(n) => setQ({ p: n.p, from: n.from ?? '', to: n.to ?? '', page: '1' })}
      />

      {summary.error ? (
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar o financeiro" description={errorMessage(summary.error)} />
      ) : (
        <div className={cn('space-y-5 sm:space-y-6', summary.isFetching && s && 'opacity-70 transition-opacity')}>
          <Kpis s={s} />
          {!s ? (
            <Skeleton className="h-[320px] w-full rounded-xl" />
          ) : (
            <>
              {/* Um dia só não vira gráfico de uma coluna: os números acima já dizem tudo. */}
              {!oneDay && <ChartCard s={s} />}
              <Breakdown s={s} />
            </>
          )}
        </div>
      )}

      <Entries
        ready={ready}
        from={range.from}
        to={range.to}
        filter={filter}
        search={q.search ?? ''}
        page={pageOf(q.page)}
        onQuery={(p) => setQ(p)}
        canManage={canManage}
        onEdit={(entry) => setDialog({ open: true, entry })}
      />

      <EntryDialog open={dialog.open} entry={dialog.entry} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
    </div>
  );
}
