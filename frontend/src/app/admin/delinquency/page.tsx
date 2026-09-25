'use client';

import {
  CUSTOMER_STATUS_LABELS,
  Permission,
  formatPhone,
  formatPlate,
  fromCents,
  normalizeText,
  toCents,
  type CustomerListItemDto,
  type CustomerStatus,
  type DelinquentCustomerDto,
} from '@locamania/shared';
import { AlertTriangle, CalendarX2, CheckCircle2, Gavel, Receipt, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { PaymentsLink, useDelinquencyActions } from '@/components/payments/delinquency-actions';
import { WhatsAppIcon } from '@/components/shared/whatsapp-icon';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips, SearchInput, StatCard, Toolbar } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomerStatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useDelinquentsIf } from '@/lib/contracts/queries';
import { useCustomers } from '@/lib/queries';
import { useUrlState } from '@/lib/use-url-state';
import { cn, formatBRL, formatYmd, plural } from '@/lib/utils';

/** Busca sem acento e sem caixa ("joão" acha "Joao"). */
const normalizeSearch = (v: string) => normalizeText(v).toLowerCase();

type Bucket = 'all' | 'd7' | 'd30' | 'more';
const BUCKETS: { value: Bucket; label: string; test: (d: number) => boolean }[] = [
  { value: 'all', label: 'Todos', test: () => true },
  { value: 'd7', label: 'Até 7 dias', test: (d) => d <= 7 },
  { value: 'd30', label: '8 a 30 dias', test: (d) => d > 7 && d <= 30 },
  { value: 'more', label: 'Mais de 30 dias', test: (d) => d > 30 },
];

function WhatsAppButton({
  href,
  compact,
  className,
}: {
  href: string | null;
  compact?: boolean;
  className?: string;
}) {
  if (!href) return null;
  return (
    <Button asChild variant="outline" className={className} size={compact ? 'icon' : 'default'}>
      <a href={href} target="_blank" rel="noreferrer" aria-label="Cobrar no WhatsApp">
        <WhatsAppIcon className="size-4 text-success" />
        {!compact && 'Cobrar'}
      </a>
    </Button>
  );
}

function DaysLate({ days, since }: { days: number; since: string }) {
  return (
    <div>
      <p
        className={cn(
          'font-semibold tabular',
          days > 30 ? 'text-destructive' : days > 7 ? 'text-warning' : undefined,
        )}
      >
        {plural(days, 'dia', 'dias')}
      </p>
      <p className="text-xs text-muted-foreground tabular">desde {formatYmd(since)}</p>
    </div>
  );
}

// ───────────────────────────── Aba: em atraso ─────────────────────────────

