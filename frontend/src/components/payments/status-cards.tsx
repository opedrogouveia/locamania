'use client';

import type { ChargeDisplayStatus, ChargesSummaryDto } from '@locamania/shared';
import { useEffect, useRef, type ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatBRL, plural } from '@/lib/utils';

export const PAYMENT_TABS: ChargeDisplayStatus[] = [
  'UPCOMING',
  'DUE_SOON',
  'OVERDUE',
  'PAID',
  'CANCELLED',
];

export const PAYMENT_TAB_LABELS: Record<ChargeDisplayStatus, string> = {
  UPCOMING: 'A vencer',
  DUE_SOON: 'Próximos do vencimento',
  OVERDUE: 'Em atraso',
  PAID: 'Pagos',
  CANCELLED: 'Cancelados',
};

const TONE: Record<ChargeDisplayStatus, string> = {
  UPCOMING: 'text-foreground',
  DUE_SOON: 'text-warning',
  OVERDUE: 'text-destructive',
  PAID: 'text-success',
  CANCELLED: 'text-muted-foreground',
};

const DOT: Record<ChargeDisplayStatus, string> = {
  UPCOMING: 'bg-muted-foreground/50',
  DUE_SOON: 'bg-warning',
  OVERDUE: 'bg-destructive',
  PAID: 'bg-success',
  CANCELLED: 'bg-border',
};

/**
 * Abas de situação que já mostram o total de cada uma (§11): quantidade e
 * valor. No celular rolam de lado; no desktop ficam as cinco lado a lado.
 */
export function PaymentStatusCards({
  value,
  onChange,
  summary,
  hints,
}: {
  value: ChargeDisplayStatus;
  onChange: (s: ChargeDisplayStatus) => void;
  /** Resumo por situação (o de "Pagos" pode vir de outro filtro de data). */
  summary: Partial<ChargesSummaryDto['byStatus']> | null;
  hints?: Partial<Record<ChargeDisplayStatus, ReactNode>>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // No celular a aba escolhida (ex.: "Pagos" vindo do painel) pode estar fora da tela.
  useEffect(() => {
    const row = ref.current;
    const active = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: Math.max(0, active.offsetLeft - 16), behavior: 'smooth' });
  }, [value]);
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="Situação dos pagamentos"
      className="no-scrollbar relative -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5"
    >
      {PAYMENT_TABS.map((s) => {
        const active = s === value;
        const data = summary?.[s];
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s)}
            className={cn(
              'min-w-[10.5rem] shrink-0 snap-start rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors sm:min-w-0',
              active
                ? 'border-primary ring-1 ring-primary'
                : 'border-border hover:border-ring/40 hover:bg-accent/30',
            )}
          >
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-[13px]">
              <span className={cn('size-2 shrink-0 rounded-full', DOT[s])} aria-hidden />
              <span className="truncate">{PAYMENT_TAB_LABELS[s]}</span>
            </span>
            {data ? (
              <>
                <span
                  className={cn(
                    'mt-1 block truncate text-lg font-semibold tracking-tight tabular sm:text-xl',
                    TONE[s],
                  )}
                >
                  {formatBRL(data.amount)}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {plural(data.count, 'cobrança', 'cobranças')}
                </span>
                {hints?.[s] && (
                  <span className="block truncate text-xs font-medium text-muted-foreground">
                    {hints[s]}
                  </span>
                )}
              </>
            ) : (
              <>
                <Skeleton className="mt-1.5 h-6 w-24" />
                <Skeleton className="mt-1.5 h-3.5 w-20" />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
