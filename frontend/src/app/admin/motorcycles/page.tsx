'use client';

import {
  MAINTENANCE_DUE_LABELS,
  ParameterKey,
  Permission,
  type MaintenanceDueStatus,
  type MotorcycleListItemDto,
  type MotorcycleStatus,
} from '@locamania/shared';
import { Bike, Plus, Satellite } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { nextMaintenanceText } from '@/components/maintenance/due-text';
import { Plate } from '@/components/motorcycles/plate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterChips, SearchInput, Toolbar } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SelectMenu } from '@/components/ui/select-menu';
import { MaintenanceDueBadge, MotorcycleStatusBadge } from '@/components/ui/status-badge';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useNumberParameter } from '@/lib/motorcycles/queries';
import { useDashboard, useMotorcycles } from '@/lib/queries';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { cn, formatKm, plural } from '@/lib/utils';

type Filter = 'all' | MotorcycleStatus;
const FILTERS: {
  value: Filter;
  label: string;
  fleetKey?: 'total' | 'available' | 'rented' | 'reserved' | 'maintenance' | 'blocked' | 'inactive';
}[] = [
  { value: 'all', label: 'Todas' },
  { value: 'AVAILABLE', label: 'Disponíveis', fleetKey: 'available' },
  { value: 'RENTED', label: 'Alugadas', fleetKey: 'rented' },
  { value: 'RESERVED', label: 'Reservadas', fleetKey: 'reserved' },
  { value: 'MAINTENANCE', label: 'Em manutenção', fleetKey: 'maintenance' },
  { value: 'BLOCKED', label: 'Bloqueadas', fleetKey: 'blocked' },
  { value: 'INACTIVE', label: 'Inativas', fleetKey: 'inactive' },
];

const MAINT_OPTIONS: { value: '' | MaintenanceDueStatus; label: string }[] = [
  { value: '', label: 'Manutenção: todas' },
  { value: 'OVERDUE', label: `Manutenção ${MAINTENANCE_DUE_LABELS.OVERDUE.toLowerCase()}` },
  { value: 'DUE_SOON', label: `Manutenção ${MAINTENANCE_DUE_LABELS.DUE_SOON.toLowerCase()}` },
  { value: 'OK', label: `Manutenção ${MAINTENANCE_DUE_LABELS.OK.toLowerCase()}` },
];

/** 0 → "desde hoje"; 5 → "5 dias". */
const idleText = (days: number) => (days === 0 ? 'desde hoje' : plural(days, 'dia', 'dias'));

function MaintenanceCell({ m }: { m: MotorcycleListItemDto }) {
  if (!m.nextMaintenance) return <MaintenanceDueBadge status={m.maintenanceDue} />;
  return (
    <div className="min-w-0 space-y-1">
      <MaintenanceDueBadge status={m.maintenanceDue} />
      <p className="truncate text-xs text-muted-foreground">
        {m.nextMaintenance.typeName} · {nextMaintenanceText(m.nextMaintenance)}
      </p>
    </div>
  );
}

