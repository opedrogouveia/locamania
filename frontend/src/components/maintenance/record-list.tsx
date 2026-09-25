'use client';

import { todayYmd, type MaintenanceRecordDto } from '@locamania/shared';
import { CheckCircle2, Paperclip, Play, Wrench } from 'lucide-react';

import { Plate } from '@/components/motorcycles/plate';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { MaintenanceStatusBadge } from '@/components/ui/status-badge';
import { cn, formatBRL, formatKm, formatYmd, relativeDays } from '@/lib/utils';

/** Data que importa em cada situação: agendada → quando vai; em andamento → desde; realizada → quando. */
function whenText(
  r: MaintenanceRecordDto,
  today: string,
): { label: string; date: string | null; late: boolean } {
  if (r.status === 'SCHEDULED')
    return {
      label: 'Agendada',
      date: r.scheduledFor,
      late: !!r.scheduledFor && r.scheduledFor < today,
    };
  if (r.status === 'IN_PROGRESS') return { label: 'Desde', date: r.startedAt, late: false };
  if (r.status === 'DONE') return { label: 'Feita em', date: r.completedAt, late: false };
  return { label: 'Cancelada', date: r.scheduledFor ?? r.startedAt, late: false };
}

/** Lista de registros de manutenção (página de manutenção e ficha da moto). */
export function MaintenanceRecordList({
  rows,
  loading,
  hideMotorcycle,
  showStatus,
  showCost,
  onOpen,
  onStart,
  onComplete,
  empty,
}: {
  rows: MaintenanceRecordDto[] | undefined;
  loading?: boolean;
  hideMotorcycle?: boolean;
  showStatus?: boolean;
  /** Coluna de valor (quem vê o financeiro). */
  showCost?: boolean;
  onOpen: (r: MaintenanceRecordDto) => void;
  onStart?: (r: MaintenanceRecordDto) => void;
  onComplete?: (r: MaintenanceRecordDto) => void;
  empty: { title: string; description?: string; action?: React.ReactNode };
}) {
  const today = todayYmd();
  const hasActions =
    !!(onStart || onComplete) &&
    (rows ?? []).some((r) => r.status === 'SCHEDULED' || r.status === 'IN_PROGRESS');

  const columns: Column<MaintenanceRecordDto>[] = [
    ...(hideMotorcycle
      ? []
      : [
          {
            key: 'moto',
            header: 'Moto',
            cell: (r: MaintenanceRecordDto) => (
              <div className="flex items-center gap-2.5">
                <Plate plate={r.motorcycle.plate} />
                <span className="truncate text-sm text-muted-foreground">{r.motorcycle.label}</span>
              </div>
            ),
          },
        ]),
    {
      key: 'types',
      header: 'Serviços',
      cell: (r) => (
        <div className="min-w-0 max-w-sm">
          <p className="font-medium">
            {r.types.map((t) => t.name).join(', ')}
            {r.documentsCount > 0 && (
              <span
                className="ml-2 inline-flex items-center gap-0.5 align-middle text-xs font-normal text-muted-foreground"
                title={`${r.documentsCount} anexo(s)`}
              >
                <Paperclip className="size-3" aria-hidden /> {r.documentsCount}
              </span>
            )}
          </p>
          {(r.parts || r.notes) && (
            <p className="truncate text-xs text-muted-foreground">{r.parts ?? r.notes}</p>
          )}
        </div>
      ),
    },
    ...(showStatus
      ? [
          {
            key: 'status',
            header: 'Situação',
            cell: (r: MaintenanceRecordDto) => <MaintenanceStatusBadge status={r.status} />,
          },
        ]
      : []),
    {
      key: 'when',
      header: 'Data',
      cell: (r) => {
        const w = whenText(r, today);
        return (
          <div className="whitespace-nowrap">
            <p className={cn('tabular', w.late && 'font-medium text-destructive')}>
              {formatYmd(w.date)}
            </p>
            {r.status === 'SCHEDULED' && w.date ? (
              <p className={cn('text-xs', w.late ? 'text-destructive' : 'text-muted-foreground')}>
                {w.late
                  ? `atrasada, era ${relativeDays(w.date, today)}`
                  : relativeDays(w.date, today)}
              </p>
            ) : r.status === 'IN_PROGRESS' && w.date ? (
              <p className="text-xs text-muted-foreground">começou {relativeDays(w.date, today)}</p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'km',
      header: 'Km',
      align: 'right',
      hideBelow: 'lg',
      cell: (r) => (
        <span className="whitespace-nowrap">{r.km !== null ? formatKm(r.km) : '—'}</span>
      ),
    },
    {
      key: 'workshop',
      header: 'Oficina',
      hideBelow: 'lg',
      cell: (r) => <span className="block max-w-48 truncate text-sm">{r.workshop ?? '—'}</span>,
    },
    ...(showCost
      ? [
          {
            key: 'cost',
            header: 'Valor',
            align: 'right' as const,
            cell: (r: MaintenanceRecordDto) =>
              r.cost !== null ? (
                formatBRL(r.cost)
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
        ]
      : []),
    ...(hasActions
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            cell: (r: MaintenanceRecordDto) => (
              <div className="flex justify-end gap-2">
                {r.status === 'SCHEDULED' && onStart && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStart(r);
                    }}
                  >
                    <Play /> Iniciar
                  </Button>
                )}
                {(r.status === 'SCHEDULED' || r.status === 'IN_PROGRESS') && onComplete && (
                  <Button
                    size="sm"
                    variant={r.status === 'IN_PROGRESS' ? 'default' : 'outline'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onComplete(r);
                    }}
                  >
                    <CheckCircle2 /> Concluir
                  </Button>
                )}
              </div>
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
      rowKey={(r) => r.id}
      onRowClick={onOpen}
      rowClassName={(r) =>
        r.status === 'CANCELLED'
          ? 'opacity-60'
          : r.status === 'SCHEDULED' && r.scheduledFor && r.scheduledFor < today
            ? 'bg-destructive/[0.03]'
            : undefined
      }
      empty={{ icon: Wrench, ...empty }}
      mobileCard={(r) => {
        const w = whenText(r, today);
        return (
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-[15px] font-medium leading-snug">
                {r.types.map((t) => t.name).join(', ')}
              </p>
              {(showStatus || r.status === 'CANCELLED') && (
                <MaintenanceStatusBadge status={r.status} className="shrink-0" />
              )}
            </div>
            {!hideMotorcycle && (
              <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <Plate plate={r.motorcycle.plate} />{' '}
                <span className="truncate">{r.motorcycle.label}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className={cn('tabular', w.late && 'font-medium text-destructive')}>
                {w.label} {formatYmd(w.date)}
                {w.late ? ' · atrasada' : ''}
              </span>
              {r.km !== null && <span className="tabular">{formatKm(r.km)}</span>}
              {r.workshop && <span className="max-w-full truncate">{r.workshop}</span>}
              {showCost && r.cost !== null && (
                <span className="font-medium text-foreground">{formatBRL(r.cost)}</span>
              )}
              {r.documentsCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="size-3" aria-hidden /> {r.documentsCount}
                </span>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}
