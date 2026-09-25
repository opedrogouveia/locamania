'use client';

import {
  OCCURRENCE_STATUS_LABELS,
  OCCURRENCE_STATUSES,
  OCCURRENCE_TYPE_LABELS,
  Permission,
  formatPlate,
  type OccurrenceDto,
  type OccurrenceStatus,
  type OccurrenceType,
} from '@locamania/shared';
import { Archive, Bike, CalendarDays, ChevronDown, HandCoins, MoreHorizontal, Pencil, Receipt, TriangleAlert, UserRound, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ChargeList } from '@/components/charges/charge-list';
import { ChargeOccurrenceDialog } from '@/components/occurrences/charge-occurrence-dialog';
import { OCCURRENCE_STATUS_HINT, OCCURRENCE_TYPE_ICON } from '@/components/occurrences/occurrence-meta';
import { DocumentsPanel } from '@/components/shared/documents-panel';
import { Timeline } from '@/components/shared/timeline';
import { BackLink } from '@/components/ui/back-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { DetailList, SectionCard, StatCard } from '@/components/ui/kit';
import { Skeleton } from '@/components/ui/skeleton';
import { OccurrenceStatusBadge } from '@/components/ui/status-badge';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { K, useArchiveOccurrence, useCharge, useInvalidate, useOccurrence, useUpdateOccurrence } from '@/lib/queries';
import { cn, formatBRL, formatDateTime, formatYmd, relativeDays, todayYmd } from '@/lib/utils';

/** Tipo de documento sugerido ao anexar (a pessoa pode trocar). */
const DOC_TYPE: Record<OccurrenceType, string> = {
  TRAFFIC_FINE: 'TRAFFIC_TICKET',
  ACCIDENT: 'POLICE_REPORT',
  THEFT: 'POLICE_REPORT',
  DAMAGE: 'PHOTO_DAMAGE',
  MECHANICAL_ISSUE: 'PHOTO_DAMAGE',
  OTHER: 'OTHER',
};

/** "Reginaldo Brito Machado" → "Reginaldo Machado" (cabe no cartão). */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
}

function ChargeSection({ o }: { o: OccurrenceDto }) {
  const canPayments = useCan(Permission.PAYMENTS_VIEW);
  const canCharge = useCan(Permission.OCCURRENCES_MANAGE, Permission.PAYMENTS_MANAGE);
  const charge = useCharge(o.charge && canPayments ? o.charge.id : undefined);
  if (o.charge) {
    if (!canPayments) {
      return (
        <SectionCard title="Cobrança do cliente">
          <p className="text-sm text-muted-foreground">Esta ocorrência já foi cobrada de {o.customer?.label ?? 'cliente'}.</p>
        </SectionCard>
      );
    }
    return (
      <SectionCard title="Cobrança do cliente" description="Repassada como cobrança avulsa." contentClassName="p-0 sm:p-0">
        <div className="border-t border-border">
          <ChargeList rows={charge.data ? [charge.data] : undefined} loading={charge.isLoading} hide={['customer']} empty={{ title: 'Cobrança não encontrada' }} />
        </div>
      </SectionCard>
    );
  }
  if (o.status === 'CANCELLED') return null;
  return (
    <SectionCard title="Cobrança do cliente">
      <p className="text-sm text-muted-foreground">
        {!o.customer
          ? 'Sem cliente ligado. Edite a ocorrência e informe o cliente para poder cobrar.'
          : canCharge
            ? `Ainda não foi cobrada. Se o prejuízo é do cliente, use "Cobrar do cliente" para gerar a cobrança de ${o.customer.label}.`
            : 'Ainda não foi cobrada do cliente.'}
      </p>
    </SectionCard>
  );
}

