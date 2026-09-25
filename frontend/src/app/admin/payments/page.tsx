'use client';

import {
  CHARGE_KIND_LABELS,
  CHARGE_KINDS,
  CHARGE_DISPLAY_STATUSES,
  Permission,
  startOfMonth,
  todayYmd,
  type ChargeDisplayStatus,
  type ChargeKind,
} from '@locamania/shared';
import { Plus, Receipt } from 'lucide-react';
import { useState } from 'react';

import { ChargeList } from '@/components/charges/charge-list';
import { NewChargeDialog } from '@/components/payments/new-charge-dialog';
import { PAYMENT_TAB_LABELS, PaymentStatusCards } from '@/components/payments/status-cards';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SelectMenu } from '@/components/ui/select-menu';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import {
  PERIOD_LABELS,
  isPeriodPreset,
  periodRange,
  type PeriodPreset,
} from '@/lib/contracts/rules';
import { useCharges, useChargesSummary } from '@/lib/queries';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { formatBRL, formatYmd, plural } from '@/lib/utils';

const DUE_PRESETS: PeriodPreset[] = [
  'all',
  'today',
  'next7',
  'week',
  'month',
  'lastMonth',
  'custom',
];
const PAID_PRESETS: PeriodPreset[] = ['all', 'today', 'week', 'month', 'lastMonth', 'custom'];

const EMPTY: Record<ChargeDisplayStatus, { title: string; description?: string }> = {
  UPCOMING: {
    title: 'Nada a vencer',
    description: 'Nenhuma cobrança em aberto com vencimento mais para a frente.',
  },
  DUE_SOON: {
    title: 'Nada perto do vencimento',
    description: 'Nenhuma cobrança vence nos próximos dias.',
  },
  OVERDUE: { title: 'Nenhum pagamento em atraso', description: 'Todos os clientes estão em dia.' },
  PAID: {
    title: 'Nenhum pagamento recebido',
    description: 'Os pagamentos registrados e os PIX confirmados aparecem aqui.',
  },
  CANCELLED: { title: 'Nenhuma cobrança cancelada' },
};

