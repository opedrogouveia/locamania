'use client';

import { OCCURRENCE_TYPE_LABELS, type OccurrenceDto } from '@locamania/shared';
import { Paperclip, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { DataTable, type Column } from '@/components/ui/data-table';
import { MobileRow } from '@/components/ui/kit';
import { OccurrenceStatusBadge } from '@/components/ui/status-badge';
import { formatBRL, formatPlate, formatYmd } from '@/lib/utils';

/** Tabela de ocorrências e multas (lista, fichas). */
export function OccurrenceList({
  rows,
  loading,
  hide = [],
  empty,
}: {
  rows: OccurrenceDto[] | undefined;
  loading?: boolean;
  hide?: ('customer' | 'motorcycle')[];
  empty?: { title: string; description?: string };
}) {
  const router = useRouter();
  const columns: Column<OccurrenceDto>[] = [
    { key: 'date', header: 'Data', cell: (o) => <span className="tabular">{formatYmd(o.occurredAt)}</span> },
    {
      key: 'type',
      header: 'Ocorrência',
      cell: (o) => (
        <div className="min-w-0 max-w-md">
          <p className="font-medium">{OCCURRENCE_TYPE_LABELS[o.type]}</p>
          <p className="truncate text-xs text-muted-foreground">{o.description}</p>
        </div>
      ),
    },
    ...(hide.includes('motorcycle')
      ? []
      : [{ key: 'moto', header: 'Moto', cell: (o: OccurrenceDto) => (o.motorcycle ? <span className="font-mono text-sm">{formatPlate(o.motorcycle.plate)}</span> : '—') }]),
    ...(hide.includes('customer') ? [] : [{ key: 'customer', header: 'Cliente', hideBelow: 'lg' as const, cell: (o: OccurrenceDto) => o.customer?.label ?? '—' }]),
    { key: 'amount', header: 'Valor', align: 'right', cell: (o) => (o.amount !== null ? formatBRL(o.amount) : '—') },
    {
      key: 'status',
      header: 'Situação',
      cell: (o) => (
        <div className="flex items-center gap-2">
          <OccurrenceStatusBadge status={o.status} />
          {o.documentsCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <Paperclip className="size-3" /> {o.documentsCount}
            </span>
          )}
        </div>
      ),
    },
  ];
  return (
    <DataTable
      rows={rows}
      loading={loading}
      columns={columns}
      rowKey={(o) => o.id}
      onRowClick={(o) => router.push(`/admin/occurrences/${o.id}`)}
      empty={{ icon: ShieldAlert, title: empty?.title ?? 'Nenhuma ocorrência', description: empty?.description }}
      mobileCard={(o) => (
        <MobileRow
          title={OCCURRENCE_TYPE_LABELS[o.type]}
          subtitle={o.description}
          meta={
            <>
              <span>{formatYmd(o.occurredAt)}</span>
              {!hide.includes('motorcycle') && o.motorcycle && <span className="font-mono">{formatPlate(o.motorcycle.plate)}</span>}
              {!hide.includes('customer') && o.customer && <span>{o.customer.label}</span>}
            </>
          }
          right={
            <>
              {o.amount !== null && <span className="text-sm font-semibold tabular">{formatBRL(o.amount)}</span>}
              <OccurrenceStatusBadge status={o.status} />
            </>
          }
        />
      )}
    />
  );
}
