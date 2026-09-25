'use client';

import { PAYMENT_METHOD_LABELS, todayYmd, type PortalChargeDto } from '@locamania/shared';
import { Ban, CheckCircle2, ChevronDown, FlaskConical, Home, QrCode, Receipt, RotateCw, SearchX, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Notice, Panel, PortalEmpty, PortalError, SupportButton, TONE_SOFT } from '@/components/portal/kit';
import { CopyButton } from '@/components/shared/copy-button';
import { BackLink } from '@/components/ui/back-link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ChargeStatusBadge } from '@/components/ui/status-badge';
import { toast } from '@/components/ui/toaster';
import { ApiError, errorMessage } from '@/lib/api/client';
import { portalApi } from '@/lib/api/portal';
import { chargeTitle, dueLine, formatDay, formatTime } from '@/lib/portal/format';
import { useFileAction } from '@/lib/portal/queries';
import { usePix, usePortalCharge, usePortalSimulatePix } from '@/lib/queries/portal';
import { useOnline } from '@/lib/use-online';
import { cn, formatBRL } from '@/lib/utils';

/** Relógio que anda (para "vale até" e o código expirado). */
function useNow(stepMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(t);
  }, [stepMs]);
  return now;
}

function ChargeSummary({ charge }: { charge: PortalChargeDto }) {
  const today = todayYmd();
  const overdue = charge.displayStatus === 'OVERDUE';
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[15px] font-medium">{chargeTitle(charge)}</p>
        {charge.displayStatus !== 'UPCOMING' && <ChargeStatusBadge status={charge.displayStatus} />}
      </div>
      <p className={cn('text-[2.5rem] font-bold leading-tight tracking-tight tabular', overdue && 'text-destructive')}>{formatBRL(charge.amountDue)}</p>
      <p className="text-sm text-muted-foreground">
        {dueLine(charge.dueDate, today)}
        {charge.amountDue !== charge.amount && <> · inclui multa e juros (valor original {formatBRL(charge.amount)})</>}
      </p>
    </div>
  );
}

/**
 * Tela do PIX (§13): gera o código ao abrir, mostra o "copia e cola" (o jeito
 * de pagar pelo próprio celular) e o QR (para pagar de outro aparelho), e
 * acompanha sozinha — a confirmação vem do banco (webhook), nunca de um botão
 * "paguei".
 */
