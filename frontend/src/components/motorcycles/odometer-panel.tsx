'use client';

import {
  ODOMETER_SOURCE_LABELS,
  type OdometerReadingDto,
  type OdometerSource,
} from '@locamania/shared';
import { Gauge, Plus } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { errorMessage } from '@/lib/api/client';
import { useMotorcycleOdometer } from '@/lib/queries';
import { formatDateTime, formatKm } from '@/lib/utils';
import { OdometerChart } from './odometer-chart';

const SOURCE_VARIANT: Record<
  OdometerSource,
  'default' | 'secondary' | 'outline' | 'info' | 'muted' | 'success' | 'warning'
> = {
  CONTRACT_START: 'info',
  RETURN: 'info',
  MAINTENANCE: 'warning',
  MANUAL: 'outline',
  CUSTOMER: 'secondary',
  TRACKER: 'muted',
};

type Row = OdometerReadingDto & { delta: number | null };

/** Uso médio (km/dia) entre a leitura mais nova e a mais antiga dos últimos ~30 dias. */
function averagePerDay(rows: OdometerReadingDto[]): { perDay: number; days: number } | null {
  if (rows.length < 2) return null;
  const latest = rows[0]!;
  const limit = new Date(latest.readAt).getTime() - 30 * 86_400_000;
  const window = rows.filter((r) => new Date(r.readAt).getTime() >= limit);
  const oldest = window.length >= 2 ? window[window.length - 1]! : rows[1]!;
  const days = (new Date(latest.readAt).getTime() - new Date(oldest.readAt).getTime()) / 86_400_000;
  if (days < 1) return null;
  return { perDay: Math.round((latest.km - oldest.km) / days), days: Math.round(days) };
}

/** Leituras de quilometragem com a origem de cada uma (entrega, devolução, cliente, manutenção...). */
export function OdometerPanel({
  motorcycleId,
  onAdd,
}: {
  motorcycleId: string;
  onAdd?: () => void;
}) {
  const { data, isLoading, error } = useMotorcycleOdometer(motorcycleId);
  const rows = useMemo<Row[] | undefined>(
    () => data?.map((r, i) => ({ ...r, delta: data[i + 1] ? r.km - data[i + 1]!.km : null })),
    [data],
  );
  const avg = data ? averagePerDay(data) : null;

  const columns: Column<Row>[] = [
    {
      key: 'date',
      header: 'Data',
      cell: (r) => <span className="whitespace-nowrap tabular">{formatDateTime(r.readAt)}</span>,
    },
    {
      key: 'km',
      header: 'Quilometragem',
      align: 'right',
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className="font-medium">{formatKm(r.km)}</p>
          {r.delta !== null && r.delta > 0 && (
            <p className="text-xs text-muted-foreground">+{r.delta.toLocaleString('pt-BR')} km</p>
          )}
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Origem',
      cell: (r) => (
        <Badge variant={SOURCE_VARIANT[r.source]}>{ODOMETER_SOURCE_LABELS[r.source]}</Badge>
      ),
    },
    {
      key: 'by',
      header: 'Registrado por',
      hideBelow: 'lg',
      cell: (r) => <span className="text-sm">{r.recordedBy ?? 'Sistema'}</span>,
    },
    {
      key: 'notes',
      header: 'Observação',
      hideBelow: 'xl',
      cell: (r) => (
        <span className="block max-w-xs truncate text-sm text-muted-foreground">
          {r.notes ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Quilometragem</h3>
          <p className="text-sm text-muted-foreground">
            {avg
              ? `Uso médio de ${avg.perDay.toLocaleString('pt-BR')} km por dia (últimos ${avg.days} dias).`
              : 'Cada leitura recalcula a manutenção por km.'}
          </p>
        </div>
        {onAdd && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus /> Registrar km
          </Button>
        )}
      </div>
      {data && data.length >= 2 && (
        <div className="rounded-lg border border-border bg-card p-3 pt-2 sm:p-4 sm:pt-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Evolução da quilometragem
          </p>
          <OdometerChart readings={data} />
        </div>
      )}
      {error ? (
        <p className="text-sm text-destructive">{errorMessage(error)}</p>
      ) : (
        <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-lg sm:border">
          <DataTable
            rows={rows}
            loading={isLoading}
            columns={columns}
            rowKey={(r) => r.id}
            empty={{
              icon: Gauge,
              title: 'Nenhuma leitura ainda',
              description:
                'As leituras da entrega, devolução, manutenção e do cliente aparecem aqui.',
            }}
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium tabular">{formatKm(r.km)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(r.readAt)}
                    {r.recordedBy ? ` · ${r.recordedBy}` : ''}
                  </p>
                  {r.notes && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={SOURCE_VARIANT[r.source]}>
                    {ODOMETER_SOURCE_LABELS[r.source]}
                  </Badge>
                  {r.delta !== null && r.delta > 0 && (
                    <span className="text-xs text-muted-foreground tabular">
                      +{r.delta.toLocaleString('pt-BR')} km
                    </span>
                  )}
                </div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
