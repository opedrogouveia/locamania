'use client';

import { NOTIFICATION_TYPE_META, type NotificationDto, type NotificationSeverity } from '@locamania/shared';
import { AlertTriangle, BellOff, Check, CheckCheck, CheckCircle2, Clock, Info, Loader2, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useUnreadCount } from '@/components/layout/notification-bell';
import { WhatsAppIcon } from '@/components/shared/whatsapp-icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { dayHeading, groupByDay } from '@/lib/audit/days';
import { useMarkRead, useNotifications } from '@/lib/queries';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { cn, plural, todayYmd } from '@/lib/utils';

const SEVERITY: Record<NotificationSeverity, { icon: LucideIcon; cls: string; label: string }> = {
  DANGER: { icon: AlertTriangle, cls: 'bg-destructive/12 text-destructive', label: 'Urgente' },
  WARNING: { icon: Clock, cls: 'bg-warning/15 text-warning', label: 'Atenção' },
  SUCCESS: { icon: CheckCircle2, cls: 'bg-success/12 text-success', label: 'Tudo certo' },
  INFO: { icon: Info, cls: 'bg-info/12 text-info', label: 'Informação' },
};

const TIME = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

/** "E-mail enviado", "WhatsApp não enviado" — o que saiu além do aviso no sistema. */
function deliveryText(n: NotificationDto): string | null {
  const parts = n.deliveries
    .filter((d) => d.channel !== 'IN_APP')
    .map((d) => `${d.channel === 'EMAIL' ? 'E-mail' : 'WhatsApp'} ${d.status === 'SENT' ? 'enviado' : d.status === 'FAILED' ? 'falhou' : 'não enviado'}`);
  return parts.length ? parts.join(' · ') : null;
}

function NotificationRow({ n, onOpen, onRead, busy }: { n: NotificationDto; onOpen: () => void; onRead: () => void; busy: boolean }) {
  const s = SEVERITY[n.severity];
  const Icon = s.icon;
  const unread = !n.readAt;
  const delivery = deliveryText(n);
  const content = (
    <>
      <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', s.cls)} title={s.label}>
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">{s.label}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm leading-snug', unread ? 'font-semibold' : 'font-medium text-foreground/80')}>{n.title}</span>
        {n.body && <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="tabular">{TIME.format(new Date(n.createdAt))}</span>
          <span aria-hidden>·</span>
          <span>{NOTIFICATION_TYPE_META[n.type]?.label ?? 'Aviso'}</span>
          {delivery && (
            <>
              <span aria-hidden>·</span>
              <span>{delivery}</span>
            </>
          )}
        </span>
      </span>
    </>
  );
  return (
    <li className={cn('flex items-start gap-1 pr-2 sm:pr-3', unread && 'bg-primary/[0.035]')}>
      {n.link ? (
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/40 sm:px-5">
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 sm:px-5">{content}</div>
      )}
      <div className="flex shrink-0 items-center gap-0.5 self-center">
        {n.whatsappLink && (
          <Button asChild variant="ghost" size="icon" title="Avisar o cliente no WhatsApp">
            <a href={n.whatsappLink} target="_blank" rel="noreferrer" aria-label="Avisar o cliente no WhatsApp">
              <WhatsAppIcon className="size-4 text-success" />
            </a>
          </Button>
        )}
        {unread ? (
          <Button variant="ghost" size="icon" onClick={onRead} disabled={busy} title="Marcar como lida" aria-label={`Marcar como lida: ${n.title}`}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
          </Button>
        ) : (
          <span className="size-10" aria-hidden />
        )}
      </div>
    </li>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [q, setQ, ready] = useUrlState({ filter: 'unread', page: '1' });
  const unreadOnly = q.filter !== 'all';
  const { data, isLoading, error, isFetching } = useNotifications({ unreadOnly: unreadOnly || undefined, page: pageOf(q.page), pageSize: 20 }, ready);
  const unread = useUnreadCount('staff');
  const markRead = useMarkRead();
  const today = todayYmd();
  const unreadCount = unread.data?.unread ?? 0;

  async function read(ids?: string[]) {
    try {
      await markRead.mutateAsync(ids);
      if (!ids) toast.success('Tudo marcado como lido');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  function open(n: NotificationDto) {
    if (!n.readAt) void read([n.id]);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Notificações"
        description={unread.data ? (unreadCount ? `${plural(unreadCount, 'aviso não lido', 'avisos não lidos')}` : 'Tudo lido por aqui') : 'Avisos de pagamentos, manutenção, documentos e ocorrências.'}
        actions={
          unreadCount > 0 && (
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => void read()} disabled={markRead.isPending}>
              {markRead.isPending && markRead.variables === undefined ? <Loader2 className="animate-spin" /> : <CheckCheck />} Marcar todas como lidas
            </Button>
          )
        }
      />
      <FilterChips
        value={unreadOnly ? 'unread' : 'all'}
        onChange={(v) => setQ({ filter: v, page: '1' })}
        options={[
          { value: 'unread', label: 'Não lidas', count: unread.data ? unreadCount : undefined, tone: 'danger' },
          { value: 'all', label: 'Todas' },
        ]}
      />
      <Card className={cn('overflow-hidden', isFetching && !isLoading && 'opacity-70 transition-opacity')}>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : isLoading || !ready || !data ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={unreadOnly ? 'Nada novo por aqui' : 'Nenhuma notificação'}
            description={unreadOnly ? 'Você já viu todos os avisos.' : 'Os avisos do sistema aparecem aqui.'}
            action={
              unreadOnly ? (
                <Button variant="outline" onClick={() => setQ({ filter: 'all', page: '1' })}>
                  Ver todas
                </Button>
              ) : undefined
            }
          />
        ) : (
          groupByDay(data.data, (n) => n.createdAt).map((g) => (
            <section key={g.day} aria-label={dayHeading(g.day, today)}>
              <h2 className="border-b border-border bg-muted/60 px-4 py-2 text-xs font-semibold text-muted-foreground sm:px-5">{dayHeading(g.day, today)}</h2>
              <ul className="divide-y divide-border border-b border-border last:border-b-0">
                {g.items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onOpen={() => open(n)}
                    onRead={() => void read([n.id])}
                    busy={markRead.isPending && !!markRead.variables?.includes(n.id)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
        {data && data.totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} unit="avisos" onPageChange={(p) => setQ({ page: String(p) })} />
          </div>
        )}
      </Card>
    </div>
  );
}
