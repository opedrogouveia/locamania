'use client';

import { OCCURRENCE_TYPE_LABELS, Permission, type OccurrenceDto } from '@locamania/shared';
import { Paperclip, Receipt, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { DataTable, type Column } from '@/components/ui/data-table';
import { MobileRow } from '@/components/ui/kit';
import { OccurrenceStatusBadge } from '@/components/ui/status-badge';
import { useCan } from '@/lib/auth/use-auth';
import { formatBRL, formatPlate, formatYmd } from '@/lib/utils';
import { OCCURRENCE_TYPE_ICON } from './occurrence-meta';

/** "Multa · AIT 123" — o nº do auto ajuda a achar a multa no Detran. */
function typeLine(o: OccurrenceDto): string {
  return o.type === 'TRAFFIC_FINE' && o.fineNumber ? `${OCCURRENCE_TYPE_LABELS[o.type]} · ${o.fineNumber}` : OCCURRENCE_TYPE_LABELS[o.type];
}

function Extras({ o }: { o: OccurrenceDto }) {
  if (!o.documentsCount && !o.charge) return null;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      {o.documentsCount > 0 && (
        <span className="inline-flex items-center gap-0.5" title={`${o.documentsCount} anexo(s)`}>
          <Paperclip className="size-3" aria-hidden /> {o.documentsCount}
          <span className="sr-only">anexos</span>
        </span>
      )}
      {o.charge && (
        <span className="inline-flex items-center gap-0.5" title="Cobrada do cliente">
          <Receipt className="size-3" aria-hidden /> Cobrada
        </span>
      )}
    </span>
  );
}

/** Tabela de ocorrências e multas (lista, fichas). Sem `payments.view`, a coluna de valor some. */
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
  const canMoney = useCan(Permission.PAYMENTS_VIEW);
  const columns: Column<OccurrenceDto>[] = [
    { key: 'date', header: 'Data', className: 'w-28', cell: (o) => <span className="tabular">{formatYmd(o.occurredAt)}</span> },
    {
      key: 'type',
      header: 'Ocorrência',
      cell: (o) => {
        const Icon = OCCURRENCE_TYPE_ICON[o.type];
        return (
          <div className="flex min-w-0 max-w-[18rem] items-start gap-2.5 xl:max-w-[26rem]">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium">{typeLine(o)}</p>
              <p className="truncate text-xs text-muted-foreground">{o.description}</p>
            </div>
          </div>
        );
      },
    },
    ...(hide.includes('motorcycle')
      ? []
      : [
          {
            key: 'moto',
            header: 'Moto',
            cell: (o: OccurrenceDto) =>
              o.motorcycle ? (
                <div className="whitespace-nowrap">
                  <p className="font-mono text-sm">{formatPlate(o.motorcycle.plate)}</p>
                  <p className="text-xs text-muted-foreground">{o.motorcycle.label}</p>
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
        ]),
    ...(hide.includes('customer')
      ? []
      : [{ key: 'customer', header: 'Cliente', hideBelow: 'lg' as const, cell: (o: OccurrenceDto) => (o.customer ? <span className="block min-w-[9rem]">{o.customer.label}</span> : <span className="text-muted-foreground">—</span>) }]),
    ...(canMoney
      ? [{ key: 'amount', header: 'Valor', align: 'right' as const, className: 'whitespace-nowrap', cell: (o: OccurrenceDto) => (o.amount !== null ? formatBRL(o.amount) : <span className="text-muted-foreground">—</span>) }]
      : []),
    {
      key: 'status',
      header: 'Situação',
      cell: (o) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <OccurrenceStatusBadge status={o.status} />
          <Extras o={o} />
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
          title={typeLine(o)}
          subtitle={o.description}
          meta={
            <>
              <span className="tabular">{formatYmd(o.occurredAt)}</span>
              {!hide.includes('motorcycle') && o.motorcycle && <span className="font-mono">{formatPlate(o.motorcycle.plate)}</span>}
              {!hide.includes('customer') && o.customer && <span className="max-w-40 truncate">{o.customer.label}</span>}
              <Extras o={o} />
            </>
          }
          right={
            <>
              <OccurrenceStatusBadge status={o.status} />
              {o.amount !== null && <span className="text-sm font-semibold tabular">{formatBRL(o.amount)}</span>}
            </>
          }
        />
      )}
    />
  );
}
