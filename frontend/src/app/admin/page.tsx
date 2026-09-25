'use client';

import { Permission, toCents } from '@locamania/shared';
import {
  AlertTriangle,
  BellRing,
  Bike,
  CalendarClock,
  ChevronRight,
  FileWarning,
  Gavel,
  Plus,
  Receipt,
  Table2,
  TrendingUp,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ColumnChart } from '@/components/charts/column-chart';
import { SegmentedBar } from '@/components/charts/segmented-bar';
import { compactBRL } from '@/components/charts/use-width';
import { ALERT_GROUPS, AlertRow, alertsOf, type AlertGroup } from '@/components/dashboard/alert-list';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips, SectionCard, StatCard } from '@/components/ui/kit';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCan, useStaff } from '@/lib/auth/use-auth';
import { errorMessage } from '@/lib/api/client';
import { visibleNav } from '@/components/layout/admin-nav';
import { useDashboard } from '@/lib/queries';
import { cn, firstName, formatBRL, plural } from '@/lib/utils';

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()));
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

/** "quinta-feira, 24 de setembro". */
function longDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

function AttentionRow({ icon: Icon, label, count, href, tone }: { icon: LucideIcon; label: string; count: number; href: string; tone: 'danger' | 'warning' | 'muted' }) {
  return (
    <Link href={href} className="flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50 sm:px-5">
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          count === 0 ? 'bg-muted text-muted-foreground' : tone === 'danger' ? 'bg-destructive/12 text-destructive' : tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <span className={cn('text-base font-semibold tabular', count === 0 && 'text-muted-foreground')}>{count}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export default function DashboardPage() {
  const staff = useStaff();
  const router = useRouter();
  const canView = useCan(Permission.DASHBOARD_VIEW);
  const canContract = useCan(Permission.CONTRACTS_MANAGE);
  const { data, isLoading, error } = useDashboard();
  const [group, setGroup] = useState<AlertGroup>('all');
  const [showAll, setShowAll] = useState(false);
  const [asTable, setAsTable] = useState(false);

  // Perfil sem o painel inicial cai na primeira tela que ele pode abrir.
  useEffect(() => {
    if (staff && !canView) {
      const first = visibleNav(staff.permissions)[0]?.items[0]?.href;
      if (first && first !== '/admin') router.replace(first);
    }
  }, [staff, canView, router]);

  if (error) {
    return <EmptyState icon={AlertTriangle} title="Não foi possível carregar o painel" description={errorMessage(error)} />;
  }

  const alerts = data ? alertsOf(data.alerts, group) : [];
  const shown = showAll ? alerts : alerts.slice(0, 8);
  const trend = data?.revenueTrend ?? null;
  const fleet = data?.fleet;
  const pay = data?.payments;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground first-letter:uppercase">{data ? longDate(data.today) : ' '}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}
            {staff ? `, ${firstName(staff.name)}` : ''}
          </h1>
        </div>
        {canContract && (
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/contracts/new">
              <Plus /> Nova locação
            </Link>
          </Button>
        )}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!data || !fleet || !pay ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Motos alugadas"
              value={`${fleet.rented} de ${fleet.total}`}
              hint={`${Math.round((fleet.rented / Math.max(fleet.total, 1)) * 100)}% da frota · ${fleet.available} livres`}
              icon={Bike}
              href="/admin/motorcycles?status=RENTED"
            />
            <StatCard
              label="Recebido no mês"
              value={pay.receivedThisMonth !== null ? formatBRL(pay.receivedThisMonth) : '—'}
              hint={pay.dueToday.count > 0 ? `${plural(pay.dueToday.count, 'vence', 'vencem')} hoje` : 'Nada vence hoje'}
              icon={Wallet}
              tone="success"
              href="/admin/payments?status=PAID"
            />
            <StatCard
              label={`A vencer em ${pay.dueNextDays.days} dias`}
              value={pay.dueNextDays.amount !== null ? formatBRL(pay.dueNextDays.amount) : pay.dueNextDays.count}
              hint={plural(pay.dueNextDays.count, 'cobrança', 'cobranças')}
              icon={CalendarClock}
              tone="warning"
              href="/admin/payments?status=DUE_SOON"
            />
            <StatCard
              label="Em atraso"
              value={pay.overdue.amount !== null ? formatBRL(pay.overdue.amount) : pay.overdue.count}
              hint={`${plural(pay.overdue.count, 'cobrança', 'cobranças')} · ${plural(data.customers.delinquent, 'cliente', 'clientes')}`}
              icon={AlertTriangle}
              tone="danger"
              href="/admin/delinquency"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        {/* Receita semanal */}
        {(trend || isLoading) && (
          <SectionCard
            className="order-4 lg:order-1 lg:col-span-2"
            title="Receita por semana"
            description="Pagamentos recebidos nas últimas 12 semanas"
            actions={
              trend && (
                <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
                  {asTable ? <TrendingUp /> : <Table2 />}
                  <span className="hidden sm:inline">{asTable ? 'Gráfico' : 'Tabela'}</span>
                </Button>
              )
            }
          >
            {!trend ? (
              <Skeleton className="h-[220px] w-full" />
            ) : asTable ? (
              <div className="max-h-[260px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Semana de</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trend.map((w, i) => (
                      <TableRow key={w.start}>
                        <TableCell>
                          {w.label}
                          {i === trend.length - 1 && <span className="ml-1 text-xs text-muted-foreground">(em andamento)</span>}
                        </TableCell>
                        <TableCell className="text-right tabular">{formatBRL(w.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <ColumnChart
                ariaLabel="Receita por semana nas últimas 12 semanas"
                data={trend.map((w, i) => ({
                  key: w.start,
                  label: w.label,
                  title: `Semana de ${w.label}`,
                  value: toCents(w.amount) / 100,
                  partial: i === trend.length - 1,
                }))}
                format={(v) => formatBRL(v)}
                formatAxis={compactBRL}
              />
            )}
          </SectionCard>
        )}

        {/* Frota */}
        <SectionCard className="order-3 lg:order-2" title="Frota" description={fleet ? plural(fleet.total, 'moto cadastrada', 'motos cadastradas') : undefined}>
          {!fleet ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <SegmentedBar
              total={fleet.total}
              segments={[
                { key: 'RENTED', label: 'Alugadas', value: fleet.rented, colorClass: 'bg-chart-1', href: '/admin/motorcycles?status=RENTED' },
                { key: 'AVAILABLE', label: 'Disponíveis', value: fleet.available, colorClass: 'bg-chart-2', href: '/admin/motorcycles?status=AVAILABLE' },
                { key: 'RESERVED', label: 'Reservadas', value: fleet.reserved, colorClass: 'bg-chart-5', href: '/admin/motorcycles?status=RESERVED' },
                { key: 'MAINTENANCE', label: 'Em manutenção', value: fleet.maintenance, colorClass: 'bg-chart-3', href: '/admin/motorcycles?status=MAINTENANCE' },
                { key: 'BLOCKED', label: 'Bloqueadas', value: fleet.blocked, colorClass: 'bg-chart-4', href: '/admin/motorcycles?status=BLOCKED' },
                { key: 'INACTIVE', label: 'Inativas', value: fleet.inactive, colorClass: 'bg-muted-foreground/40', href: '/admin/motorcycles?status=INACTIVE' },
              ]}
            />
          )}
          {fleet && data && (
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <dt className="text-xs text-muted-foreground">Ocupação</dt>
                <dd className="text-lg font-semibold">{Math.round((fleet.rented / Math.max(fleet.total - fleet.inactive, 1)) * 100)}%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Clientes com moto</dt>
                <dd className="text-lg font-semibold">{data.customers.active}</dd>
              </div>
            </dl>
          )}
        </SectionCard>

        {/* Alertas */}
        <SectionCard
          className="order-2 lg:order-3 lg:col-span-2"
          title="Alertas"
          description={data ? (data.alerts.length ? plural(data.alerts.length, 'item pede atenção', 'itens pedem atenção') : 'Tudo em dia') : undefined}
          contentClassName="p-0 sm:p-0"
        >
          {!data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="px-4 pb-3 sm:px-5">
                <FilterChips
                  value={group}
                  onChange={(g) => {
                    setGroup(g);
                    setShowAll(false);
                  }}
                  options={(Object.keys(ALERT_GROUPS) as AlertGroup[]).map((g) => ({
                    value: g,
                    label: ALERT_GROUPS[g].label,
                    count: alertsOf(data.alerts, g).length,
                  }))}
                />
              </div>
              {alerts.length === 0 ? (
                <EmptyState icon={BellRing} title="Nenhum alerta aqui" description="Quando algo pedir atenção, aparece nesta lista." className="py-10" />
              ) : (
                <div className="divide-y divide-border border-t border-border">
                  {shown.map((a) => (
                    <AlertRow key={a.id} alert={a} />
                  ))}
                </div>
              )}
              {alerts.length > shown.length && (
                <div className="border-t border-border p-2">
                  <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>
                    Ver todos ({alerts.length})
                  </Button>
                </div>
              )}
            </>
          )}
        </SectionCard>

        {/* Atenção */}
        <SectionCard className="order-1 lg:order-4 lg:self-start" title="Para hoje" contentClassName="p-0 sm:p-0">
          {!data ? (
            <Skeleton className="m-4 h-48" />
          ) : (
            <div className="divide-y divide-border border-t border-border">
              <AttentionRow icon={Receipt} label="Clientes em atraso" count={data.customers.delinquent} href="/admin/delinquency" tone="danger" />
              <AttentionRow icon={Gavel} label="Em cobrança" count={data.customers.inCollection} href="/admin/delinquency?tab=collection" tone="danger" />
              <AttentionRow icon={Wrench} label="Manutenções atrasadas" count={data.maintenanceOverdue} href="/admin/maintenance?tab=overdue" tone="danger" />
              <AttentionRow icon={Wrench} label="Manutenções próximas" count={data.maintenanceDueSoon} href="/admin/maintenance?tab=upcoming" tone="warning" />
              <AttentionRow icon={CalendarClock} label="Contratos terminando" count={data.contractsEndingSoon} href="/admin/contracts?ending=1" tone="warning" />
              <AttentionRow icon={FileWarning} label="Documentos vencendo" count={data.documentsExpiring} href="/admin/documents?tab=expiring" tone="warning" />
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
