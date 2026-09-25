'use client';

import {
  PERIODICITY_LABELS,
  PERIODICITY_UNIT,
  Permission,
  type ContractListItemDto,
} from '@locamania/shared';
import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { DataTable, type Column } from '@/components/ui/data-table';
import { MobileRow } from '@/components/ui/kit';
import { ContractStatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { useCan } from '@/lib/auth/use-auth';
import { formatBRL, formatPlate, formatYmd } from '@/lib/utils';

/** Janela do "terminando" (mesmo padrão do aviso de fim de contrato). */
export const ENDING_DAYS = 15;

/** "termina em 5 d" / "venceu há 3 d" — contrato ativo perto do fim (ou passado dele). */
function EndingBadge({ c }: { c: ContractListItemDto }) {
  if (c.status !== 'ACTIVE' || c.daysToEnd === null || c.daysToEnd > ENDING_DAYS) return null;
  if (c.daysToEnd < 0) return <Badge variant="destructive">venceu há {-c.daysToEnd} d</Badge>;
  return (
    <Badge variant="warning">
      {c.daysToEnd === 0 ? 'termina hoje' : `termina em ${c.daysToEnd} d`}
    </Badge>
  );
}

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
  const canMoney = useCan(Permission.PAYMENTS_VIEW);
  const columns: Column<ContractListItemDto>[] = [
    {
      key: 'number',
      header: 'Contrato',
      cell: (c) => (
        <div>
          <p className="whitespace-nowrap font-medium tabular">{c.number}</p>
          <p className="text-xs text-muted-foreground">{PERIODICITY_LABELS[c.periodicity]}</p>
        </div>
      ),
    },
    ...(hide.includes('customer')
      ? []
      : [
          {
            key: 'customer',
            header: 'Cliente',
            cell: (c: ContractListItemDto) => c.customer.label,
          },
        ]),
    ...(hide.includes('motorcycle')
      ? []
      : [
          {
            key: 'moto',
            header: 'Moto',
            cell: (c: ContractListItemDto) => (
              <div>
                <p className="whitespace-nowrap font-mono text-sm">
                  {formatPlate(c.motorcycle.plate)}
                </p>
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
        <div className="text-sm">
          <p className="whitespace-nowrap tabular">
            {formatYmd(c.startDate)} a {formatYmd(c.endDate)}
          </p>
          {c.status === 'ACTIVE' && c.nextDueDate && (
            <p className="whitespace-nowrap text-xs text-muted-foreground tabular">
              Próx. vencimento {formatYmd(c.nextDueDate)}
            </p>
          )}
        </div>
      ),
    },
    // Sem `payments.view` a API manda o valor nulo: a coluna nem aparece.
    ...(canMoney
      ? [
          {
            key: 'rent',
            header: 'Valor',
            align: 'right' as const,
            cell: (c: ContractListItemDto) =>
              c.rentAmount !== null ? (
                <div>
                  <p className="whitespace-nowrap">{formatBRL(c.rentAmount)}</p>
                  <p className="text-xs text-muted-foreground">
                    por {PERIODICITY_UNIT[c.periodicity]}
                  </p>
                </div>
              ) : (
                '—'
              ),
          },
        ]
      : []),
    {
      key: 'status',
      header: 'Situação',
      cell: (c) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ContractStatusBadge status={c.status} />
          {c.status === 'DRAFT' && (
            <Badge variant="outline">
              {c.signatureStatus === 'PENDING'
                ? 'Aguardando assinatura'
                : 'Assinado · falta entregar'}
            </Badge>
          )}
          {c.overdueCount > 0 && <Badge variant="destructive">{c.overdueCount} em atraso</Badge>}
          <EndingBadge c={c} />
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
      empty={{
        icon: FileText,
        title: empty?.title ?? 'Nenhum contrato',
        description: empty?.description,
        action: empty?.action,
      }}
      mobileCard={(c) => (
        <MobileRow
          title={
            <>
              {c.number}
              {!hide.includes('motorcycle') && (
                <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                  {formatPlate(c.motorcycle.plate)}
                </span>
              )}
            </>
          }
          subtitle={
            hide.includes('customer')
              ? `${formatYmd(c.startDate)} a ${formatYmd(c.endDate)}`
              : c.customer.label
          }
          meta={
            <>
              {c.overdueCount > 0 && (
                <span className="font-medium text-destructive">{c.overdueCount} em atraso</span>
              )}
              {c.status === 'DRAFT' && (
                <span>
                  {c.signatureStatus === 'PENDING'
                    ? 'Aguardando assinatura'
                    : 'Assinado · falta entregar'}
                </span>
              )}
              {c.status === 'ACTIVE' && c.daysToEnd !== null && c.daysToEnd <= ENDING_DAYS ? (
                <EndingBadge c={c} />
              ) : (
                c.status === 'ACTIVE' &&
                c.nextDueDate && <span>Vence {formatYmd(c.nextDueDate)}</span>
              )}
              {!hide.includes('customer') && (c.status === 'ENDED' || c.status === 'CANCELLED') && (
                <span className="tabular">
                  {formatYmd(c.startDate)} a {formatYmd(c.endDate)}
                </span>
              )}
            </>
          }
          right={
            <>
              {c.rentAmount !== null && (
                <span className="text-sm font-semibold tabular">{formatBRL(c.rentAmount)}</span>
              )}
              <ContractStatusBadge status={c.status} />
            </>
          }
        />
      )}
    />
  );
}
