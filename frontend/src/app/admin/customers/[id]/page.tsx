'use client';

import {

  Permission,
  formatCep,
  formatCpf,
  formatPhone,
  formatPlate,
  todayYmd,
  whatsappLink,
  type ChargeDisplayStatus,
  type CustomerDto,
  type PortalInviteResponse,
} from '@locamania/shared';
import {
  Archive,
  Ban,
  Bike,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  FilePlus2,
  Gavel,
  MoreHorizontal,
  Pencil,
  Phone,
  Smartphone,
  TriangleAlert,
  UserX,
  Wallet,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ChargeList } from '@/components/charges/charge-list';
import { ContractList } from '@/components/contracts/contract-list';
import { InviteDialog, StatusDialog } from '@/components/customers/customer-dialogs';
import { OccurrenceList } from '@/components/occurrences/occurrence-list';
import { DocumentsPanel } from '@/components/shared/documents-panel';
import { Timeline } from '@/components/shared/timeline';
import { WhatsAppIcon } from '@/components/shared/whatsapp-icon';
import { Avatar } from '@/components/ui/avatar';
import { BackLink } from '@/components/ui/back-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { DetailList, FilterChips, SectionCard, StatCard } from '@/components/ui/kit';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomerStatusBadge, ExpiryBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import {
  useArchiveCustomer,
  useCharges,
  useContracts,
  useCustomer,
  useCustomerCollection,
  useCustomerStatus,
  useDisablePortal,
  useInviteCustomer,
  useOccurrences,
} from '@/lib/queries';
import { useUrlState } from '@/lib/use-url-state';
import { formatBRL, formatDateTime, formatYmd, relativeDays } from '@/lib/utils';

type ChargeFilter = 'open' | ChargeDisplayStatus | 'all';

function PaymentsTab({ customer }: { customer: CustomerDto }) {
  const [filter, setFilter] = useState<ChargeFilter>('open');
  const { data: overdue } = useCharges({ customerId: customer.id, status: 'OVERDUE', pageSize: 100 });
  const status = filter === 'open' || filter === 'all' ? undefined : filter;
  const { data, isLoading } = useCharges({ customerId: customer.id, status, pageSize: 100 }, filter !== 'open');
  const { data: upcoming } = useCharges({ customerId: customer.id, status: 'DUE_SOON', pageSize: 100 }, filter === 'open');
  const { data: later } = useCharges({ customerId: customer.id, status: 'UPCOMING', pageSize: 10 }, filter === 'open');
  const rows =
    filter === 'open' ? (overdue && upcoming && later ? [...overdue.data, ...upcoming.data, ...later.data] : undefined) : data?.data;
  return (
    <div className="space-y-4">
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'open', label: 'Em aberto' },
          { value: 'OVERDUE', label: 'Em atraso', count: overdue?.total, tone: 'danger' },
          { value: 'PAID', label: 'Pagas' },
          { value: 'CANCELLED', label: 'Canceladas' },
          { value: 'all', label: 'Todas' },
        ]}
      />
      <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-lg sm:border">
        <ChargeList
          rows={rows}
          loading={filter === 'open' ? !rows : isLoading}
          hide={['customer']}
          empty={{ title: filter === 'open' ? 'Nada em aberto' : 'Nenhuma cobrança aqui', description: filter === 'open' ? 'Este cliente está em dia.' : undefined }}
        />
      </div>
    </div>
  );
}

