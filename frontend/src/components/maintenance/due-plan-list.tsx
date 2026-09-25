'use client';

import {
  MOTORCYCLE_STATUS_LABELS,
  type MaintenancePlanDto,
  type MotorcycleStatus,
} from '@locamania/shared';
import { CalendarPlus, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Plate } from '@/components/motorcycles/plate';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { MaintenanceDueBadge } from '@/components/ui/status-badge';
import { cn, formatKm } from '@/lib/utils';
import { dueText, intervalText, lastDoneText, nextDueText } from './due-text';

/** Planos vencidos ou próximos da frota (§8): o que precisa ser agendado. */
export function DuePlanList({
  rows,
  loading,
  onSchedule,
  canCustomers,
  empty,
}: {
  rows: MaintenancePlanDto[] | undefined;
  loading?: boolean;
  onSchedule?: (plan: MaintenancePlanDto) => void;
  canCustomers?: boolean;
  empty: { title: string; description?: string; action?: React.ReactNode };
}) {
  const router = useRouter();
  const open = (p: MaintenancePlanDto) =>
    router.push(`/admin/motorcycles/${p.motorcycle.id}?tab=maintenance`);

  const columns: Column<MaintenancePlanDto>[] = [
    {
      key: 'moto',
      header: 'Moto',
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <Plate plate={p.motorcycle.plate} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{p.motorcycle.label}</p>
            <p className="text-xs text-muted-foreground tabular">
              {formatKm(p.motorcycle.currentKm)} ·{' '}
              {MOTORCYCLE_STATUS_LABELS[p.motorcycle.status as MotorcycleStatus]?.toLowerCase() ??
                ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Serviço',
      cell: (p) => (
        <div className="min-w-36">
          <p className="font-medium">{p.type.name}</p>
          <p className="whitespace-nowrap text-xs text-muted-foreground">{intervalText(p)}</p>
        </div>
      ),
    },
    {
      key: 'due',
      header: 'Situação',
      cell: (p) => (
        <div className="space-y-1 whitespace-nowrap">
          <MaintenanceDueBadge status={p.due.status} />
          <p
            className={cn(
              'text-xs font-medium',
              p.due.status === 'OVERDUE' ? 'text-destructive' : 'text-warning',
            )}
          >
            {dueText(p.due)}
          </p>
        </div>
      ),
    },
    {
      key: 'next',
      header: 'Prevista para',
      cell: (p) => (
        <div className="whitespace-nowrap">
          <p className="text-sm tabular">{nextDueText(p)}</p>
          <p className="text-xs text-muted-foreground tabular">Última: {lastDoneText(p)}</p>
        </div>
      ),
    },
    {
      key: 'renter',
      header: 'Com o cliente',
      hideBelow: 'lg',
      cell: (p) =>
        p.renter ? (
          canCustomers ? (
            <Link
              href={`/admin/customers/${p.renter.id}`}
              onClick={(e) => e.stopPropagation()}
              className="block max-w-48 truncate text-sm font-medium text-primary hover:underline"
            >
              {p.renter.name}
            </Link>
          ) : (
            <span className="block max-w-48 truncate text-sm">{p.renter.name}</span>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    ...(onSchedule
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            cell: (p: MaintenancePlanDto) => (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onSchedule(p);
                }}
              >
                <CalendarPlus /> Agendar
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      rows={rows}
      loading={loading}
      columns={columns}
      rowKey={(p) => p.id}
      onRowClick={open}
      rowClassName={(p) => (p.due.status === 'OVERDUE' ? 'bg-destructive/[0.03]' : undefined)}
      empty={{ icon: Wrench, ...empty }}
      mobileCard={(p) => (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Plate plate={p.motorcycle.plate} />
              <span className="truncate text-[15px] font-medium">{p.type.name}</span>
            </div>
            <MaintenanceDueBadge status={p.due.status} className="shrink-0" />
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {p.motorcycle.label}
            {p.renter ? ` · ${p.renter.name}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span
              className={cn(
                'font-medium',
                p.due.status === 'OVERDUE' ? 'text-destructive' : 'text-warning',
              )}
            >
              {dueText(p.due)}
            </span>
            <span className="tabular">Prevista: {nextDueText(p)}</span>
          </div>
        </div>
      )}
    />
  );
}