function PixPayment({ charge, onStarted }: { charge: PortalChargeDto; onStarted: () => void }) {
  const pix = usePix();
  const simulate = usePortalSimulatePix();
  const online = useOnline();
  const now = useNow();
  const [showQr, setShowQr] = useState(false);
  const started = useRef(false);

  // Acompanhamento automático: enquanto o PIX está na tela, consulta a cobrança.
  usePortalCharge(charge.id, pix.isSuccess);

  const generate = () => pix.mutate(charge.id, { onSuccess: onStarted });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    pix.mutate(charge.id, { onSuccess: onStarted });
    // Gera uma vez ao abrir; "Gerar novo código" chama de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charge.id]);

  const data = pix.data;
  const expired = !!data && new Date(data.expiresAt).getTime() <= now;

  async function runSimulation() {
    try {
      await simulate.mutateAsync(charge.id);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <Panel className="p-5 sm:p-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px] md:gap-8">
          {/* Valor + copia e cola */}
          <div className="min-w-0 space-y-5">
            <ChargeSummary charge={charge} />

            {pix.isPending && !data ? (
              <div className="space-y-3" aria-busy="true" aria-label="Gerando o PIX">
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> Gerando o código PIX…
                </p>
              </div>
            ) : pix.isError && !data ? (
              <Notice
                tone="danger"
                title="Não foi possível gerar o PIX"
                action={
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button size="lg" onClick={generate} disabled={!online}>
                      <RotateCw /> Tentar de novo
                    </Button>
                    <SupportButton />
                  </div>
                }
              >
                {errorMessage(pix.error)}
              </Notice>
            ) : data ? (
              <>
                {expired ? (
                  <Notice
                    tone="warning"
                    title="Este código expirou"
                    action={
                      <Button size="lg" onClick={generate} disabled={pix.isPending || !online}>
                        {pix.isPending ? <Spinner /> : <RotateCw />} Gerar novo código
                      </Button>
                    }
                  >
                    Gere um novo código para pagar.
                  </Notice>
                ) : (
                  <div className="space-y-3">
                    <CopyButton
                      text={data.pixCode}
                      label="Copiar código PIX"
                      copiedLabel="Código copiado!"
                      variant="default"
                      size="lg"
                      className="h-14 w-full rounded-2xl text-base font-semibold [&_svg]:size-5"
                    />
                    <div className="rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2.5">
                      <p className="line-clamp-2 select-all break-all font-mono text-xs text-muted-foreground">{data.pixCode}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Vale até <span className="font-medium text-foreground">{formatTime(data.expiresAt)}</span> de {formatDay(data.expiresAt)}.
                    </p>
                  </div>
                )}

                <ol className="space-y-2.5 text-[15px]">
                  {['Toque em “Copiar código PIX”.', 'Abra o app do seu banco e escolha PIX Copia e Cola.', 'Cole o código e confirme o pagamento.'].map((step, i) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </div>

          {/* QR code: sempre à vista no computador; no celular, sob demanda */}
          {data && !expired && (
            <div className="md:border-l md:border-border md:pl-8">
              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                aria-expanded={showQr}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border text-[15px] font-medium hover:bg-accent md:hidden"
              >
                <QrCode className="size-5" aria-hidden />
                {showQr ? 'Esconder QR code' : 'Mostrar QR code'}
                <ChevronDown className={cn('size-4 transition-transform', showQr && 'rotate-180')} aria-hidden />
              </button>
              <div className={cn('mt-4 flex-col items-center gap-3 md:mt-0 md:flex', showQr ? 'flex' : 'hidden')}>
                {/* eslint-disable-next-line @next/next/no-img-element -- QR vem pronto da API (data URL) */}
                <img
                  src={data.qrCodeDataUrl}
                  alt="QR code do PIX"
                  width={260}
                  height={260}
                  className="size-[240px] rounded-2xl border border-border bg-card p-2 sm:size-[260px]"
                />
                <p className="flex items-center gap-1.5 text-center text-sm text-muted-foreground">
                  <Smartphone className="size-4" aria-hidden /> Aponte a câmera do app do banco
                </p>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {data && !expired && (
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm">
          <span className="relative flex size-3 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-primary" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-semibold">Aguardando o pagamento…</p>
            <p className="text-muted-foreground">Esta tela atualiza sozinha quando o banco confirmar.</p>
          </div>
        </div>
      )}

      {data?.sandbox && (
        <Notice
          tone="muted"
          icon={FlaskConical}
          title="Ambiente de teste"
          action={
            <Button variant="outline" onClick={runSimulation} disabled={simulate.isPending || !online}>
              {simulate.isPending ? <Spinner /> : <FlaskConical />} Simular pagamento (teste)
            </Button>
          }
        >
          Nenhum valor é cobrado. O botão abaixo faz o papel do banco confirmando o PIX.
        </Notice>
      )}
    </div>
  );
}

/** Pago: confirmação grande (quando acabou de pagar) ou o resumo com o recibo. */
function PaidScreen({ charge, justPaid }: { charge: PortalChargeDto; justPaid: boolean }) {
  const files = useFileAction();
  return (
    <Panel className="flex flex-col items-center px-5 py-10 text-center sm:px-8 sm:py-12">
      <span className={cn('flex size-20 items-center justify-center rounded-full', TONE_SOFT.success, justPaid && 'animate-in')}>
        <CheckCircle2 className="size-11" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">{justPaid ? 'Pagamento confirmado!' : 'Pagamento feito'}</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">{justPaid ? 'Recebemos o seu PIX. Obrigado!' : chargeTitle(charge)}</p>
      <p className="mt-5 text-[2.5rem] font-bold leading-none tracking-tight tabular">{formatBRL(charge.paidAmount ?? charge.amount)}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {charge.paidAt ? `Pago em ${formatDay(charge.paidAt)} às ${formatTime(charge.paidAt)}` : 'Pago'}
        {charge.method && ` · ${PAYMENT_METHOD_LABELS[charge.method]}`}
      </p>
      {justPaid && <p className="mt-1 text-sm text-muted-foreground">{chargeTitle(charge)}</p>}
      <div className="mt-8 flex w-full max-w-sm flex-col gap-2.5">
        {charge.hasReceipt && (
          <Button size="lg" className="h-12 w-full text-base" disabled={files.busy === 'receipt'} onClick={() => void files.open(portalApi.receiptPath(charge.id), 'receipt')}>
            {files.busy === 'receipt' ? <Spinner /> : <Receipt />} Ver recibo
          </Button>
        )}
        <Button asChild variant="outline" size="lg" className="h-12 w-full text-base">
          <Link href="/app">
            <Home /> Voltar ao início
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

export default function ChargePaymentPage() {
  const { id } = useParams<{ id: string }>();
  const { data: charge, isLoading, error, refetch } = usePortalCharge(id);
  const [watched, setWatched] = useState(false);

  const paid = charge?.displayStatus === 'PAID';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink href="/app/payments" className="min-h-10">
        Pagamentos
      </BackLink>

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Carregando">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      ) : error instanceof ApiError && error.status === 404 ? (
        <PortalEmpty icon={SearchX} title="Pagamento não encontrado" action={<Button asChild variant="outline" size="lg"><Link href="/app/payments">Ver meus pagamentos</Link></Button>} />
      ) : error || !charge ? (
        <PortalError error={error} onRetry={() => void refetch()} />
      ) : paid ? (
        <PaidScreen charge={charge} justPaid={watched} />
      ) : charge.displayStatus === 'CANCELLED' || !charge.canPayOnline ? (
        <PortalEmpty icon={Ban} title="Esta cobrança foi cancelada" description="Não é preciso pagar. Se tiver dúvida, fale com a Locamania." action={<SupportButton />} />
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pagar com PIX</h1>
          <PixPayment charge={charge} onStarted={() => setWatched(true)} />
        </>
      )}
    </div>
  );
}
