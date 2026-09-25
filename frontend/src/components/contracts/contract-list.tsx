'use client';

import { PERIODICITY_LABELS, type ContractListItemDto } from '@locamania/shared';
import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { DataTable, type Column } from '@/components/ui/data-table';
import { MobileRow } from '@/components/ui/kit';
import { ContractStatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { formatBRL, formatPlate, formatYmd } from '@/lib/utils';

/** Tabela de contratos (lista, ficha do cliente, ficha da moto). */
export function ContractList({
  rows,
  loading,
  hide = [],
  empty,
}: {
  rows: ContractListItemDto[] | undefined;
  loading?: boolean;
  hide?: ('customer' | 'motorcycle')[];
  empty?: { title: string; description?: string; action?: React.ReactNode };
}) {
  const router = useRouter();
  const columns: Column<ContractListItemDto>[] = [
    {
      key: 'number',
      header: 'Contrato',
      cell: (c) => (
        <div>
          <p className="font-medium">{c.number}</p>
          <p className="text-xs text-muted-foreground">{PERIODICITY_LABELS[c.periodicity]}</p>
        </div>
      ),
    },
    ...(hide.includes('customer') ? [] : [{ key: 'customer', header: 'Cliente', cell: (c: ContractListItemDto) => c.customer.label }]),
    ...(hide.includes('motorcycle')
      ? []
      : [
          {
            key: 'moto',
            header: 'Moto',
            cell: (c: ContractListItemDto) => (
              <div>
                <p className="font-mono text-sm">{formatPlate(c.motorcycle.plate)}</p>
                <p className="text-xs text-muted-foreground">{c.motorcycle.label}</p>
              </div>
            ),
          },
        ]),
    {
      key: 'period',
      header: 'Período',
      hideBelow: 'lg',
      cell: (c) => (
        <span className="tabular">
          {formatYmd(c.startDate)} a {formatYmd(c.endDate)}
        </span>
      ),
    },
    { key: 'rent', header: 'Valor', align: 'right', cell: (c) => (c.rentAmount !== null ? formatBRL(c.rentAmount) : '—') },
    {
      key: 'status',
      header: 'Situação',
      cell: (c) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ContractStatusBadge status={c.status} />
          {c.status === 'DRAFT' && c.signatureStatus === 'PENDING' && <Badge variant="outline">Aguardando assinatura</Badge>}
          {c.overdueCount > 0 && <Badge variant="destructive">{c.overdueCount} em atraso</Badge>}
          {c.status === 'ACTIVE' && c.daysToEnd !== null && c.daysToEnd <= 15 && <Badge variant="warning">termina em {c.daysToEnd} d</Badge>}
        </div>
      ),
    },
  ];
  return (
    <DataTable
      rows={rows}
      loading={loading}
      columns={columns}
      rowKey={(c) => c.id}
      onRowClick={(c) => router.push(`/admin/contracts/${c.id}`)}
      empty={{ icon: FileText, title: empty?.title ?? 'Nenhum contrato', description: empty?.description, action: empty?.action }}
      mobileCard={(c) => (
        <MobileRow
          title={
            <>
              {c.number}
              {!hide.includes('motorcycle') && <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">{formatPlate(c.motorcycle.plate)}</span>}
            </>
          }
          subtitle={hide.includes('customer') ? `${formatYmd(c.startDate)} a ${formatYmd(c.endDate)}` : c.customer.label}
          meta={
            <>
              {c.overdueCount > 0 && <span className="text-destructive">{c.overdueCount} em atraso</span>}
              {c.status === 'DRAFT' && c.signatureStatus === 'PENDING' && <span>Aguardando assinatura</span>}
              {c.status === 'ACTIVE' && c.nextDueDate && <span>Próximo vencimento {formatYmd(c.nextDueDate)}</span>}
            </>
          }
          right={
            <>
              {c.rentAmount !== null && <span className="text-sm font-semibold tabular">{formatBRL(c.rentAmount)}</span>}
              <ContractStatusBadge status={c.status} />
            </>
          }
        />
      )}
    />
  );
}
