'use client';

import {
  MOTORCYCLE_STATUS_LABELS,
  ParameterKey,
  Permission,
  sumMoney,
  type MaintenancePlanDto,
  type MotorcycleDto,
} from '@locamania/shared';
import {
  Archive,
  CheckCircle2,
  FilePlus2,
  Gauge,
  Info,
  MoreHorizontal,
  Pencil,
  Repeat,
  Satellite,
  TriangleAlert,
  UserRound,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ContractList } from '@/components/contracts/contract-list';
import { dueText, nextMaintenanceText } from '@/components/maintenance/due-text';
import { useMaintenanceDialogs } from '@/components/maintenance/maintenance-dialogs';
import { MaintenanceRecordList } from '@/components/maintenance/record-list';
import { MaintenancePlans } from '@/components/motorcycles/maintenance-plans';
import {
  MotorcycleStatusDialog,
  OdometerDialog,
} from '@/components/motorcycles/motorcycle-dialogs';
import { MotorcycleHistory } from '@/components/motorcycles/motorcycle-history';
import { OdometerPanel } from '@/components/motorcycles/odometer-panel';
import { Plate } from '@/components/motorcycles/plate';
import { OccurrenceList } from '@/components/occurrences/occurrence-list';
import { DocumentsPanel } from '@/components/shared/documents-panel';
import { Timeline } from '@/components/shared/timeline';
import { TrackerPanel } from '@/components/tracking/tracker-panel';
import { providerLabel } from '@/components/tracking/tracking-meta';
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
import { Skeleton } from '@/components/ui/skeleton';
import { MaintenanceDueBadge, MotorcycleStatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useNumberParameter, usePlansOf } from '@/lib/motorcycles/queries';
import {
  useArchiveMotorcycle,
  useContracts,
  useMaintenanceRecords,
  useMotorcycle,
  useOccurrences,
} from '@/lib/queries';
import { useUrlState } from '@/lib/use-url-state';
import {
  cn,
  formatBRL,
  formatDateTime,
  formatKm,
  formatPlate,
  formatYmd,
  plural,
} from '@/lib/utils';

/** Valor do StatCard carregando (fica dentro de <p>: tem de ser <span>). */
const LoadingValue = () => (
  <span
    className="inline-block h-6 w-20 animate-pulse rounded-md bg-muted align-middle"
    aria-label="Carregando"
  />
);

const RANK = { OVERDUE: 0, DUE_SOON: 1, OK: 2 } as const;
const byUrgency = (a: MaintenancePlanDto, b: MaintenancePlanDto) =>
  RANK[a.due.status] - RANK[b.due.status] ||
  Math.min(a.due.kmRemaining ?? 1e9, (a.due.daysRemaining ?? 1e9) * 150) -
    Math.min(b.due.kmRemaining ?? 1e9, (b.due.daysRemaining ?? 1e9) * 150);