function OverdueTab({
  rows,
  loading,
  error,
  q,
  setQ,
}: {
  rows: DelinquentCustomerDto[] | undefined;
  loading: boolean;
  error: unknown;
  q: { days?: string; search?: string };
  setQ: (patch: { days?: string; search?: string }) => void;
}) {
  const actions = useDelinquencyActions();
  const bucket = (BUCKETS.find((b) => b.value === q.days)?.value ?? 'all') as Bucket;
  const term = normalizeSearch(q.search ?? '');
  const shown = useMemo(
    () =>
      rows?.filter(
        (r) =>
          BUCKETS.find((b) => b.value === bucket)!.test(r.daysLate) &&
          (!term ||
            normalizeSearch(r.customer.name).includes(term) ||
            (r.motorcycle &&
              r.motorcycle.plate.toLowerCase().includes(term.replace(/[^a-z0-9]/g, '')))),
      ),
    [rows, bucket, term],
  );
  const target = (r: DelinquentCustomerDto) => ({
    id: r.customer.id,
    name: r.customer.name,
    status: r.customer.status,
    inCollection: r.customer.inCollection,
    daysLate: r.daysLate,
  });

  const columns: Column<DelinquentCustomerDto>[] = [
    {
      key: 'customer',
      header: 'Cliente',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.customer.name} />
          <div className="min-w-0">
            <Link
              href={`/admin/customers/${r.customer.id}`}
              className="block truncate font-medium hover:underline"
            >
              {r.customer.name}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <CustomerStatusBadge status={r.customer.status as CustomerStatus} />
              {r.customer.inCollection && <Badge variant="destructive">Em cobrança</Badge>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'moto',
      header: 'Moto',
      hideBelow: 'xl',
      cell: (r) =>
        r.motorcycle ? (
          <div>
            <p className="whitespace-nowrap font-mono text-sm">{formatPlate(r.motorcycle.plate)}</p>
            <p className="text-xs text-muted-foreground">{r.motorcycle.label}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Sem moto</span>
        ),
    },
    {
      key: 'days',
      header: 'Atraso',
      cell: (r) => <DaysLate days={r.daysLate} since={r.oldestDueDate} />,
    },
    {
      key: 'amount',
      header: 'Em atraso',
      align: 'right',
      cell: (r) => (
        <div>
          <p className="whitespace-nowrap">{formatBRL(r.overdueAmount)}</p>
          <p className="text-xs text-muted-foreground">
            {plural(r.overdueCount, 'cobrança', 'cobranças')}
          </p>
        </div>
      ),
    },
    {
      key: 'fees',
      header: 'Com encargos',
      align: 'right',
      cell: (r) => (
        <span className="whitespace-nowrap font-semibold text-destructive">
          {formatBRL(r.totalWithFees)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-px',
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <WhatsAppButton href={r.whatsappLink} />
          <PaymentsLink customerId={r.customer.id} className="hidden 2xl:inline-flex" />
          {actions.menu(target(r))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Toolbar>
        <FilterChips
          value={bucket}
          onChange={(v) => setQ({ days: v })}
          options={BUCKETS.map((b) => ({
            value: b.value,
            label: b.label,
            count: rows ? rows.filter((r) => b.test(r.daysLate)).length : undefined,
            tone: b.value === 'more' ? 'danger' : b.value === 'd30' ? 'warning' : undefined,
          }))}
        />
        <SearchInput
          value={q.search ?? ''}
          onChange={(v) => setQ({ search: v })}
          placeholder="Nome do cliente ou placa"
          className="lg:w-72"
        />
      </Toolbar>
      <Card>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <DataTable
            rows={shown}
            loading={loading}
            columns={columns}
            rowKey={(r) => r.customer.id}
            rowClassName={(r) => (r.daysLate > 30 ? 'bg-destructive/[0.03]' : undefined)}
            empty={
              rows && rows.length === 0
                ? {
                    icon: CheckCircle2,
                    title: 'Ninguém em atraso',
                    description: 'Todos os clientes estão com os pagamentos em dia.',
                  }
                : {
                    icon: Users,
                    title: 'Ninguém nesse filtro',
                    description: 'Mude a faixa de dias ou a busca.',
                  }
            }
            mobileCard={(r) => (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar name={r.customer.name} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/customers/${r.customer.id}`}
                      className="block truncate text-[15px] font-medium"
                    >
                      {r.customer.name}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                      {r.motorcycle
                        ? `${formatPlate(r.motorcycle.plate)} · ${r.motorcycle.label}`
                        : r.customer.phone
                          ? formatPhone(r.customer.phone)
                          : 'Sem moto'}
                    </p>
                    <p className="mt-1 text-xs">
                      <span
                        className={cn(
                          'font-semibold',
                          r.daysLate > 30
                            ? 'text-destructive'
                            : r.daysLate > 7
                              ? 'text-warning'
                              : undefined,
                        )}
                      >
                        {plural(r.daysLate, 'dia', 'dias')} de atraso
                      </span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {plural(r.overdueCount, 'cobrança', 'cobranças')} · sem encargos{' '}
                        {formatBRL(r.overdueAmount)}
                      </span>
                    </p>
                    {(r.customer.inCollection || r.customer.status === 'BLOCKED') && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.customer.inCollection && (
                          <Badge variant="destructive">Em cobrança</Badge>
                        )}
                        {r.customer.status === 'BLOCKED' && (
                          <Badge variant="destructive">Bloqueado</Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-destructive tabular">
                    {formatBRL(r.totalWithFees)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <WhatsAppButton href={r.whatsappLink} className="flex-1" />
                  <PaymentsLink customerId={r.customer.id} className="flex-1" />
                  {actions.menu(target(r), { showPayments: false })}
                </div>
              </div>
            )}
          />
        )}
      </Card>
      {actions.dialogs}
    </div>
  );
}

// ───────────────────────────── Aba: em cobrança ─────────────────────────────

function CollectionTab({ delinquents }: { delinquents: DelinquentCustomerDto[] | undefined }) {
  const { data, isLoading, error } = useCustomers({ inCollection: true, pageSize: 100 });
  const actions = useDelinquencyActions();
  const byId = useMemo(
    () => new Map((delinquents ?? []).map((d) => [d.customer.id, d])),
    [delinquents],
  );
  const target = (c: CustomerListItemDto) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    inCollection: true,
    daysLate: byId.get(c.id)?.daysLate,
  });

  const columns: Column<CustomerListItemDto>[] = [
    {
      key: 'customer',
      header: 'Cliente',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} />
          <div className="min-w-0">
            <Link
              href={`/admin/customers/${c.id}`}
              className="block truncate font-medium hover:underline"
            >
              {c.name}
            </Link>
            <p className="text-xs text-muted-foreground tabular">
              {c.phone ? formatPhone(c.phone) : CUSTOMER_STATUS_LABELS[c.status]}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Situação', cell: (c) => <CustomerStatusBadge status={c.status} /> },
    {
      key: 'moto',
      header: 'Moto',
      hideBelow: 'lg',
      cell: (c) =>
        c.currentMotorcycle ? (
          <span className="whitespace-nowrap font-mono text-sm">
            {formatPlate(c.currentMotorcycle.plate)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sem moto</span>
        ),
    },
    {
      key: 'days',
      header: 'Atraso',
      cell: (c) => {
        const d = byId.get(c.id);
        return d ? (
          <DaysLate days={d.daysLate} since={d.oldestDueDate} />
        ) : (
          <span className="text-xs text-muted-foreground">Sem atraso agora</span>
        );
      },
    },
    {
      key: 'amount',
      header: 'Com encargos',
      align: 'right',
      cell: (c) => {
        const d = byId.get(c.id);
        return d ? (
          <span className="font-semibold text-destructive">{formatBRL(d.totalWithFees)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-px',
      cell: (c) => (
        <div className="flex justify-end gap-2">
          <WhatsAppButton href={byId.get(c.id)?.whatsappLink ?? null} />
          {actions.menu(target(c))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Clientes encaminhados para cobrança (manualmente ou pela regra de dias de atraso em
        Configurações › Inadimplência).
      </p>
      <Card>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <DataTable
            rows={data?.data}
            loading={isLoading}
            columns={columns}
            rowKey={(c) => c.id}
            empty={{
              icon: Gavel,
              title: 'Ninguém em cobrança',
              description: 'Use "Encaminhar para cobrança" na aba Em atraso.',
            }}
            mobileCard={(c) => {
              const d = byId.get(c.id);
              return (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={c.name} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="block truncate text-[15px] font-medium"
                      >
                        {c.name}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">
                        {c.currentMotorcycle
                          ? `${formatPlate(c.currentMotorcycle.plate)} · ${c.currentMotorcycle.label}`
                          : 'Sem moto'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        {d ? (
                          <span className="font-semibold text-destructive">
                            {plural(d.daysLate, 'dia', 'dias')} de atraso
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Sem atraso agora</span>
                        )}
                        <CustomerStatusBadge status={c.status} />
                      </div>
                    </div>
                    {d && (
                      <p className="shrink-0 text-sm font-semibold text-destructive tabular">
                        {formatBRL(d.totalWithFees)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <WhatsAppButton href={d?.whatsappLink ?? null} className="flex-1" />
                    <PaymentsLink customerId={c.id} className="flex-1" />
                    {actions.menu(target(c), { showPayments: false })}
                  </div>
                </div>
              );
            }}
          />
        )}
      </Card>
      {actions.dialogs}
    </div>
  );
}

// ───────────────────────────── Página ─────────────────────────────

/** Inadimplência (§14): quem está devendo, há quanto tempo e quanto — e as ações de cobrança. */
export default function DelinquencyPage() {
  const canView = useCan(Permission.PAYMENTS_VIEW);
  const [q, setQ] = useUrlState({ tab: 'overdue', days: 'all', search: '' });
  const { data, isLoading, error } = useDelinquentsIf(canView);
  const collection = useCustomers({ inCollection: true, pageSize: 1 }, canView);

  if (!canView) {
    return (
      <EmptyState
        icon={Receipt}
        title="Sem acesso à inadimplência"
        description="Seu perfil não vê valores. Peça a quem administra o sistema para liberar “Ver pagamentos e valores”."
      />
    );
  }

  const total = data ? fromCents(data.reduce((a, r) => a + toCents(r.overdueAmount), 0)) : null;
  const withFees = data ? fromCents(data.reduce((a, r) => a + toCents(r.totalWithFees), 0)) : null;
  const charges = data ? data.reduce((a, r) => a + r.overdueCount, 0) : 0;
  const oldest = data?.[0];
  const tab = q.tab === 'collection' ? 'collection' : 'overdue';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inadimplência"
        description="Clientes com pagamento em atraso, do mais antigo para o mais recente."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Clientes em atraso"
              value={data.length}
              hint={plural(charges, 'cobrança vencida', 'cobranças vencidas')}
              icon={Users}
              tone={data.length ? 'danger' : 'success'}
            />
            <StatCard
              label="Total em atraso"
              value={formatBRL(total)}
              hint={`com encargos ${formatBRL(withFees)}`}
              icon={AlertTriangle}
              tone="danger"
            />
            <StatCard
              label="Atraso mais antigo"
              value={oldest ? plural(oldest.daysLate, 'dia', 'dias') : '—'}
              hint={oldest?.customer.name ?? 'Ninguém em atraso'}
              icon={CalendarX2}
              tone="warning"
            />
            <StatCard
              label="Em cobrança"
              value={collection.data?.total ?? '—'}
              hint="encaminhados"
              icon={Gavel}
              tone="muted"
            />
          </>
        )}
      </div>

      <Tabs defaultValue="overdue" value={tab} onValueChange={(t) => setQ({ tab: t })}>
        <TabsList>
          <TabsTrigger value="overdue">Em atraso{data ? ` (${data.length})` : ''}</TabsTrigger>
          <TabsTrigger value="collection">
            Em cobrança{collection.data ? ` (${collection.data.total})` : ''}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overdue" className="pt-5">
          <OverdueTab rows={data} loading={isLoading} error={error} q={q} setQ={setQ} />
        </TabsContent>
        <TabsContent value="collection" className="pt-5">
          <CollectionTab delinquents={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
