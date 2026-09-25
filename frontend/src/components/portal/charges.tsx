'use client';

import { PAYMENT_METHOD_LABELS, formatYmd, type PortalChargeDto, type Ymd } from '@locamania/shared';
import { CheckCircle2, ChevronRight, CircleAlert, Clock, FileText, QrCode, Receipt } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { portalApi } from '@/lib/api/portal';
import { chargeTitle, daysLate, dueLine, formatDay } from '@/lib/portal/format';
import { cn, formatBRL, plural } from '@/lib/utils';
import { ToneIcon, type Tone } from './kit';

export function chargeTone(c: Pick<PortalChargeDto, 'displayStatus'>): Tone {
  switch (c.displayStatus) {
    case 'PAID':
      return 'success';
    case 'OVERDUE':
      return 'danger';
    case 'DUE_SOON':
      return 'warning';
    case 'CANCELLED':
      return 'muted';
    default:
      return 'primary';
  }
}

/**
 * Cartão grande do próximo pagamento (§13, §16): valor enorme, vencimento em
 * palavras e o botão PAGAR ao alcance do polegar. Em atraso, fica vermelho e
 * já mostra o valor com multa e juros.
 */
export function NextPaymentHero({ charge, today, className }: { charge: PortalChargeDto; today: Ymd; className?: string }) {
  const overdue = charge.displayStatus === 'OVERDUE';
  const late = daysLate(charge.dueDate, today);
  const withFees = charge.amountDue !== charge.amount;
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl p-5 shadow-md sm:p-6',
        overdue ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground',
        className,
      )}
      aria-label={overdue ? 'Pagamento em atraso' : 'Próximo pagamento'}
    >
      {/* Círculos decorativos: dão "cara de app" sem imagem. */}
      <span className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full bg-current opacity-[0.07]" aria-hidden />
      <span className="pointer-events-none absolute -bottom-20 right-16 size-40 rounded-full bg-current opacity-[0.05]" aria-hidden />

      <div className="relative">
        <p className="flex items-center gap-1.5 text-sm font-medium opacity-90">
          {overdue ? <CircleAlert className="size-4" aria-hidden /> : <Clock className="size-4" aria-hidden />}
          {overdue ? 'Pagamento em atraso' : 'Próximo pagamento'}
        </p>
        <p className="mt-2 text-[2.5rem] font-bold leading-none tracking-tight tabular sm:text-5xl">{formatBRL(charge.amountDue)}</p>
        <p className="mt-2.5 text-[15px] font-medium">
          {dueLine(charge.dueDate, today)}
        </p>
        <p className="mt-0.5 truncate text-sm opacity-80">{chargeTitle(charge)}</p>
        {overdue && withFees && (
          <p className="mt-3 rounded-xl bg-current/10 px-3 py-2 text-sm">
            Valor com multa e juros de {plural(late, 'dia', 'dias')} de atraso. Valor original: {formatBRL(charge.amount)}.
          </p>
        )}
        <Button
          asChild
          size="lg"
          className={cn(
            'mt-5 h-14 w-full rounded-2xl bg-card text-base font-bold uppercase tracking-wide shadow-sm hover:bg-card/90 [&_svg]:size-5',
            overdue ? 'text-destructive' : 'text-primary',
          )}
        >
          <Link href={`/app/payments/${charge.id}`}>
            <QrCode /> Pagar
          </Link>
        </Button>
        <p className="mt-2.5 text-center text-xs opacity-80">Pelo PIX, confirmado na hora</p>
      </div>
    </section>
  );
}

/** Linha de cobrança nas listas: descrição, vencimento, valor e situação. Toque abre o pagamento. */
export function ChargeRow({ charge, today }: { charge: PortalChargeDto; today: Ymd }) {
  const open = charge.canPayOnline;
  const tone = chargeTone(charge);
  return (
    <Link href={`/app/payments/${charge.id}`} className="flex min-h-16 items-center gap-3 py-3 transition-colors hover:bg-accent/40">
      <ToneIcon icon={charge.displayStatus === 'PAID' ? CheckCircle2 : charge.kind === 'RENT' ? Receipt : FileText} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{chargeTitle(charge)}</span>
        <span
          className={cn(
            'block text-sm leading-snug',
            charge.displayStatus === 'OVERDUE' ? 'font-medium text-destructive' : charge.displayStatus === 'DUE_SOON' ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {charge.displayStatus === 'PAID'
            ? `Pago em ${charge.paidAt ? formatDay(charge.paidAt) : formatYmd(charge.dueDate)}${charge.method ? ` · ${PAYMENT_METHOD_LABELS[charge.method]}` : ''}`
            : dueLine(charge.dueDate, today)}
        </span>
      </span>
      {/* A situação já está na cor do ícone e na frase ("Venceu há 3 dias"); sem selo, o título cabe no celular. */}
      <span className={cn('shrink-0 text-right text-[15px] font-semibold tabular', charge.displayStatus === 'OVERDUE' && 'text-destructive')}>
        {formatBRL(open ? charge.amountDue : (charge.paidAmount ?? charge.amount))}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** Linha do histórico: pago em, forma, valor e o recibo (PDF) a um toque. */
export function PaidChargeRow({ charge, busy, onReceipt }: { charge: PortalChargeDto; busy: boolean; onReceipt: (path: string) => void }) {
  return (
    <div className="flex min-h-16 items-center gap-3 py-3">
      <ToneIcon icon={CheckCircle2} tone="success" className="hidden sm:flex" />
      <Link href={`/app/payments/${charge.id}`} className="min-w-0 flex-1 rounded-md">
        <span className="block truncate text-[15px] font-medium">{chargeTitle(charge)}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {charge.paidAt ? formatDay(charge.paidAt) : formatYmd(charge.dueDate)}
          {charge.method ? ` · ${PAYMENT_METHOD_LABELS[charge.method]}` : ''}
        </span>
      </Link>
      <span className="shrink-0 text-right text-[15px] font-semibold tabular">{formatBRL(charge.paidAmount ?? charge.amount)}</span>
      {charge.hasReceipt && (
        <Button
          variant="outline"
          className="size-11 shrink-0 rounded-xl px-0 sm:w-auto sm:px-3.5"
          disabled={busy}
          onClick={() => onReceipt(portalApi.receiptPath(charge.id))}
          aria-label={`Ver recibo de ${chargeTitle(charge)}`}
          title="Ver recibo"
        >
          {busy ? <Spinner /> : <Receipt />}
          <span className="hidden sm:inline">Recibo</span>
        </Button>
      )}
    </div>
  );
}

/** Botão "Recibo" (PDF) de um pagamento pago. */
export function ReceiptButton({
  charge,
  busy,
  onOpen,
  className,
  size = 'default',
}: {
  charge: Pick<PortalChargeDto, 'id' | 'hasReceipt'>;
  busy: boolean;
  onOpen: (path: string) => void;
  className?: string;
  size?: 'default' | 'lg' | 'sm';
}) {
  if (!charge.hasReceipt) return null;
  return (
    <Button variant="outline" size={size} className={className} disabled={busy} onClick={() => onOpen(portalApi.receiptPath(charge.id))}>
      {busy ? <Spinner /> : <Receipt />} Ver recibo
    </Button>
  );
}