function SummaryTab({ c }: { c: CustomerDto }) {
  const address = [c.street && `${c.street}${c.streetNumber ? `, ${c.streetNumber}` : ''}`, c.complement, c.district, [c.city, c.state].filter(Boolean).join('/'), c.postalCode && formatCep(c.postalCode)]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <SectionCard title="Dados do cliente">
          <DetailList
            items={[
              { label: 'CPF', value: formatCpf(c.cpf) },
              { label: 'RG', value: c.rg },
              { label: 'Nascimento', value: c.birthDate ? formatYmd(c.birthDate) : null },
              { label: 'Celular', value: c.phone ? formatPhone(c.phone) : null },
              { label: 'WhatsApp', value: c.whatsapp ? formatPhone(c.whatsapp) : null },
              { label: 'E-mail', value: c.email },
              { label: 'Endereço', value: address || null, wide: true },
            ]}
          />
        </SectionCard>
        <SectionCard title="CNH">
          <DetailList
            cols={3}
            items={[
              { label: 'Número', value: c.cnhNumber },
              { label: 'Categoria', value: c.cnhCategory },
              {
                label: 'Validade',
                value: c.cnhExpiresAt ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {formatYmd(c.cnhExpiresAt)} <ExpiryBadge state={c.cnhState} />
                  </span>
                ) : null,
              },
            ]}
          />
        </SectionCard>
        {(c.notes || c.blockedReason) && (
          <SectionCard title="Observações">
            {c.blockedReason && (
              <p className="mb-2 rounded-lg bg-destructive/8 p-3 text-sm text-destructive">
                <strong>Motivo do {c.manualStatus === 'INACTIVE' ? 'inativação' : 'bloqueio'}:</strong> {c.blockedReason}
              </p>
            )}
            {c.notes && <p className="whitespace-pre-line text-sm">{c.notes}</p>}
          </SectionCard>
        )}
      </div>
      <div className="space-y-5">
        <SectionCard title="Documentos entregues">
          <ul className="space-y-2">
            {c.documentsChecklist.map((d) => (
              <li key={d.typeCode} className="flex items-center gap-2 text-sm">
                {d.delivered ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <XCircle className="size-4 text-muted-foreground" aria-hidden />}
                <span className={d.delivered ? undefined : 'text-muted-foreground'}>{d.label}</span>
                <span className="sr-only">{d.delivered ? 'entregue' : 'pendente'}</span>
                {d.expiresAt && <span className="ml-auto text-xs text-muted-foreground">vence {formatYmd(d.expiresAt)}</span>}
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Aplicativo do cliente">
          <DetailList
            cols={1}
            items={[
              { label: 'Acesso', value: c.portalEnabled ? <Badge variant="success">Liberado</Badge> : <Badge variant="muted">Não liberado</Badge> },
              { label: 'Último acesso', value: c.portalLastLoginAt ? formatDateTime(c.portalLastLoginAt) : 'Nunca entrou' },
              { label: 'Aceite de privacidade (LGPD)', value: c.privacyAcceptedAt ? formatDateTime(c.privacyAcceptedAt) : 'Pendente' },
              { label: 'Cliente desde', value: formatDateTime(c.createdAt) },
            ]}
          />
        </SectionCard>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [q, setQ] = useUrlState({ tab: 'summary' });
  const { data: c, isLoading, error } = useCustomer(id);
  const canManage = useCan(Permission.CUSTOMERS_MANAGE);
  const canContract = useCan(Permission.CONTRACTS_MANAGE);
  const canPayments = useCan(Permission.PAYMENTS_VIEW);
  const canContracts = useCan(Permission.CONTRACTS_VIEW);
  const canOccurrences = useCan(Permission.OCCURRENCES_VIEW);
  const canDocuments = useCan(Permission.DOCUMENTS_VIEW);
  const canAudit = useCan(Permission.AUDIT_VIEW);
  const contracts = useContracts({ customerId: id, pageSize: 50 }, canContracts && q.tab === 'contracts');
  const occurrences = useOccurrences({ customerId: id, pageSize: 50 }, canOccurrences && q.tab === 'occurrences');
  const invite = useInviteCustomer(id);
  const disablePortal = useDisablePortal(id);
  const setStatus = useCustomerStatus(id);
  const collection = useCustomerCollection(id);
  const archive = useArchiveCustomer();
  const confirm = useConfirm();
  const [inviteResult, setInviteResult] = useState<PortalInviteResponse | null>(null);
  const [statusTarget, setStatusTarget] = useState<'BLOCKED' | 'INACTIVE' | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !c) {
    return <EmptyState icon={TriangleAlert} title="Cliente não encontrado" description={errorMessage(error)} action={<BackLink href="/admin/customers">Voltar para clientes</BackLink>} />;
  }

  const wa = whatsappLink(c.whatsapp ?? c.phone, `Olá, ${c.name.split(' ')[0]}! Aqui é da Locamania.`);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const menu = canManage && (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-card hover:bg-accent">
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Mais ações</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => act(async () => setInviteResult(await invite.mutateAsync()), 'Link de acesso gerado')}>
          <Smartphone /> {c.portalEnabled ? 'Reenviar acesso ao app' : 'Enviar acesso ao app'}
        </DropdownMenuItem>
        {c.portalEnabled && (
          <DropdownMenuItem
            onSelect={async () => {
              if (await confirm({ title: 'Desativar o acesso ao app?', description: 'O cliente sai do aplicativo na hora e não consegue mais entrar.', confirmText: 'Desativar', variant: 'destructive' }))
                await act(() => disablePortal.mutateAsync(), 'Acesso ao app desativado');
            }}
          >
            <CircleSlash /> Desativar acesso ao app
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {c.manualStatus ? (
          <DropdownMenuItem onSelect={() => act(() => setStatus.mutateAsync({ manualStatus: null }), c.manualStatus === 'BLOCKED' ? 'Cliente desbloqueado' : 'Cliente reativado')}>
            <CheckCircle2 /> {c.manualStatus === 'BLOCKED' ? 'Desbloquear' : 'Reativar'}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => setStatusTarget('BLOCKED')}>
              <Ban /> Bloquear
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setStatusTarget('INACTIVE')}>
              <UserX /> Inativar
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem
          onSelect={async () => {
            if (c.inCollection) return act(() => collection.mutateAsync(false), 'Cliente retirado da cobrança');
            if (await confirm({ title: 'Encaminhar para cobrança?', description: 'Marca o cliente como "em cobrança" (§17). Os lembretes automáticos continuam.', confirmText: 'Encaminhar' }))
              await act(() => collection.mutateAsync(true), 'Cliente encaminhado para cobrança');
          }}
        >
          <Gavel /> {c.inCollection ? 'Retirar da cobrança' : 'Encaminhar para cobrança'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={async () => {
            if (await confirm({ title: 'Arquivar cliente?', description: 'Sai das listas, mas contratos, pagamentos e histórico continuam guardados.', confirmText: 'Arquivar', variant: 'destructive' })) {
              await act(() => archive.mutateAsync(c.id), 'Cliente arquivado');
              router.push('/admin/customers');
            }
          }}
        >
          <Archive /> Arquivar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-5">
      <BackLink href="/admin/customers">Clientes</BackLink>

      {/* Cabeçalho da ficha */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Avatar name={c.name} className="size-12 text-base sm:size-14" />
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{c.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <CustomerStatusBadge status={c.status} />
              {c.inCollection && <Badge variant="destructive">Em cobrança desde {formatYmd(c.collectionSince)}</Badge>}
              {c.portalEnabled && (
                <Badge variant="outline">
                  <Smartphone className="size-3" /> App
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">Cliente nº {c.number}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:flex sm:flex-wrap">
          {wa && (
            <Button asChild variant="outline">
              <a href={wa} target="_blank" rel="noreferrer">
                <WhatsAppIcon className="size-4 text-success" /> WhatsApp
              </a>
            </Button>
          )}
          {c.phone && (
            <Button asChild variant="outline">
              <a href={`tel:+55${c.phone}`}>
                <Phone /> Ligar
              </a>
            </Button>
          )}
          {menu}
          {canManage && (
            <Button asChild variant="outline" className="col-span-full sm:col-auto">
              <Link href={`/admin/customers/${c.id}/edit`}>
                <Pencil /> Editar
              </Link>
            </Button>
          )}
          {canContract && !c.activeContractId && c.status !== 'BLOCKED' && (
            <Button asChild className="col-span-full sm:col-auto">
              <Link href={`/admin/contracts/new?customerId=${c.id}`}>
                <FilePlus2 /> Novo aluguel
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Moto atual"
          value={c.currentMotorcycle ? formatPlate(c.currentMotorcycle.plate) : 'Sem moto'}
          hint={c.currentMotorcycle?.label}
          icon={Bike}
          href={c.currentMotorcycle ? `/admin/motorcycles/${c.currentMotorcycle.id}` : undefined}
          tone={c.currentMotorcycle ? 'default' : 'muted'}
        />
        <StatCard
          label={c.nextCharge && c.nextCharge.dueDate < todayYmd() ? 'Vencida desde' : 'Próximo vencimento'}
          value={c.nextCharge ? formatYmd(c.nextCharge.dueDate) : '—'}
          hint={c.nextCharge ? `${relativeDays(c.nextCharge.dueDate, todayYmd())}${c.nextCharge.amount ? ` · ${formatBRL(c.nextCharge.amount)}` : ''}` : 'Nada a vencer'}
          icon={CalendarClock}
          tone="warning"
        />
        <StatCard
          label="Em atraso"
          value={c.totals ? formatBRL(c.totals.overdue) : c.overdueCount}
          hint={c.overdueCount ? `${c.overdueCount} ${c.overdueCount === 1 ? 'cobrança' : 'cobranças'}` : 'Em dia'}
          icon={c.overdueCount ? TriangleAlert : CheckCircle2}
          tone={c.overdueCount ? 'danger' : 'success'}
        />
        {c.totals && <StatCard label="Total pago" value={formatBRL(c.totals.paid)} hint={`A vencer ${formatBRL(c.totals.pending)}`} icon={Wallet} tone="success" />}
      </div>

      <Tabs defaultValue="summary" value={q.tab} onValueChange={(tab) => setQ({ tab })}>
        <TabsList>
          <TabsTrigger value="summary">Resumo</TabsTrigger>
          {canContracts && <TabsTrigger value="contracts">Contratos</TabsTrigger>}
          {canPayments && <TabsTrigger value="payments">Pagamentos</TabsTrigger>}
          {canDocuments && <TabsTrigger value="documents">Documentos</TabsTrigger>}
          {canOccurrences && <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>}
          {canAudit && <TabsTrigger value="history">Histórico</TabsTrigger>}
        </TabsList>
        <TabsContent value="summary" className="pt-5">
          <SummaryTab c={c} />
        </TabsContent>
        <TabsContent value="contracts" className="pt-5">
          <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-lg sm:border">
            <ContractList
              rows={contracts.data?.data}
              loading={contracts.isLoading}
              hide={['customer']}
              empty={{ title: 'Nenhum contrato', description: 'Os aluguéis deste cliente aparecem aqui.' }}
            />
          </div>
        </TabsContent>
        <TabsContent value="payments" className="pt-5">
          <PaymentsTab customer={c} />
        </TabsContent>
        <TabsContent value="documents" className="pt-5">
          <SectionCard>
            <DocumentsPanel ownerType="CUSTOMER" ownerId={c.id} />
          </SectionCard>
        </TabsContent>
        <TabsContent value="occurrences" className="pt-5">
          <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-lg sm:border">
            <OccurrenceList rows={occurrences.data?.data} loading={occurrences.isLoading} hide={['customer']} empty={{ title: 'Nenhuma ocorrência ou multa' }} />
          </div>
        </TabsContent>
        <TabsContent value="history" className="pt-5">
          <SectionCard>
            <Timeline entityType="Customer" entityId={c.id} />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <InviteDialog invite={inviteResult} onOpenChange={(v) => !v && setInviteResult(null)} />
      <StatusDialog customer={c} target={statusTarget} onOpenChange={(v) => !v && setStatusTarget(null)} />
    </div>
  );
}


