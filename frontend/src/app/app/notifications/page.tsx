'use client';

import { Bell, CheckCheck } from 'lucide-react';

import { Panel, PortalEmpty, PortalError, PortalTitle, RowList } from '@/components/portal/kit';
import { NotificationRow } from '@/components/portal/notification-row';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toaster';
import { useUnreadCount } from '@/components/layout/notification-bell';
import { errorMessage } from '@/lib/api/client';
import { useOpenNotification } from '@/lib/portal/queries';
import { usePortalMarkRead, usePortalNotifications } from '@/lib/queries/portal';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { plural } from '@/lib/utils';

/**
 * Avisos do cliente (§18): pagamento, manutenção, avisos da Locamania.
 * Tocar abre o assunto e marca como lido; "Marcar todos como lidos" limpa o sino.
 */
export default function NotificationsPage() {
  const [url, setUrl, ready] = useUrlState({ page: '1' });
  const page = pageOf(url.page);
  const { data, isLoading, error, refetch } = usePortalNotifications(page);
  const unread = useUnreadCount('customer').data?.unread ?? 0;
  const markRead = usePortalMarkRead();
  const open = useOpenNotification();

  async function markAll() {
    try {
      await markRead.mutateAsync(undefined);
      toast.success('Todos os avisos foram marcados como lidos.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PortalTitle
        title="Avisos"
        subtitle={unread > 0 ? `Você tem ${plural(unread, 'aviso novo', 'avisos novos')}.` : 'Tudo lido por aqui.'}
        actions={
          unread > 0 && (
            <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={markAll} disabled={markRead.isPending}>
              {markRead.isPending ? <Spinner /> : <CheckCheck />} Marcar todos como lidos
            </Button>
          )
        }
      />

      {!ready || isLoading ? (
        <Panel className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </Panel>
      ) : error || !data ? (
        <PortalError error={error} onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <PortalEmpty icon={Bell} title="Nenhum aviso ainda" description="Lembretes de pagamento, manutenção e avisos da Locamania aparecem aqui." />
      ) : (
        <>
          <Panel className="py-0 sm:py-0">
            <RowList>
              {data.data.map((n) => (
                <NotificationRow key={n.id} n={n} onOpen={open} />
              ))}
            </RowList>
          </Panel>
          {data.totalPages > 1 && (
            <Pagination page={page} totalPages={data.totalPages} total={data.total} unit="avisos" onPageChange={(p) => setUrl({ page: String(p) })} />
          )}
        </>
      )}
    </div>
  );
}