function SummaryTab({
  m,
  plans,
  canFinance,
  canContract,
  canCustomers,
  canMaintenance,
  canTracking,
  goTab,
}: {
  m: MotorcycleDto;
  plans: MaintenancePlanDto[] | undefined;
  canFinance: boolean;
  canContract: boolean;
  canCustomers: boolean;
  canMaintenance: boolean;
  canTracking: boolean;
  goTab: (tab: string) => void;
}) {
  const top = (plans ?? [])
    .filter((p) => p.active)
    .sort(byUrgency)
    .slice(0, 4);
  const years = [m.manufactureYear, m.modelYear].filter(Boolean).join('/');
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <SectionCard title="Dados da moto">
          <DetailList
            cols={3}
            className="grid-cols-2"
            items={[
              { label: 'Marca', value: m.brandLabel },
              { label: 'Modelo', value: m.modelLabel },
              { label: 'Ano (fabricação/modelo)', value: years || null },
              { label: 'Cor', value: m.color },
              { label: 'Placa', value: <span className="font-mono">{formatPlate(m.plate)}</span> },
              {
                label: 'RENAVAM',
                value: m.renavam ? <span className="font-mono">{m.renavam}</span> : null,
              },
              {
                label: 'Chassi',
                value: m.chassis ? <span className="break-all font-mono">{m.chassis}</span> : null,
              },
              { label: 'Data de aquisição', value: m.acquiredAt ? formatYmd(m.acquiredAt) : null },
              ...(canFinance
                ? [
                    {
                      label: 'Valor da moto',
                      value: m.purchasePrice !== null ? formatBRL(m.purchasePrice) : null,
                    },
                  ]
                : []),
              { label: 'Cadastrada em', value: formatDateTime(m.createdAt) },
            ]}
          />
        </SectionCard>
        {(m.notes || (m.statusReason && m.status !== 'RENTED')) && (
          <SectionCard title="Observações">
            {m.statusReason && m.status !== 'RENTED' && (
              <p
                className={cn(
                  'mb-2 rounded-lg p-3 text-sm',
                  m.status === 'BLOCKED' || m.status === 'INACTIVE'
                    ? 'bg-destructive/8 text-destructive'
                    : 'bg-muted',
                )}
              >
                <strong className="font-medium">{MOTORCYCLE_STATUS_LABELS[m.status]}:</strong>{' '}
                {m.statusReason}
              </p>
            )}
            {m.notes && <p className="whitespace-pre-line text-sm">{m.notes}</p>}
          </SectionCard>
        )}
      </div>
      <div className="space-y-5">
        <SectionCard title="Aluguel atual">
          {m.currentRental ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-info/12 text-info">
                  <UserRound className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  {canCustomers ? (
                    <Link
                      href={`/admin/customers/${m.currentRental.customerId}`}
                      className="block truncate font-medium text-primary hover:underline"
                    >
                      {m.currentRental.customerName}
                    </Link>
                  ) : (
                    <p className="truncate font-medium">{m.currentRental.customerName}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {MOTORCYCLE_STATUS_LABELS[m.status]}
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/admin/contracts/${m.currentRental.contractId}`}>Ver contrato</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {m.status === 'AVAILABLE'
                  ? m.idleDays
                    ? `Disponível e parada há ${plural(m.idleDays, 'dia', 'dias')}.`
                    : 'Disponível para alugar.'
                  : `Sem aluguel — ${MOTORCYCLE_STATUS_LABELS[m.status].toLowerCase()}.`}
              </p>
              {canContract && m.status === 'AVAILABLE' && (
                <Button asChild size="sm" className="w-full">
                  <Link href={`/admin/contracts/new?motorcycleId=${m.id}`}>
                    <FilePlus2 /> Novo aluguel
                  </Link>
                </Button>
              )}
            </div>
          )}
        </SectionCard>
        {canMaintenance && (
          <SectionCard
            title="Manutenção"
            actions={
              <Button size="sm" variant="ghost" onClick={() => goTab('maintenance')}>
                Ver tudo
              </Button>
            }
          >
            {!plans ? (
              <Skeleton className="h-24 w-full" />
            ) : top.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum plano ativo.</p>
            ) : (
              <ul className="space-y-2.5">
                {top.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.type.name}</span>
                      <span
                        className={cn(
                          'block text-xs',
                          p.due.status === 'OVERDUE'
                            ? 'text-destructive'
                            : p.due.status === 'DUE_SOON'
                              ? 'text-warning'
                              : 'text-muted-foreground',
                        )}
                      >
                        {dueText(p.due)}
                      </span>
                    </span>
                    <MaintenanceDueBadge status={p.due.status} className="shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}
        <SectionCard
          title="Rastreador"
          actions={
            m.hasTracker && canTracking ? (
              <Button size="sm" variant="ghost" onClick={() => goTab('tracking')}>
                Abrir
              </Button>
            ) : undefined
          }
        >
          {m.hasTracker ? (
            <DetailList
              cols={1}
              items={[
                { label: 'Fornecedor', value: providerLabel(m.trackerProvider) },
                {
                  label: 'Identificação',
                  value: m.trackerDeviceId ? (
                    <span className="font-mono">{m.trackerDeviceId}</span>
                  ) : (
                    <span className="text-warning">Não cadastrada</span>
                  ),
                },
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sem rastreador instalado.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default function MotorcycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [q, setQ] = useUrlState({ tab: 'summary', created: '', history: 'timeline' });
  const { data: m, isLoading, error } = useMotorcycle(id);
  const canManage = useCan(Permission.MOTORCYCLES_MANAGE);
  const canContract = useCan(Permission.CONTRACTS_MANAGE);
  const canContracts = useCan(Permission.CONTRACTS_VIEW);
  const canCustomers = useCan(Permission.CUSTOMERS_VIEW);
  const canMaintenance = useCan(Permission.MAINTENANCE_VIEW);
  const canMaintManage = useCan(Permission.MAINTENANCE_MANAGE);
  const canOccurrences = useCan(Permission.OCCURRENCES_VIEW);
  const canDocuments = useCan(Permission.DOCUMENTS_VIEW);
  const canTracking = useCan(Permission.TRACKING_VIEW);
  const canFinance = useCan(Permission.FINANCE_VIEW);
  const canAudit = useCan(Permission.AUDIT_VIEW);
  const idleLimit = useNumberParameter(ParameterKey.IDLE_MOTORCYCLE_DAYS, 7);

  const plans = usePlansOf(id, canMaintenance);
  const onMaintTab = canMaintenance && q.tab === 'maintenance';
  const scheduled = useMaintenanceRecords(
    'scheduled',
    { motorcycleId: id, pageSize: 50 },
    onMaintTab,
  );
  const inProgress = useMaintenanceRecords(
    'in_progress',
    { motorcycleId: id, pageSize: 50 },
    onMaintTab,
  );
  const done = useMaintenanceRecords('done', { motorcycleId: id, pageSize: 100 }, canMaintenance);
  const contracts = useContracts(
    { motorcycleId: id, pageSize: 50 },
    canContracts && q.tab === 'rentals',
  );
  const occurrences = useOccurrences(
    { motorcycleId: id, pageSize: 50 },
    canOccurrences && q.tab === 'occurrences',
  );
  const archive = useArchiveMotorcycle();
  const confirm = useConfirm();
  const [statusOpen, setStatusOpen] = useState(false);
  const [odoOpen, setOdoOpen] = useState(false);
  const { openRecord, openNew, openComplete, start, dialogs } = useMaintenanceDialogs();

  const openRecords = useMemo(
    () => [...(inProgress.data?.data ?? []), ...(scheduled.data?.data ?? [])],
    [inProgress.data, scheduled.data],
  );
  const doneRows = done.data?.data;
  const maintenanceCost = useMemo(
    () => (doneRows && canFinance ? sumMoney(...doneRows.map((r) => r.cost ?? 0)) : null),
    [doneRows, canFinance],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-24" />
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
  if (error || !m) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Moto não encontrada"
        description={errorMessage(error)}
        action={<BackLink href="/admin/motorcycles">Voltar para motos</BackLink>}
      />
    );
  }

  const goTab = (tab: string) => {
    setQ({ tab });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const newMaintenance = () =>
    openNew({
      motorcycle: { id: m.id, plate: m.plate, label: m.label },
      status: m.status === 'RENTED' ? 'SCHEDULED' : 'IN_PROGRESS',
    });
  const canRent = canContract && m.status === 'AVAILABLE';
  const years = [m.manufactureYear, m.modelYear].filter(Boolean).join('/');

  const menu = (canManage || canMaintManage) && (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-card hover:bg-accent">
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Mais ações</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canManage && (
          <DropdownMenuItem onSelect={() => setStatusOpen(true)}>
            <Repeat /> Mudar situação
          </DropdownMenuItem>
        )}
        {canManage && (
          <DropdownMenuItem onSelect={() => router.push(`/admin/motorcycles/${m.id}/edit`)}>
            <Pencil /> Editar dados
          </DropdownMenuItem>
        )}
        {canMaintManage && (
          <DropdownMenuItem onSelect={newMaintenance}>
            <Wrench /> Registrar manutenção
          </DropdownMenuItem>
        )}
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={async () => {
                const ok = await confirm({
                  title: 'Arquivar moto?',
                  description:
                    'Ela sai das listas, mas aluguéis, manutenções e histórico continuam guardados. Moto com contrato aberto não pode ser arquivada.',
                  confirmText: 'Arquivar',
                  variant: 'destructive',
                });
                if (!ok) return;
                try {
                  await archive.mutateAsync(m.id);
                  toast.success('Moto arquivada', { description: formatPlate(m.plate) });
                  router.push('/admin/motorcycles');
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              <Archive /> Arquivar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const next = m.nextMaintenance;
  const lastDone = doneRows?.[0];

  return (
    <div className="space-y-5">
      <BackLink href="/admin/motorcycles">Motos</BackLink>

      {q.created && (
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/8 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2">
            <p>
              <strong className="font-semibold">Moto cadastrada.</strong> Os planos de manutenção
              padrão (troca de óleo, revisão, freios, pneus...) já foram criados, contando a partir
              de hoje e de {formatKm(m.currentKm)}. Confira e ajuste se a moto fez algum serviço
              recente.
            </p>
            {canMaintenance && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQ({ tab: 'maintenance', created: '' })}
              >
                <Wrench /> Ver planos de manutenção
              </Button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setQ({ created: '' })}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            aria-label="Fechar aviso"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Cabeçalho da ficha */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Plate plate={m.plate} size="lg" />
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
              {m.label}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <MotorcycleStatusBadge status={m.status} />
              {m.maintenanceDue !== 'OK' && <MaintenanceDueBadge status={m.maintenanceDue} />}
              {m.hasTracker && (
                <Badge variant="outline">
                  <Satellite className="size-3" /> Rastreador
                </Badge>
              )}
              {(years || m.color) && (
                <span className="text-sm text-muted-foreground">
                  {[years, m.color].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            {m.statusReason && m.status !== 'RENTED' && (
              <p className="text-sm text-muted-foreground">{m.statusReason}</p>
            )}
          </div>
        </div>
        {(canManage || canMaintManage || canRent) && (
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {canManage && (
              <Button
                variant="outline"
                onClick={() => setOdoOpen(true)}
                className={cn(!canMaintManage && 'col-span-2')}
              >
                <Gauge /> Registrar km
              </Button>
            )}
            {canMaintManage && (
              <Button
                variant="outline"
                onClick={newMaintenance}
                className={cn(!canManage && 'col-span-2')}
              >
                <Wrench /> <span className="sm:hidden">Manutenção</span>
                <span className="hidden sm:inline">Registrar manutenção</span>
              </Button>
            )}
            {canManage && (
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link href={`/admin/motorcycles/${m.id}/edit`}>
                  <Pencil /> Editar
                </Link>
              </Button>
            )}
            {menu}
            {canRent && (
              <Button asChild className="col-span-full sm:col-auto">
                <Link href={`/admin/contracts/new?motorcycleId=${m.id}`}>
                  <FilePlus2 /> Novo aluguel
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Quilometragem"
          value={formatKm(m.currentKm)}
          hint={
            m.lastOdometerAt
              ? `Leitura em ${formatDateTime(m.lastOdometerAt).slice(0, 10)}`
              : 'Sem leitura registrada'
          }
          icon={Gauge}
        />
        {m.currentRental ? (
          <StatCard
            label="Com o cliente"
            value={m.currentRental.customerName.split(' ').slice(0, 2).join(' ')}
            hint={
              m.currentRental.customerName.split(' ').length > 2
                ? m.currentRental.customerName
                : 'Aluguel ativo'
            }
            icon={UserRound}
            tone="info"
            href={canCustomers ? `/admin/customers/${m.currentRental.customerId}` : undefined}
          />
        ) : m.status === 'AVAILABLE' ? (
          <StatCard
            label="Parada"
            value={m.idleDays ? plural(m.idleDays, 'dia', 'dias') : 'Desde hoje'}
            hint="Disponível para alugar"
            icon={UserRound}
            tone={m.idleDays && m.idleDays >= idleLimit ? 'warning' : 'success'}
          />
        ) : (
          <StatCard
            label="Situação"
            value={MOTORCYCLE_STATUS_LABELS[m.status]}
            hint={m.statusReason ?? 'Sem cliente'}
            icon={Info}
            tone={m.status === 'BLOCKED' ? 'danger' : 'muted'}
          />
        )}
        {canMaintenance ? (
          <button
            type="button"
            onClick={() => goTab('maintenance')}
            className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StatCard
              label="Próxima manutenção"
              value={next?.typeName ?? 'Sem plano'}
              hint={
                next
                  ? `${nextMaintenanceText(next)}${next.nextDueDate ? ` · até ${formatYmd(next.nextDueDate)}` : ''}`
                  : undefined
              }
              icon={Wrench}
              tone={
                m.maintenanceDue === 'OVERDUE'
                  ? 'danger'
                  : m.maintenanceDue === 'DUE_SOON'
                    ? 'warning'
                    : 'success'
              }
              className="h-full hover:border-ring/40 hover:bg-accent/30"
            />
          </button>
        ) : (
          <StatCard
            label="Próxima manutenção"
            value={next?.typeName ?? '—'}
            hint={next ? nextMaintenanceText(next) : undefined}
            icon={Wrench}
          />
        )}
        {canFinance && canMaintenance ? (
          <StatCard
            label="Gasto na oficina"
            value={maintenanceCost !== null ? formatBRL(maintenanceCost) : <LoadingValue />}
            hint={
              done.data
                ? done.data.total
                  ? plural(done.data.total, 'serviço realizado', 'serviços realizados')
                  : 'Nenhum serviço ainda'
                : undefined
            }
            icon={Wallet}
            tone="muted"
          />
        ) : canMaintenance ? (
          <StatCard
            label="Serviços realizados"
            value={done.data ? done.data.total : <LoadingValue />}
            hint={
              lastDone?.completedAt ? `Último em ${formatYmd(lastDone.completedAt)}` : undefined
            }
            icon={CheckCircle2}
            tone="muted"
          />
        ) : null}
      </div>

      <Tabs defaultValue="summary" value={q.tab} onValueChange={(tab) => setQ({ tab })}>
        <TabsList>
          <TabsTrigger value="summary">Resumo</TabsTrigger>
          {canContracts && <TabsTrigger value="rentals">Aluguéis</TabsTrigger>}
          {canMaintenance && (
            <TabsTrigger value="maintenance">
              Manutenção
              {m.maintenanceDue !== 'OK' && (
                <span
                  className={cn(
                    'size-2 rounded-full',
                    m.maintenanceDue === 'OVERDUE' ? 'bg-destructive' : 'bg-warning',
                  )}
                  aria-label="Atenção"
                />
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="odometer">Quilometragem</TabsTrigger>
          {canDocuments && <TabsTrigger value="documents">Documentos</TabsTrigger>}
          {canOccurrences && <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>}
          {canTracking && m.hasTracker && <TabsTrigger value="tracking">Rastreamento</TabsTrigger>}
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <SummaryTab
            m={m}
            plans={plans.data}
            canFinance={canFinance}
            canContract={canContract}
            canCustomers={canCustomers}
            canMaintenance={canMaintenance}
            canTracking={canTracking}
            goTab={goTab}
          />
        </TabsContent>

        <TabsContent value="rentals">
          <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-lg sm:border">
            <ContractList
              rows={contracts.data?.data}
              loading={contracts.isLoading}
              hide={['motorcycle']}
              empty={{
                title: 'Nenhum aluguel',
                description: 'Os contratos desta moto aparecem aqui.',
                action: canRent ? (
                  <Button asChild>
                    <Link href={`/admin/contracts/new?motorcycleId=${m.id}`}>
                      <FilePlus2 /> Novo aluguel
                    </Link>
                  </Button>
                ) : undefined,
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-6">
          {(openRecords.length > 0 || canMaintManage) && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">Em aberto</h3>
                  <p className="text-sm text-muted-foreground">Agendadas e em andamento.</p>
                </div>
                {canMaintManage && (
                  <Button size="sm" onClick={newMaintenance}>
                    <Wrench /> Registrar manutenção
                  </Button>
                )}
              </div>
              {scheduled.data && inProgress.data && openRecords.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                  Nenhuma manutenção agendada ou em andamento para esta moto.
                </p>
              ) : (
                <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-lg sm:border">
                  <MaintenanceRecordList
                    rows={scheduled.data && inProgress.data ? openRecords : undefined}
                    loading={scheduled.isLoading || inProgress.isLoading}
                    hideMotorcycle
                    showStatus
                    showCost={false}
                    onOpen={(r) => openRecord(r.id)}
                    onStart={canMaintManage ? start : undefined}
                    onComplete={canMaintManage ? openComplete : undefined}
                    empty={{ title: 'Nada em aberto' }}
                  />
                </div>
              )}
            </div>
          )}
          <MaintenancePlans
            motorcycle={m}
            plans={plans.data}
            loading={plans.isLoading}
            canManage={canMaintManage}
          />
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold">Serviços realizados</h3>
              <p className="text-sm text-muted-foreground">
                {maintenanceCost !== null && doneRows?.length
                  ? `${formatBRL(maintenanceCost)} em ${plural(done.data!.total, 'serviço', 'serviços')}.`
                  : 'Tudo o que já foi feito nesta moto.'}
              </p>
            </div>
            <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-lg sm:border">
              <MaintenanceRecordList
                rows={doneRows}
                loading={done.isLoading}
                hideMotorcycle
                showCost={canFinance}
                onOpen={(r) => openRecord(r.id)}
                empty={{ title: 'Nenhum serviço realizado ainda' }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="odometer">
          <OdometerPanel
            motorcycleId={m.id}
            onAdd={canManage ? () => setOdoOpen(true) : undefined}
          />
        </TabsContent>

        <TabsContent value="documents">
          <SectionCard>
            <p className="mb-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              CRLV, licenciamento, IPVA, seguro, notas fiscais e comprovantes. O CRLV já vem marcado
              como <strong className="font-medium">visível para o cliente no app</strong>; notas e
              comprovantes, deixe desmarcado.
            </p>
            <DocumentsPanel
              ownerType="MOTORCYCLE"
              ownerId={m.id}
              defaultType="CRLV"
              defaultVisible
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="occurrences">
          <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-lg sm:border">
            <OccurrenceList
              rows={occurrences.data?.data}
              loading={occurrences.isLoading}
              hide={['motorcycle']}
              empty={{
                title: 'Nenhuma ocorrência ou multa',
                description: 'Multas, acidentes e avarias desta moto aparecem aqui.',
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="tracking">
          <TrackerPanel motorcycleId={m.id} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {canAudit && (
            <FilterChips
              value={q.history === 'audit' ? 'audit' : 'timeline'}
              onChange={(v) => setQ({ history: v })}
              options={[
                { value: 'timeline', label: 'Linha do tempo' },
                { value: 'audit', label: 'Alterações no cadastro' },
              ]}
            />
          )}
          <SectionCard>
            {canAudit && q.history === 'audit' ? (
              <Timeline entityType="Motorcycle" entityId={m.id} />
            ) : (
              <MotorcycleHistory
                motorcycleId={m.id}
                onOpenRecord={canMaintenance ? openRecord : undefined}
              />
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <MotorcycleStatusDialog motorcycle={m} open={statusOpen} onOpenChange={setStatusOpen} />
      <OdometerDialog motorcycle={m} open={odoOpen} onOpenChange={setOdoOpen} />
      {dialogs}
    </div>
  );
}