export default function OccurrenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: o, isLoading, error } = useOccurrence(id);
  const canManage = useCan(Permission.OCCURRENCES_MANAGE);
  const canCharge = useCan(Permission.OCCURRENCES_MANAGE, Permission.PAYMENTS_MANAGE);
  const canMoney = useCan(Permission.PAYMENTS_VIEW);
  const canDocuments = useCan(Permission.DOCUMENTS_VIEW);
  const canCustomers = useCan(Permission.CUSTOMERS_VIEW);
  const canMotos = useCan(Permission.MOTORCYCLES_VIEW);
  const canContracts = useCan(Permission.CONTRACTS_VIEW);
  const update = useUpdateOccurrence(id);
  const archive = useArchiveOccurrence();
  const invalidate = useInvalidate();
  const confirm = useConfirm();
  const [charging, setCharging] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !o) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Ocorrência não encontrada"
        description={errorMessage(error)}
        action={<BackLink href="/admin/occurrences">Voltar para ocorrências</BackLink>}
      />
    );
  }

  const Icon = OCCURRENCE_TYPE_ICON[o.type];
  const today = todayYmd();

  async function setStatus(status: OccurrenceStatus) {
    if (status === 'CANCELLED') {
      const ok = await confirm({
        title: 'Cancelar a ocorrência?',
        description: 'Use quando foi registrada por engano ou ficou sem efeito. Dá para reabrir depois.',
        confirmText: 'Cancelar ocorrência',
        cancelText: 'Voltar',
        variant: 'destructive',
      });
      if (!ok) return;
    }
    try {
      await update.mutateAsync({ status });
      // A linha do tempo da ficha mostra a mudança na hora.
      void invalidate(K.audit);
      toast.success(`Situação: ${OCCURRENCE_STATUS_LABELS[status].toLowerCase()}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function onArchive() {
    const ok = await confirm({
      title: 'Arquivar ocorrência?',
      description: 'Sai das listas, mas os anexos e o histórico continuam guardados.',
      confirmText: 'Arquivar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await archive.mutateAsync(id);
      toast.success('Ocorrência arquivada');
      router.push('/admin/occurrences');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const showChargeButton = canCharge && !!o.customer && !o.charge && o.status !== 'CANCELLED';
  const title = o.type === 'TRAFFIC_FINE' && o.fineNumber ? `${OCCURRENCE_TYPE_LABELS[o.type]} ${o.fineNumber}` : OCCURRENCE_TYPE_LABELS[o.type];

  return (
    <div className="space-y-5">
      <BackLink href="/admin/occurrences">Ocorrências e multas</BackLink>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-xl sm:size-14',
              o.status === 'OPEN' ? 'bg-destructive/12 text-destructive' : o.status === 'IN_PROGRESS' ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1.5">
            <h1 className="break-words text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{title}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <OccurrenceStatusBadge status={o.status} />
              {o.charge && (
                <Badge variant="outline">
                  <Receipt className="size-3" /> Cobrada do cliente
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                Registrada {o.createdBy ? `por ${o.createdBy} ` : ''}em {formatDateTime(o.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:flex sm:flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-accent">
                <span className="sm:hidden">Situação</span>
                <span className="hidden sm:inline">Mudar situação</span>
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Situação</DropdownMenuLabel>
                {OCCURRENCE_STATUSES.filter((s) => s !== o.status).map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => void setStatus(s)} variant={s === 'CANCELLED' ? 'destructive' : 'default'}>
                    <span className="flex flex-col">
                      <span>{OCCURRENCE_STATUS_LABELS[s]}</span>
                      <span className="text-xs font-normal text-muted-foreground">{OCCURRENCE_STATUS_HINT[s]}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild variant="outline">
              <Link href={`/admin/occurrences/${o.id}/edit`}>
                <Pencil /> Editar
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-card hover:bg-accent">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Mais ações</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => void onArchive()}>
                  <Archive /> Arquivar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {showChargeButton && (
              <Button onClick={() => setCharging(true)} className="col-span-full sm:col-auto">
                <HandCoins /> Cobrar do cliente
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className={cn('grid grid-cols-2 gap-3', canMoney ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        <StatCard label="Data" value={formatYmd(o.occurredAt)} hint={relativeDays(o.occurredAt, today)} icon={CalendarDays} tone="muted" />
        {canMoney && (
          <StatCard
            label={o.type === 'TRAFFIC_FINE' ? 'Valor da multa' : 'Valor'}
            value={o.amount !== null ? formatBRL(o.amount) : '—'}
            hint={o.fineDueDate ? `Multa vence ${formatYmd(o.fineDueDate)}` : o.charge ? 'Repassado ao cliente' : undefined}
            icon={Wallet}
            tone={o.fineDueDate && o.fineDueDate < today && o.status !== 'RESOLVED' ? 'danger' : 'warning'}
          />
        )}
        <StatCard
          label="Moto"
          value={o.motorcycle ? formatPlate(o.motorcycle.plate) : 'Sem moto'}
          hint={o.motorcycle?.label}
          icon={Bike}
          tone={o.motorcycle ? 'default' : 'muted'}
          href={o.motorcycle && canMotos ? `/admin/motorcycles/${o.motorcycle.id}` : undefined}
        />
        <StatCard
          label="Cliente"
          value={o.customer ? shortName(o.customer.label) : 'Sem cliente'}
          hint={o.contract ? `Contrato ${o.contract.number}` : undefined}
          icon={UserRound}
          tone={o.customer ? 'info' : 'muted'}
          href={o.customer && canCustomers ? `/admin/customers/${o.customer.id}?tab=occurrences` : undefined}
          className={canMoney ? undefined : 'col-span-2 lg:col-span-1'}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <SectionCard title="Detalhes">
            <p className="mb-4 whitespace-pre-line text-sm leading-relaxed">{o.description}</p>
            <DetailList
              cols={3}
              className="grid-cols-2"
              items={[
                { label: 'Tipo', value: OCCURRENCE_TYPE_LABELS[o.type] },
                { label: 'Situação', value: OCCURRENCE_STATUS_LABELS[o.status] },
                {
                  label: 'Contrato',
                  value: o.contract ? (
                    canContracts ? (
                      <Link href={`/admin/contracts/${o.contract.id}`} className="font-medium text-primary hover:underline">
                        {o.contract.number}
                      </Link>
                    ) : (
                      o.contract.number
                    )
                  ) : null,
                },
                ...(o.type === 'TRAFFIC_FINE'
                  ? [
                      { label: 'Nº do auto de infração', value: o.fineNumber },
                      { label: 'Vencimento da multa', value: o.fineDueDate ? `${formatYmd(o.fineDueDate)} (${relativeDays(o.fineDueDate, today)})` : null },
                    ]
                  : []),
                ...(o.notes ? [{ label: 'Observações', value: <span className="whitespace-pre-line">{o.notes}</span>, wide: true }] : []),
              ]}
            />
          </SectionCard>

          <ChargeSection o={o} />

          {canDocuments && (
            <SectionCard>
              <DocumentsPanel ownerType="OCCURRENCE" ownerId={o.id} title="Fotos e comprovantes" defaultType={DOC_TYPE[o.type]} />
            </SectionCard>
          )}
        </div>

        <SectionCard title="Histórico" className="lg:self-start">
          <Timeline entityType="Occurrence" entityId={o.id} />
        </SectionCard>
      </div>

      <ChargeOccurrenceDialog
        occurrence={o}
        open={charging}
        onOpenChange={(v) => {
          setCharging(v);
          if (!v) void invalidate(K.audit);
        }}
      />
    </div>
  );
}
