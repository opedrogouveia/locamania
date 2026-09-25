'use client';

import { Permission, type SupportMessageDto, type SupportMessageStatus } from '@locamania/shared';
import { Inbox, LifeBuoy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SupportDialog } from '@/components/communication/support-dialog';
import { NoAccess } from '@/components/settings/settings-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterChips, MobileRow } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { SupportStatusBadge } from '@/components/ui/status-badge';
import { errorMessage } from '@/lib/api/client';
import { SUPPORT_STATUS_VARIANT } from '@/lib/meta';
import { useCan, useMe } from '@/lib/auth/use-auth';
import { useSupport } from '@/lib/queries';
import { useSupportCounts } from '@/lib/settings/queries';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { formatDateTime, plural } from '@/lib/utils';

type Filter = SupportMessageStatus | 'all';

/** Rótulo curto para o cartão do celular (o longo não cabe ao lado do assunto). */
const SHORT_STATUS: Record<SupportMessageStatus, string> = { OPEN: 'Aguardando', ANSWERED: 'Respondida', CLOSED: 'Encerrada' };

const EMPTY: Record<Filter, { title: string; description: string }> = {
  OPEN: { title: 'Nenhuma mensagem esperando', description: 'Tudo respondido. Mensagens novas dos clientes aparecem aqui e no sino.' },
  ANSWERED: { title: 'Nenhuma mensagem respondida', description: 'As respondidas ficam aqui até serem encerradas.' },
  CLOSED: { title: 'Nenhuma mensagem encerrada', description: 'As conversas encerradas ficam guardadas aqui.' },
  all: { title: 'Nenhuma mensagem ainda', description: 'Os clientes mandam mensagens pela tela Suporte do aplicativo.' },
};

/** "há 3 h", "ontem", "22/09". Curto, para a lista. */
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `há ${Math.max(1, Math.floor(diff / 60_000))} min`;
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return formatDateTime(iso).slice(0, 10);
}

export default function SupportPage() {
  const { isLoading: meLoading } = useMe();
  const can = useCan(Permission.SUPPORT_MANAGE);
  const [q, setQ, ready] = useUrlState({ status: 'OPEN', page: '1', id: '' });
  const filter = (['OPEN', 'ANSWERED', 'CLOSED', 'all'].includes(q.status) ? q.status : 'OPEN') as Filter;
  const { data, isLoading, error, isFetching } = useSupport({ status: filter === 'all' ? undefined : filter, page: pageOf(q.page) }, ready && can);
  const { data: counts } = useSupportCounts(can);
  const [open, setOpen] = useState<SupportMessageDto | null>(null);

  // ?id= abre a mensagem direto (link compartilhado, voltar do celular).
  useEffect(() => {
    if (!q.id || open || !data) return;
    const found = data.data.find((m) => m.id === q.id);
    if (found) setOpen(found);
  }, [q.id, data, open]);

  if (meLoading) return <Skeleton className="h-[60vh] w-full" />;
  if (!can) return <NoAccess />;

  function show(m: SupportMessageDto | null) {
    setOpen(m);
    setQ({ id: m?.id ?? '' });
  }

  const columns: Column<SupportMessageDto>[] = [
    {
      key: 'customer',
      header: 'Cliente',
      className: 'w-64',
      cell: (m) => (
        <div className="flex items-center gap-3">
          <Avatar name={m.customer.label} />
          <span className="truncate font-medium">{m.customer.label}</span>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Mensagem',
      cell: (m) => (
        <div className="max-w-2xl">
          <p className="font-medium">{m.subject}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{m.body}</p>
        </div>
      ),
    },
    { key: 'at', header: 'Recebida', align: 'right', hideBelow: 'lg', cell: (m) => <span className="text-sm text-muted-foreground" title={formatDateTime(m.createdAt)}>{ago(m.createdAt)}</span> },
    { key: 'status', header: 'Situação', align: 'right', cell: (m) => <SupportStatusBadge status={m.status} /> },
  ];

  const openCount = counts?.OPEN;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Suporte"
        description={openCount ? `${plural(openCount, 'mensagem esperando', 'mensagens esperando')} resposta.` : 'Mensagens que os clientes mandam pelo aplicativo.'}
      />
      <FilterChips
        value={filter}
        onChange={(v) => setQ({ status: v, page: '1', id: '' })}
        options={[
          { value: 'OPEN', label: 'Aguardando resposta', count: counts?.OPEN, tone: 'warning' },
          { value: 'ANSWERED', label: 'Respondidas', count: counts?.ANSWERED },
          { value: 'CLOSED', label: 'Encerradas', count: counts?.CLOSED },
          { value: 'all', label: 'Todas' },
        ]}
      />
      <Card className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : undefined}>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <DataTable
            rows={ready ? data?.data : undefined}
            loading={isLoading || !ready}
            columns={columns}
            rowKey={(m) => m.id}
            onRowClick={show}
            rowClassName={(m) => (filter === 'all' && m.status === 'OPEN' ? 'bg-warning/[0.05]' : undefined)}
            empty={{ icon: filter === 'OPEN' ? Inbox : LifeBuoy, ...EMPTY[filter] }}
            mobileCard={(m) => (
              <MobileRow
                leading={<Avatar name={m.customer.label} />}
                title={m.subject}
                wrapTitle
                subtitle={m.customer.label}
                meta={<span className="line-clamp-2">{m.body}</span>}
                right={
                  <>
                    <span className="text-xs text-muted-foreground">{ago(m.createdAt)}</span>
                    {filter === 'all' && <Badge variant={SUPPORT_STATUS_VARIANT[m.status]}>{SHORT_STATUS[m.status]}</Badge>}
                  </>
                }
              />
            )}
          />
        )}
        {data && data.totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} unit="mensagens" onPageChange={(p) => setQ({ page: String(p) })} />
          </div>
        )}
      </Card>

      <SupportDialog message={open} onOpenChange={(o) => !o && show(null)} onChanged={setOpen} onPick={show} />
    </div>
  );
}
