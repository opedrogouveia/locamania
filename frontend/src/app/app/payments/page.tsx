'use client';

import { todayYmd, toCents, fromCents, type PortalChargeDto } from '@locamania/shared';
import { CalendarDays, CheckCircle2, CircleAlert, History, Receipt, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ChargeRow, NextPaymentHero, PaidChargeRow } from '@/components/portal/charges';
import { Metric, Panel, PanelHeader, PortalEmpty, PortalError, PortalTitle, RowList, ToneIcon } from '@/components/portal/kit';
import { Button } from '@/components/ui/button';
import { FilterChips } from '@/components/ui/kit';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDay } from '@/lib/portal/format';
import { useFileAction } from '@/lib/portal/queries';
import { usePortalCharges } from '@/lib/queries/portal';
import { useUrlState } from '@/lib/use-url-state';
import { formatBRL, plural } from '@/lib/utils';

type View = 'open' | 'paid';

const OPEN_STEP = 4;
const PAID_STEP = 10;

function PaymentsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-9 w-44" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <Skeleton className="h-64 w-full rounded-3xl lg:col-span-2" />
        <div className="space-y-3 lg:col-span-3">
          <Skeleton className="h-10 w-56 rounded-full" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Pagamentos do cliente (§13, §17): o próximo com PAGAR, o que está em aberto
 * (atrasados primeiro, já com encargos) e o histórico com os recibos.
 */
export default function PaymentsPage() {
  const { data, isLoading, error, refetch } = usePortalCharges();
  const [url, setUrl] = useUrlState({ view: 'open' });
  const [openLimit, setOpenLimit] = useState(OPEN_STEP);
  const [paidLimit, setPaidLimit] = useState(PAID_STEP);
  const files = useFileAction();
  const today = todayYmd();

  const { open, paid, overdue, overdueTotal } = useMemo(() => {
    const list = data ?? [];
    const open = list.filter((c) => c.canPayOnline).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const paid = list
      .filter((c) => c.displayStatus === 'PAID')
      .sort((a, b) => (b.paidAt ?? b.dueDate).localeCompare(a.paidAt ?? a.dueDate));
    const overdue = open.filter((c) => c.displayStatus === 'OVERDUE');
    const overdueTotal = fromCents(overdue.reduce((acc, c) => acc + toCents(c.amountDue), 0));
    return { open, paid, overdue, overdueTotal };
  }, [data]);

  if (isLoading) return <PaymentsSkeleton />;
  if (error || !data) return <PortalError error={error} onRetry={() => void refetch()} />;

  const view: View = url.view === 'paid' ? 'paid' : 'open';
  const next = open[0];
  const rest = open.slice(1);
  const paidTotal = fromCents(paid.reduce((acc, c) => acc + toCents(c.paidAmount ?? c.amount), 0));

  if (data.length === 0) {
    return (
      <div className="space-y-5">
        <PortalTitle title="Pagamentos" />
        <PortalEmpty icon={Wallet} title="Nenhum pagamento ainda" description="Quando o seu aluguel começar, os pagamentos aparecem aqui." />
      </div>
    );
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <PortalTitle title="Pagamentos" subtitle="Pague pelo PIX e veja seus comprovantes." />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5 lg:gap-6">
        {/* Esquerda: o que pagar agora */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:col-span-2">
          {next ? (
            <NextPaymentHero charge={next} today={today} />
          ) : (
            <Panel className="flex items-center gap-4">
              <ToneIcon icon={CheckCircle2} tone="success" size="lg" />
              <div>
                <p className="text-lg font-semibold">Tudo em dia</p>
                <p className="text-sm text-muted-foreground">Nenhum pagamento em aberto.</p>
              </div>
            </Panel>
          )}
          {overdue.length > 0 && (
            <Panel className="flex items-center gap-3 border-destructive/40">
              <ToneIcon icon={CircleAlert} tone="danger" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Total em atraso ({plural(overdue.length, 'pagamento', 'pagamentos')})</p>
                <p className="text-2xl font-bold tabular tracking-tight text-destructive">{formatBRL(overdueTotal)}</p>
                <p className="text-xs text-muted-foreground">Já com multa e juros até hoje</p>
              </div>
            </Panel>
          )}
          {paid.length > 0 && (
            <Panel className="hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Último pagamento" value={formatBRL(paid[0]!.paidAmount ?? paid[0]!.amount)} hint={paid[0]!.paidAt ? formatDay(paid[0]!.paidAt) : undefined} />
                <Metric label="Total já pago" value={formatBRL(paidTotal)} hint={plural(paid.length, 'pagamento', 'pagamentos')} />
              </div>
            </Panel>
          )}
        </div>

        {/* Direita: listas */}
        <div className="space-y-3 lg:col-span-3">
          <FilterChips<View>
            value={view}
            onChange={(v) => setUrl({ view: v })}
            options={[
              { value: 'open', label: 'Em aberto', count: open.length, tone: overdue.length ? 'danger' : 'default' },
              { value: 'paid', label: 'Pagos', count: paid.length },
            ]}
          />

          {view === 'open' ? (
            <Panel>
              <PanelHeader icon={CalendarDays} title="Próximos vencimentos" />
              {rest.length === 0 ? (
                <p className="py-2 text-[15px] text-muted-foreground">{next ? 'Nenhum outro pagamento em aberto.' : 'Nenhum pagamento em aberto.'}</p>
              ) : (
                <>
                  <RowList>
                    {rest.slice(0, openLimit).map((c: PortalChargeDto) => (
                      <ChargeRow key={c.id} charge={c} today={today} />
                    ))}
                  </RowList>
                  {rest.length > openLimit && (
                    <Button variant="ghost" size="lg" className="mt-2 w-full text-primary" onClick={() => setOpenLimit((n) => n + 8)}>
                      Mostrar mais ({rest.length - openLimit})
                    </Button>
                  )}
                </>
              )}
            </Panel>
          ) : (
            <Panel>
              <PanelHeader
                icon={History}
                tone="success"
                title="Histórico"
                action={paid.length > 0 && <span className="text-sm text-muted-foreground tabular">{formatBRL(paidTotal)} pagos</span>}
              />
              {paid.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <ToneIcon icon={Receipt} tone="muted" size="lg" />
                  <p className="font-medium">Nenhum pagamento feito ainda</p>
                  <p className="text-sm text-muted-foreground">Os recibos aparecem aqui depois de cada pagamento.</p>
                </div>
              ) : (
                <>
                  <RowList>
                    {paid.slice(0, paidLimit).map((c) => (
                      <PaidChargeRow key={c.id} charge={c} busy={files.busy === c.id} onReceipt={(path) => void files.open(path, c.id)} />
                    ))}
                  </RowList>
                  {paid.length > paidLimit && (
                    <Button variant="ghost" size="lg" className="mt-2 w-full text-primary" onClick={() => setPaidLimit((n) => n + PAID_STEP)}>
                      Mostrar mais ({paid.length - paidLimit})
                    </Button>
                  )}
                </>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