export default function PaymentsPage() {
  const canView = useCan(Permission.PAYMENTS_VIEW);
  const canManage = useCan(Permission.PAYMENTS_MANAGE);
  const [creating, setCreating] = useState(false);
  const [q, setQ, ready] = useUrlState({
    status: 'DUE_SOON',
    period: 'all',
    from: '',
    to: '',
    kind: '',
    search: '',
    page: '1',
  });
  const status = (CHARGE_DISPLAY_STATUSES as string[]).includes(q.status ?? '')
    ? (q.status as ChargeDisplayStatus)
    : 'DUE_SOON';
  const period: PeriodPreset = isPeriodPreset(q.period) ? q.period : 'all';
  const today = todayYmd();
  const range = periodRange(period, today, { from: q.from, to: q.to });
  const kind = (CHARGE_KINDS as string[]).includes(q.kind ?? '')
    ? (q.kind as ChargeKind)
    : undefined;
  const base = { search: q.search || undefined, kind };
  // Período = vencimento; na aba "Pagos", a data do pagamento.
  const dueFilter = { dueFrom: range.from, dueTo: range.to };
  const paidFilter = { paidFrom: range.from, paidTo: range.to };

  const list = useCharges(
    {
      ...base,
      ...(status === 'PAID' ? paidFilter : dueFilter),
      status,
      page: pageOf(q.page),
      pageSize: 25,
    },
    ready && canView,
  );
  const byDue = useChargesSummary({ ...base, ...dueFilter }, ready && canView);
  const byPaid = useChargesSummary({ ...base, ...paidFilter }, ready && canView);
  const month = useChargesSummary(
    { ...base, paidFrom: startOfMonth(today), paidTo: today },
    ready && canView && period === 'all',
  );

  if (!canView) {
    return (
      <EmptyState
        icon={Receipt}
        title="Sem acesso aos pagamentos"
        description="Seu perfil não vê valores. Peça a quem administra o sistema para liberar “Ver pagamentos e valores”."
      />
    );
  }

  const summary =
    byDue.data && byPaid.data ? { ...byDue.data.byStatus, PAID: byPaid.data.byStatus.PAID } : null;
  const presets = status === 'PAID' ? PAID_PRESETS : DUE_PRESETS;
  const dueToday = byDue.data?.dueToday;
  const filtered = period !== 'all' || !!kind || !!q.search;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pagamentos"
        description={
          dueToday && dueToday.count > 0
            ? `Hoje vencem ${plural(dueToday.count, 'cobrança', 'cobranças')} · ${formatBRL(dueToday.amount)}`
            : 'Cobranças de todos os clientes, por situação.'
        }
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)} className="w-full sm:w-auto">
              <Plus /> Nova cobrança avulsa
            </Button>
          )
        }
      />

      <PaymentStatusCards
        value={status}
        onChange={(s) =>
          setQ({
            status: s,
            page: '1',
            ...(s === 'PAID' && period === 'next7' ? { period: 'all' } : {}),
          })
        }
        summary={summary}
        hints={{
          DUE_SOON:
            dueToday && dueToday.count > 0 && period === 'all'
              ? `${plural(dueToday.count, 'vence', 'vencem')} hoje`
              : undefined,
          PAID:
            period === 'all' && month.data
              ? `Este mês: ${formatBRL(month.data.byStatus.PAID.amount)}`
              : undefined,
        }}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={q.search ?? ''}
          onChange={(v) => setQ({ search: v, page: '1' })}
          placeholder="Cliente, CPF, nº da cobrança ou contrato"
          className="lg:w-96"
        />
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <SelectMenu
            aria-label="Tipo de cobrança"
            value={q.kind ?? ''}
            onChange={(v) => setQ({ kind: v, page: '1' })}
            placeholder="Todos os tipos"
            options={CHARGE_KINDS.map((k) => ({ value: k, label: CHARGE_KIND_LABELS[k] }))}
            className="sm:w-44"
          />
          <SelectMenu
            aria-label={status === 'PAID' ? 'Período do pagamento' : 'Período do vencimento'}
            value={presets.includes(period) ? period : 'all'}
            onChange={(v) =>
              setQ({
                period: v,
                page: '1',
                ...(v === 'custom' && !q.from ? { from: startOfMonth(today), to: today } : {}),
              })
            }
            options={presets.map((p) => ({
              value: p,
              label:
                p === 'all'
                  ? PERIOD_LABELS.all
                  : `${status === 'PAID' ? 'Pago' : 'Vence'}: ${PERIOD_LABELS[p].toLowerCase()}`,
            }))}
            className="sm:w-56"
          />
        </div>
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
            <Input
              type="date"
              aria-label="De"
              value={q.from ?? ''}
              max={q.to || undefined}
              onChange={(e) => setQ({ from: e.target.value, page: '1' })}
              className="sm:w-40"
            />
            <Input
              type="date"
              aria-label="Até"
              value={q.to ?? ''}
              min={q.from || undefined}
              onChange={(e) => setQ({ to: e.target.value, page: '1' })}
              className="sm:w-40"
            />
          </div>
        )}
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start lg:self-auto"
            onClick={() =>
              setQ({ period: 'all', from: '', to: '', kind: '', search: '', page: '1' })
            }
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <Card
        className={list.isFetching && !list.isLoading ? 'opacity-70 transition-opacity' : undefined}
      >
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">
            {PAYMENT_TAB_LABELS[status]}
            {range.from && (
              <span className="ml-2 font-normal text-muted-foreground tabular">
                {range.from === range.to
                  ? formatYmd(range.from)
                  : `${formatYmd(range.from)} a ${range.to ? formatYmd(range.to) : '…'}`}
              </span>
            )}
          </h2>
          {list.data && (
            <span className="text-xs text-muted-foreground">
              {plural(list.data.total, 'cobrança', 'cobranças')}
            </span>
          )}
        </div>
        {list.error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(list.error)}</p>
        ) : (
          <ChargeList
            rows={ready ? list.data?.data : undefined}
            loading={list.isLoading || !ready}
            empty={
              filtered
                ? {
                    title: 'Nada com esses filtros',
                    description: 'Mude o período, o tipo ou a busca.',
                  }
                : EMPTY[status]
            }
          />
        )}
        {list.data && list.data.totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              total={list.data.total}
              unit="cobranças"
              onPageChange={(p) => setQ({ page: String(p) })}
            />
          </div>
        )}
      </Card>

      <NewChargeDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
