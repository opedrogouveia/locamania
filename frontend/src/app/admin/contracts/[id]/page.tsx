'use client';

import {
  DEPOSIT_OUTCOME_LABELS,
  FUEL_LEVEL_LABELS,
  MOTORCYCLE_STATUS_LABELS,
  PERIODICITY_LABELS,
  PERIODICITY_UNIT,
  Permission,
  RETURN_CONDITION_LABELS,
  SIGNATURE_METHOD_LABELS,
  buildRentSchedule,
  firstName,
  scheduleTotal,
  todayYmd,
  whatsappLink,
  type ChargeDisplayStatus,
  type ContractDto,
  type PortalInviteResponse,
} from '@locamania/shared';
import {
  Ban,
  Bike,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  FileText,
  KeyRound,
  MoreHorizontal,
  Printer,
  Receipt,
  Send,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { ChargeList } from '@/components/charges/charge-list';
import {
  AdjustRentDialog,
  CancelContractDialog,
  DeliverContractDialog,
  ExtendContractDialog,
  SendContractDialog,
  SignContractDialog,
} from '@/components/contracts/contract-dialogs';
import { ContractPdfMenu, useContractPdf } from '@/components/contracts/contract-pdf';
import { ContractStages } from '@/components/contracts/contract-stages';
import { SchedulePreview } from '@/components/contracts/schedule-preview';
import { InviteDialog } from '@/components/customers/customer-dialogs';
import { SegmentedBar } from '@/components/charts/segmented-bar';
import { CopyButton } from '@/components/shared/copy-button';
import { DocumentsPanel } from '@/components/shared/documents-panel';
import { Timeline } from '@/components/shared/timeline';
import { WhatsAppIcon } from '@/components/shared/whatsapp-icon';
import { BackLink } from '@/components/ui/back-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { DetailList, FilterChips, SectionCard, StatCard } from '@/components/ui/kit';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ContractStatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { durationLabel } from '@/lib/contracts/rules';
import {
  useCharges,
  useChargesSummary,
  useContract,
  useContractText,
  useInviteCustomer,
} from '@/lib/queries';
import { useUrlState } from '@/lib/use-url-state';
import {
  formatBRL,
  formatDateTime,
  formatKm,
  formatPlate,
  formatYmd,
  relativeDays,
} from '@/lib/utils';

type DialogKind = 'send' | 'sign' | 'deliver' | 'adjust' | 'extend' | 'cancel';
type ScheduleFilter = 'all' | ChargeDisplayStatus;

const SCHEDULE_LABELS: Record<ScheduleFilter, string> = {
  all: 'Todas',
  OVERDUE: 'Em atraso',
  DUE_SOON: 'Próximas',
  UPCOMING: 'A vencer',
  PAID: 'Pagas',
  CANCELLED: 'Canceladas',
};

// ───────────────────────────── Aba Cronograma ─────────────────────────────

function ScheduleTab({ c }: { c: ContractDto }) {
  const [filter, setFilter] = useState<ScheduleFilter>('all');
  const [page, setPage] = useState(1);
  const drafted = c.status === 'DRAFT' || c.status === 'CANCELLED';
  const summary = useChargesSummary({ contractId: c.id }, !drafted);
  const { data, isLoading, error } = useCharges(
    { contractId: c.id, status: filter === 'all' ? undefined : filter, pageSize: 100, page },
    !drafted,
  );

  if (c.status === 'CANCELLED') {
    return (
      <SectionCard>
        <EmptyState
          icon={Receipt}
          title="Nenhuma cobrança"
          description="O contrato foi cancelado antes da entrega da moto, então nenhuma cobrança foi gerada."
          className="py-10"
        />
      </SectionCard>
    );
  }
  if (drafted) {
    return (
      <SectionCard
        title="Prévia do cronograma"
        description="As cobranças são geradas quando a moto for entregue. É assim que vão ficar:"
      >
        {c.rentAmount ? (
          <SchedulePreview
            head={4}
            input={{
              startDate: c.startDate,
              endDate: c.endDate,
              firstDueDate: c.firstDueDate,
              periodicity: c.periodicity,
              rentAmount: c.rentAmount,
              depositAmount: c.depositAmount,
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </SectionCard>
    );
  }

  const s = summary.data?.byStatus;
  const counted = s ? s.PAID.count + s.OVERDUE.count + s.DUE_SOON.count + s.UPCOMING.count : 0;
  const chips: ScheduleFilter[] = ['all', 'OVERDUE', 'DUE_SOON', 'UPCOMING', 'PAID', 'CANCELLED'];

  return (
    <div className="space-y-4">
      {s && counted > 0 && (
        <SectionCard
          title={`${s.PAID.count} de ${counted} cobranças pagas`}
          description={s.OVERDUE.count ? `${s.OVERDUE.count} em atraso` : 'Nenhuma em atraso'}
        >
          <SegmentedBar
            total={counted}
            segments={[
              { key: 'PAID', label: 'Pagas', value: s.PAID.count, colorClass: 'bg-success' },
              {
                key: 'OVERDUE',
                label: 'Em atraso',
                value: s.OVERDUE.count,
                colorClass: 'bg-destructive',
              },
              {
                key: 'DUE_SOON',
                label: 'Próximas',
                value: s.DUE_SOON.count,
                colorClass: 'bg-warning',
              },
              {
                key: 'UPCOMING',
                label: 'A vencer',
                value: s.UPCOMING.count,
                colorClass: 'bg-muted-foreground/40',
              },
            ]}
          />
        </SectionCard>
      )}
      <FilterChips
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        options={chips
          .filter((f) => f === 'all' || f === filter || (s?.[f].count ?? 0) > 0)
          .map((f) => ({
            value: f,
            label: SCHEDULE_LABELS[f],
            count: f === 'all' ? undefined : s?.[f].count,
            tone:
              f === 'OVERDUE'
                ? ('danger' as const)
                : f === 'DUE_SOON'
                  ? ('warning' as const)
                  : undefined,
          }))}
      />
      {error ? (
        <p className="text-sm text-destructive">{errorMessage(error)}</p>
      ) : (
        <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-lg sm:border">
          <ChargeList
            rows={data?.data}
            loading={isLoading}
            hide={['customer', 'contract']}
            empty={{ title: 'Nenhuma cobrança aqui' }}
          />
          {data && data.totalPages > 1 && (
            <div className="border-t border-border p-3">
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                unit="cobranças"
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Aba Contrato ─────────────────────────────

function ContractTab({ c }: { c: ContractDto }) {
  // O texto e o PDF trazem valor do aluguel e caução: só para quem vê valores (regra 4).
  const canMoney = c.rentAmount !== null;
  const text = useContractText(c.id, canMoney);
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {!canMoney ? (
        <SectionCard className="lg:col-span-2" title="Texto do contrato">
          <EmptyState
            icon={FileText}
            title="O texto do contrato tem valores"
            description="Seu perfil não vê valores de aluguel e caução. Peça a quem administra o sistema se precisar do PDF."
            className="py-10"
          />
        </SectionCard>
      ) : (
        <SectionCard
          className="lg:col-span-2"
          title="Texto do contrato"
          description={
            text.data?.frozen
              ? 'Congelado na assinatura — é exatamente o que o cliente assinou.'
              : 'Gerado a partir do modelo. Fica congelado quando o contrato for assinado.'
          }
          actions={<ContractPdfMenu contract={c} className="h-9 px-3" />}
        >
          {text.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : text.error ? (
            <p className="text-sm text-destructive">{errorMessage(text.error)}</p>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words sm:p-5">
              {text.data?.text}
            </div>
          )}
        </SectionCard>
      )}
      <div className="space-y-5">
        <SectionCard title="Condições">
          <DetailList
            cols={1}
            items={[
              { label: 'Periodicidade', value: PERIODICITY_LABELS[c.periodicity] },
              ...(canMoney
                ? [
                    {
                      label: `Valor por ${PERIODICITY_UNIT[c.periodicity]}`,
                      value: formatBRL(c.rentAmount),
                    },
                  ]
                : []),
              {
                label: 'Período',
                value: `${formatYmd(c.startDate)} a ${formatYmd(c.endDate)} · ${durationLabel(c.startDate, c.endDate)}`,
              },
              { label: '1º vencimento', value: formatYmd(c.firstDueDate) },
              ...(canMoney
                ? [
                    {
                      label: 'Caução',
                      value: c.depositAmount ? formatBRL(c.depositAmount) : 'Sem caução',
                    },
                  ]
                : []),
              {
                label: 'Km de saída',
                value: c.initialKm !== null ? formatKm(c.initialKm) : 'Registrado na entrega',
              },
              {
                label: 'Regras específicas',
                value: c.rules ? <span className="whitespace-pre-line">{c.rules}</span> : null,
              },
              {
                label: 'Observações',
                value: c.notes ? <span className="whitespace-pre-line">{c.notes}</span> : null,
              },
              {
                label: 'Criado por',
                value: c.createdBy
                  ? `${c.createdBy} em ${formatDateTime(c.createdAt)}`
                  : formatDateTime(c.createdAt),
              },
            ]}
          />
        </SectionCard>
        <SectionCard title="Assinatura">
          <DetailList
            cols={1}
            items={[
              {
                label: 'Situação',
                value:
                  c.signatureStatus === 'SIGNED' ? (
                    <Badge variant="success">Assinado</Badge>
                  ) : (
                    <Badge variant="warning">Aguardando assinatura</Badge>
                  ),
              },
              ...(c.signatureStatus === 'SIGNED'
                ? [
                    {
                      label: 'Como',
                      value: c.signatureMethod ? SIGNATURE_METHOD_LABELS[c.signatureMethod] : null,
                    },
                    { label: 'Data e hora', value: formatDateTime(c.signedAt) },
                    {
                      label: 'IP',
                      value:
                        c.signatureIp ??
                        (c.signatureMethod === 'IN_PERSON' ? 'Não se aplica (presencial)' : null),
                    },
                  ]
                : []),
              {
                label: 'Código de verificação (hash)',
                value: c.documentHash ? (
                  <span className="flex items-start gap-2">
                    <code className="min-w-0 flex-1 break-all rounded bg-muted px-1.5 py-1 font-mono text-[11px] leading-snug">
                      {c.documentHash}
                    </code>
                    <CopyButton
                      text={c.documentHash}
                      label=""
                      copiedLabel=""
                      size="icon-sm"
                      aria-label="Copiar código"
                    />
                  </span>
                ) : (
                  'Gerado na assinatura'
                ),
              },
              {
                label: 'Enviado ao cliente',
                value: c.sentAt ? formatDateTime(c.sentAt) : 'Ainda não',
              },
            ]}
          />
        </SectionCard>
      </div>
    </div>
  );
}

// ───────────────────────────── Aba Devolução ─────────────────────────────

function ReturnTab({ c }: { c: ContractDto }) {
  const r = c.returnInspection!;
  const canMoney = c.rentAmount !== null;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <SectionCard
        title="Vistoria da devolução"
        className="lg:col-span-2"
        description={
          r.createdBy
            ? `Registrada por ${r.createdBy} em ${formatDateTime(r.createdAt)}`
            : undefined
        }
      >
        <DetailList
          cols={3}
          className="grid-cols-2"
          items={[
            { label: 'Data da devolução', value: formatYmd(r.returnedAt) },
            { label: 'Km final', value: formatKm(r.finalKm) },
            { label: 'Km rodados', value: formatKm(r.kmDriven) },
            {
              label: 'Estado da moto',
              value: (
                <Badge
                  variant={
                    r.condition === 'DAMAGED'
                      ? 'destructive'
                      : r.condition === 'FAIR'
                        ? 'warning'
                        : 'success'
                  }
                >
                  {RETURN_CONDITION_LABELS[r.condition]}
                </Badge>
              ),
            },
            { label: 'Combustível', value: r.fuelLevel ? FUEL_LEVEL_LABELS[r.fuelLevel] : null },
            { label: 'Moto voltou para', value: MOTORCYCLE_STATUS_LABELS[r.nextMotorcycleStatus] },
            {
              label: 'Caução',
              value: `${DEPOSIT_OUTCOME_LABELS[r.depositOutcome]}${canMoney && r.depositRetainedAmount ? ` · ${formatBRL(r.depositRetainedAmount)} retido` : ''}`,
            },
            {
              label: 'Avarias',
              value: r.damages ? (
                <span className="whitespace-pre-line">{r.damages}</span>
              ) : (
                'Nenhuma'
              ),
              wide: true,
            },
            {
              label: 'Pendências',
              value: r.pendingItems ? (
                <span className="whitespace-pre-line">{r.pendingItems}</span>
              ) : (
                'Nenhuma'
              ),
              wide: true,
            },
            ...(r.notes
              ? [
                  {
                    label: 'Observações',
                    value: <span className="whitespace-pre-line">{r.notes}</span>,
                    wide: true,
                  },
                ]
              : []),
          ]}
        />
      </SectionCard>
      <SectionCard>
        <DocumentsPanel
          ownerType="RETURN"
          ownerId={r.id}
          title="Fotos da devolução"
          defaultType="PHOTO_RETURN"
        />
      </SectionCard>
    </div>
  );
}

// ───────────────────────────── Próximo passo ─────────────────────────────

function NextStep({
  title,
  children,
  actions,
  tone = 'default',
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'muted';
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p
          className={
            tone === 'danger'
              ? 'font-semibold text-destructive'
              : tone === 'warning'
                ? 'font-semibold text-warning'
                : 'font-semibold'
          }
        >
          {title}
        </p>
        {children && <div className="text-sm text-muted-foreground">{children}</div>}
      </div>
      {/* Celular: secundárias lado a lado, a principal (última) larga embaixo. */}
      {actions && (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end [&>*:last-child]:col-span-2 [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Ficha ─────────────────────────────

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [q, setQ] = useUrlState({ tab: 'schedule' });
  const { data: c, isLoading, error } = useContract(id);
  const canManage = useCan(Permission.CONTRACTS_MANAGE);
  const canPayments = useCan(Permission.PAYMENTS_VIEW);
  const canDocuments = useCan(Permission.DOCUMENTS_VIEW);
  const canAudit = useCan(Permission.AUDIT_VIEW);
  const canInvite = useCan(Permission.CUSTOMERS_MANAGE);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [inviteResult, setInviteResult] = useState<PortalInviteResponse | null>(null);
  const invite = useInviteCustomer(c?.customer.id ?? '');
  const confirm = useConfirm();
  const pdf = useContractPdf({ id, number: c?.number ?? 'contrato' });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !c) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Contrato não encontrado"
        description={errorMessage(error)}
        action={<BackLink href="/admin/contracts">Voltar para contratos</BackLink>}
      />
    );
  }

  const today = todayYmd();
  const open = (d: DialogKind) => () => setDialog(d);
  const signed = c.signatureStatus === 'SIGNED';
  const wa = whatsappLink(
    c.customerWhatsapp ?? c.customerPhone,
    `Olá, ${firstName(c.customer.label)}! Aqui é da Locamania.`,
  );
  const tabs = [
    canPayments && 'schedule',
    'contract',
    canDocuments && 'documents',
    c.returnInspection && 'return',
    canAudit && 'history',
  ].filter(Boolean) as string[];
  const tab = tabs.includes(q.tab ?? '') ? q.tab! : tabs[0]!;

  async function offerInvite() {
    if (!c || c.customerPortalEnabled || !canInvite) return;
    const ok = await confirm({
      title: 'Liberar o aplicativo para o cliente?',
      description:
        'Com o app ele acompanha os pagamentos, paga pelo PIX e recebe os avisos de manutenção (§39, etapa 11).',
      confirmText: 'Gerar link de acesso',
      cancelText: 'Agora não',
    });
    if (!ok) return;
    try {
      setInviteResult(await invite.mutateAsync());
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-card hover:bg-accent">
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Mais ações</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canManage && (c.status === 'DRAFT' || c.status === 'ACTIVE') && (
          <DropdownMenuItem onSelect={open('send')}>
            <Send /> Enviar ao cliente
          </DropdownMenuItem>
        )}
        {wa && (
          <DropdownMenuItem onSelect={() => window.open(wa, '_blank', 'noopener')}>
            <WhatsAppIcon className="size-4 text-success" /> Chamar no WhatsApp
          </DropdownMenuItem>
        )}
        {canManage && c.status === 'DRAFT' && (
          <DropdownMenuItem onSelect={open('deliver')}>
            <KeyRound /> Entregar moto
          </DropdownMenuItem>
        )}
        {canManage && c.status === 'ACTIVE' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={open('extend')}>
              <CalendarPlus /> Prorrogar
            </DropdownMenuItem>
            {canPayments && (
              <DropdownMenuItem onSelect={open('adjust')}>
                <TrendingUp /> Reajustar valor
              </DropdownMenuItem>
            )}
          </>
        )}
        {canManage && c.status === 'DRAFT' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={open('cancel')}>
              <Ban /> Cancelar contrato
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Texto e botões do "próximo passo", conforme a etapa.
  let next: ReactNode = null;
  if (c.status === 'CANCELLED') {
    next = (
      <NextStep title={`Cancelado em ${formatDateTime(c.cancelledAt).slice(0, 10)}`} tone="danger">
        {c.cancelReason && <>Motivo: {c.cancelReason}</>}
      </NextStep>
    );
  } else if (c.status === 'DRAFT' && !signed) {
    next = (
      <NextStep
        title="Próximo passo: colher a assinatura"
        actions={
          canManage && (
            <>
              {canPayments && (
                <Button variant="outline" onClick={pdf.print}>
                  <Printer /> Imprimir
                </Button>
              )}
              <Button variant="outline" onClick={open('send')}>
                <Send /> Enviar ao cliente
              </Button>
              <Button onClick={open('sign')}>
                <FileSignature /> Registrar assinatura
              </Button>
            </>
          )
        }
      >
        Imprima para o cliente assinar e registre aqui
        {c.customerPortalEnabled ? ', ou envie para ele aceitar pelo aplicativo' : ''}. A moto está
        reservada.
        {c.sentAt && (
          <span className="block">Enviado ao cliente em {formatDateTime(c.sentAt)}.</span>
        )}
      </NextStep>
    );
  } else if (c.status === 'DRAFT') {
    next = (
      <NextStep
        title="Próximo passo: entregar a moto"
        actions={
          canManage && (
            <Button onClick={open('deliver')}>
              <KeyRound /> Entregar moto
            </Button>
          )
        }
      >
        Assinado em {formatDateTime(c.signedAt)}
        {c.signatureMethod ? ` (${SIGNATURE_METHOD_LABELS[c.signatureMethod].toLowerCase()})` : ''}.
        Na entrega você confirma o km de saída e as cobranças começam.
      </NextStep>
    );
  } else if (c.status === 'ACTIVE') {
    const late = c.daysToEnd !== null && c.daysToEnd < 0;
    next = (
      <NextStep
        title={late ? `Passou do término há ${-c.daysToEnd!} dias` : 'Aluguel em andamento'}
        tone={late ? 'danger' : c.daysToEnd !== null && c.daysToEnd <= 15 ? 'warning' : 'default'}
        actions={
          canManage && (
            <>
              {canPayments && (
                <Button variant="outline" onClick={open('adjust')}>
                  <TrendingUp /> Reajustar
                </Button>
              )}
              <Button variant="outline" onClick={open('extend')}>
                <CalendarPlus /> Prorrogar
              </Button>
              <Button asChild>
                <Link href={`/admin/contracts/${c.id}/return`}>
                  <ClipboardCheck /> Registrar devolução
                </Link>
              </Button>
            </>
          )
        }
      >
        {late
          ? 'Registre a devolução da moto ou prorrogue o contrato.'
          : `Termina em ${formatYmd(c.endDate)} (${relativeDays(c.endDate, today)}).`}
        {c.deliveredAt &&
          ` Moto entregue em ${formatDateTime(c.deliveredAt).slice(0, 10)}${c.initialKm !== null ? ` com ${formatKm(c.initialKm)}` : ''}.`}
      </NextStep>
    );
  } else if (c.status === 'ENDED') {
    next = (
      <NextStep
        title={`Encerrado em ${formatDateTime(c.endedAt).slice(0, 10)}`}
        tone="muted"
        actions={
          c.returnInspection && (
            <Button variant="outline" onClick={() => setQ({ tab: 'return' })}>
              <ClipboardCheck /> Ver vistoria
            </Button>
          )
        }
      >
        {c.returnInspection
          ? `Devolução em ${formatYmd(c.returnInspection.returnedAt)} com ${formatKm(c.returnInspection.finalKm)} (${formatKm(c.returnInspection.kmDriven)} rodados).`
          : 'Contrato encerrado.'}
      </NextStep>
    );
  }

  const nextDueLate = c.nextDueDate && c.nextDueDate < today;
  const draftSchedule = c.rentAmount
    ? buildRentSchedule({
        startDate: c.startDate,
        endDate: c.endDate,
        firstDueDate: c.firstDueDate,
        periodicity: c.periodicity,
        amount: c.rentAmount,
      })
    : null;

  return (
    <div className="space-y-5">
      <BackLink href="/admin/contracts">Contratos</BackLink>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight tabular sm:text-2xl">{c.number}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <ContractStatusBadge status={c.status} />
              {c.status !== 'CANCELLED' &&
                (signed ? (
                  <Badge variant="success">Assinado</Badge>
                ) : (
                  <Badge variant="outline">Aguardando assinatura</Badge>
                ))}
              {c.overdueCount > 0 && (
                <Badge variant="destructive">{c.overdueCount} em atraso</Badge>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/admin/customers/${c.customer.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {c.customer.label}
            </Link>
            {' · '}
            <Link href={`/admin/motorcycles/${c.motorcycle.id}`} className="hover:underline">
              <span className="font-mono">{formatPlate(c.motorcycle.plate)}</span>{' '}
              {c.motorcycle.label}
            </Link>
          </p>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:flex-wrap sm:justify-end">
          {canPayments ? (
            <ContractPdfMenu contract={c} label="Contrato (PDF)" className="w-full sm:w-auto" />
          ) : (
            <span />
          )}
          {menu}
        </div>
      </div>

      {/* Etapas + próximo passo */}
      <SectionCard>
        <div className="space-y-4">
          <ContractStages contract={c} />
          {next}
        </div>
      </SectionCard>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={
            c.rentAmount !== null ? `Valor por ${PERIODICITY_UNIT[c.periodicity]}` : 'Periodicidade'
          }
          value={
            c.rentAmount !== null ? formatBRL(c.rentAmount) : PERIODICITY_LABELS[c.periodicity]
          }
          hint={
            c.rentAmount !== null
              ? `${PERIODICITY_LABELS[c.periodicity]}${c.depositAmount ? ` · caução ${formatBRL(c.depositAmount)}` : ''}`
              : undefined
          }
          icon={Wallet}
        />
        <StatCard
          label="Término"
          value={formatYmd(c.endDate)}
          hint={
            c.status === 'ACTIVE'
              ? relativeDays(c.endDate, today)
              : `desde ${formatYmd(c.startDate)} · ${durationLabel(c.startDate, c.endDate)}`
          }
          icon={CalendarClock}
          tone={
            c.status === 'ACTIVE' && c.daysToEnd !== null && c.daysToEnd <= 15
              ? 'warning'
              : 'default'
          }
        />
        <StatCard
          label={nextDueLate ? 'Vencida desde' : 'Próximo vencimento'}
          value={c.nextDueDate ? formatYmd(c.nextDueDate) : '—'}
          hint={
            c.nextDueDate
              ? relativeDays(c.nextDueDate, today)
              : c.status === 'DRAFT'
                ? 'Cobranças começam na entrega'
                : 'Nada a vencer'
          }
          icon={nextDueLate ? TriangleAlert : CalendarClock}
          tone={nextDueLate ? 'danger' : 'warning'}
        />
        {(c.status === 'DRAFT' || c.status === 'CANCELLED') && draftSchedule ? (
          <StatCard
            label={c.status === 'CANCELLED' ? 'Total previsto' : 'Total do contrato'}
            value={formatBRL(scheduleTotal(draftSchedule))}
            hint={`${draftSchedule.length} parcelas${c.depositAmount ? ` + caução ${formatBRL(c.depositAmount)}` : ''}`}
            icon={Wallet}
            tone="muted"
          />
        ) : c.totals ? (
          <StatCard
            label={Number(c.totals.overdue) > 0 ? 'Em atraso' : 'Total pago'}
            value={formatBRL(Number(c.totals.overdue) > 0 ? c.totals.overdue : c.totals.paid)}
            hint={
              Number(c.totals.overdue) > 0
                ? `Pago ${formatBRL(c.totals.paid)} · a vencer ${formatBRL(c.totals.pending)}`
                : `A vencer ${formatBRL(c.totals.pending)}`
            }
            icon={Number(c.totals.overdue) > 0 ? TriangleAlert : CheckCircle2}
            tone={Number(c.totals.overdue) > 0 ? 'danger' : 'success'}
          />
        ) : (
          <StatCard
            label="Km de saída"
            value={c.initialKm !== null ? formatKm(c.initialKm) : '—'}
            hint={c.initialKm === null ? 'Registrado na entrega' : undefined}
            icon={Bike}
            tone="muted"
          />
        )}
      </div>

      <Tabs defaultValue={tabs[0]!} value={tab} onValueChange={(t) => setQ({ tab: t })}>
        <TabsList>
          {canPayments && <TabsTrigger value="schedule">Cronograma</TabsTrigger>}
          <TabsTrigger value="contract">Contrato</TabsTrigger>
          {canDocuments && <TabsTrigger value="documents">Documentos</TabsTrigger>}
          {c.returnInspection && <TabsTrigger value="return">Devolução</TabsTrigger>}
          {canAudit && <TabsTrigger value="history">Histórico</TabsTrigger>}
        </TabsList>
        <TabsContent value="schedule" className="pt-5">
          <ScheduleTab c={c} />
        </TabsContent>
        <TabsContent value="contract" className="pt-5">
          <ContractTab c={c} />
        </TabsContent>
        <TabsContent value="documents" className="pt-5">
          <SectionCard>
            <DocumentsPanel
              ownerType="CONTRACT"
              ownerId={c.id}
              title="Documentos e fotos do contrato"
            />
          </SectionCard>
        </TabsContent>
        {c.returnInspection && (
          <TabsContent value="return" className="pt-5">
            <ReturnTab c={c} />
          </TabsContent>
        )}
        <TabsContent value="history" className="pt-5">
          <SectionCard>
            <Timeline entityType="Contract" entityId={c.id} />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <SendContractDialog
        contract={c}
        open={dialog === 'send'}
        onOpenChange={(v) => !v && setDialog(null)}
      />
      <SignContractDialog
        contract={c}
        open={dialog === 'sign'}
        onOpenChange={(v) => !v && setDialog(null)}
      />
      <DeliverContractDialog
        contract={c}
        open={dialog === 'deliver'}
        onOpenChange={(v) => !v && setDialog(null)}
        onNeedSignature={() => setDialog('sign')}
        onDelivered={offerInvite}
      />
      <AdjustRentDialog
        contract={c}
        open={dialog === 'adjust'}
        onOpenChange={(v) => !v && setDialog(null)}
      />
      <ExtendContractDialog
        contract={c}
        open={dialog === 'extend'}
        onOpenChange={(v) => !v && setDialog(null)}
      />
      <CancelContractDialog
        contract={c}
        open={dialog === 'cancel'}
        onOpenChange={(v) => !v && setDialog(null)}
      />
      <InviteDialog invite={inviteResult} onOpenChange={(v) => !v && setInviteResult(null)} />
    </div>
  );
}