/** Cartão do celular: placa e modelo na primeira linha, quem está com ela, km e manutenção. */
function MobileCard({ m, idleLimit }: { m: MotorcycleListItemDto; idleLimit: number }) {
  const who = m.currentRental
    ? m.currentRental.customerName
    : m.idleDays !== null
      ? m.idleDays === 0
        ? 'Disponível desde hoje'
        : `Parada há ${plural(m.idleDays, 'dia', 'dias')}`
      : m.statusReason;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Plate plate={m.plate} />
          <span className="truncate text-[15px] font-medium">{m.label}</span>
        </div>
        <MotorcycleStatusBadge status={m.status} className="shrink-0" />
      </div>
      {who && (
        <p
          className={cn(
            'truncate text-sm text-muted-foreground',
            m.idleDays !== null && m.idleDays >= idleLimit && 'text-warning',
          )}
        >
          {who}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span className="tabular">{formatKm(m.currentKm)}</span>
        {m.nextMaintenance ? (
          <span
            className={cn(
              m.maintenanceDue === 'OVERDUE' && 'font-medium text-destructive',
              m.maintenanceDue === 'DUE_SOON' && 'font-medium text-warning',
            )}
          >
            {m.maintenanceDue !== 'OK' && `${MAINTENANCE_DUE_LABELS[m.maintenanceDue]}: `}
            {m.nextMaintenance.typeName} · {nextMaintenanceText(m.nextMaintenance)}
          </span>
        ) : (
          m.maintenanceDue !== 'OK' && (
            <span className="font-medium text-destructive">
              {MAINTENANCE_DUE_LABELS[m.maintenanceDue]}
            </span>
          )
        )}
        {m.hasTracker && (
          <span className="inline-flex items-center gap-1">
            <Satellite className="size-3.5 text-primary" aria-hidden /> Rastreador
          </span>
        )}
      </div>
    </div>
  );
}

export default function MotorcyclesPage() {
  const router = useRouter();
  const canManage = useCan(Permission.MOTORCYCLES_MANAGE);
  const canDashboard = useCan(Permission.DASHBOARD_VIEW);
  const canCustomers = useCan(Permission.CUSTOMERS_VIEW);
  const idleLimit = useNumberParameter(ParameterKey.IDLE_MOTORCYCLE_DAYS, 7);
  const [q, setQ, ready] = useUrlState({ status: 'all', maintenance: '', search: '', page: '1' });
  const filter = (FILTERS.some((f) => f.value === q.status) ? q.status : 'all') as Filter;
  const maintenance = (
    MAINT_OPTIONS.some((o) => o.value === q.maintenance) ? q.maintenance : ''
  ) as '' | MaintenanceDueStatus;
  const { data, isLoading, error, isFetching } = useMotorcycles(
    {
      search: q.search || undefined,
      page: pageOf(q.page),
      pageSize: 20,
      status: filter !== 'all' ? filter : undefined,
      maintenanceDue: maintenance || undefined,
    },
    ready,
  );
  const fleet = useDashboard().data?.fleet;
  const fleetCounts = canDashboard ? fleet : undefined;

  const customerLink = (m: MotorcycleListItemDto) =>
    m.currentRental ? (
      canCustomers ? (
        <Link
          href={`/admin/customers/${m.currentRental.customerId}`}
          onClick={(e) => e.stopPropagation()}
          className="block max-w-56 truncate text-sm font-medium text-primary hover:underline"
        >
          {m.currentRental.customerName}
        </Link>
      ) : (
        <span className="block max-w-56 truncate text-sm">{m.currentRental.customerName}</span>
      )
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  const columns: Column<MotorcycleListItemDto>[] = [
    {
      key: 'moto',
      header: 'Moto',
      cell: (m) => (
        <div className="flex items-center gap-3">
          <Plate plate={m.plate} />
          <div className="min-w-0">
            <p className="truncate font-medium">{m.label}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {[m.modelYear ?? m.manufactureYear, m.color].filter(Boolean).join(' · ') || '—'}
              {m.hasTracker && (
                <Satellite className="size-3.5 shrink-0 text-primary" aria-label="Com rastreador" />
              )}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Situação',
      cell: (m) => (
        <div className="min-w-0 max-w-60 space-y-1">
          <MotorcycleStatusBadge status={m.status} />
          {m.statusReason && m.status !== 'RENTED' && (
            <p className="truncate text-xs text-muted-foreground" title={m.statusReason}>
              {m.statusReason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'km',
      header: 'Km atual',
      align: 'right',
      cell: (m) => <span className="whitespace-nowrap">{formatKm(m.currentKm)}</span>,
    },
    { key: 'customer', header: 'Cliente atual', hideBelow: 'lg', cell: customerLink },
    { key: 'maintenance', header: 'Manutenção', cell: (m) => <MaintenanceCell m={m} /> },
    {
      key: 'idle',
      header: 'Parada',
      align: 'right',
      hideBelow: 'xl',
      cell: (m) =>
        m.idleDays !== null ? (
          <span
            className={cn(
              'whitespace-nowrap',
              m.idleDays >= idleLimit && 'font-medium text-warning',
            )}
          >
            {idleText(m.idleDays)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const chipOptions = FILTERS.map((f) => ({
    value: f.value,
    label: f.label,
    count: fleetCounts && f.fleetKey ? fleetCounts[f.fleetKey] : undefined,
    tone:
      f.value === 'BLOCKED'
        ? ('danger' as const)
        : f.value === 'MAINTENANCE'
          ? ('warning' as const)
          : undefined,
  }));

  const hasFilters = !!q.search || filter !== 'all' || !!maintenance;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Motos"
        description={
          !data
            ? 'Frota, situação, quilometragem e manutenção.'
            : hasFilters
              ? data.total === 0
                ? 'Nenhuma moto encontrada'
                : plural(data.total, 'moto encontrada', 'motos encontradas')
              : plural(data.total, 'moto na frota', 'motos na frota')
        }
        actions={
          canManage && (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/motorcycles/new">
                <Plus /> Nova moto
              </Link>
            </Button>
          )
        }
      />
      <div className="space-y-3">
        <FilterChips
          value={filter}
          onChange={(v) => setQ({ status: v, page: '1' })}
          options={chipOptions}
        />
        <Toolbar className="lg:justify-start">
          <SearchInput
            value={q.search ?? ''}
            onChange={(v) => setQ({ search: v, page: '1' })}
            placeholder="Placa, modelo, RENAVAM ou chassi"
            className="lg:w-80"
          />
          <SelectMenu
            value={maintenance}
            onChange={(v) => setQ({ maintenance: v, page: '1' })}
            options={MAINT_OPTIONS.filter((o) => o.value !== '').map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            placeholder={MAINT_OPTIONS[0]!.label}
            aria-label="Filtrar por manutenção"
            className="lg:w-60"
          />
        </Toolbar>
      </div>
      <Card className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : undefined}>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <DataTable
            rows={ready ? data?.data : undefined}
            loading={isLoading || !ready}
            columns={columns}
            rowKey={(m) => m.id}
            onRowClick={(m) => router.push(`/admin/motorcycles/${m.id}`)}
            rowClassName={(m) =>
              m.status === 'BLOCKED' || m.maintenanceDue === 'OVERDUE'
                ? 'bg-destructive/[0.03]'
                : undefined
            }
            empty={{
              icon: Bike,
              title: q.search ? 'Nenhuma moto encontrada' : 'Nenhuma moto aqui',
              description: q.search
                ? 'Tente outra placa ou modelo.'
                : hasFilters
                  ? 'Nenhuma moto com esse filtro.'
                  : 'Cadastre a primeira moto da frota.',
              action:
                !hasFilters && canManage ? (
                  <Button asChild>
                    <Link href="/admin/motorcycles/new">
                      <Plus /> Nova moto
                    </Link>
                  </Button>
                ) : undefined,
            }}
            mobileCard={(m) => <MobileCard m={m} idleLimit={idleLimit} />}
          />
        )}
        {data && data.totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              unit="motos"
              onPageChange={(p) => setQ({ page: String(p) })}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
