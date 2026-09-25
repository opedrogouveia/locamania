'use client';

import {
  PERIODICITY_UNIT,
  buildRentSchedule,
  scheduleTotal,
  toCents,
  type PaymentPeriodicity,
  type ScheduledInstallment,
  type Ymd,
} from '@locamania/shared';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn, formatBRL, formatYmd, formatYmdShort } from '@/lib/utils';

export interface SchedulePreviewInput {
  startDate: Ymd;
  endDate: Ymd;
  firstDueDate?: Ymd | null;
  periodicity: PaymentPeriodicity;
  rentAmount: string;
  depositAmount?: string | null;
}

/** Cronograma calculado com a MESMA regra que a API usa na entrega (shared). */
export function useSchedule(
  input: SchedulePreviewInput | null,
): { items: ScheduledInstallment[]; total: string } | null {
  return useMemo(() => {
    if (
      !input ||
      !input.startDate ||
      !input.endDate ||
      input.endDate <= input.startDate ||
      toCents(input.rentAmount) <= 0
    )
      return null;
    const items = buildRentSchedule({
      startDate: input.startDate,
      endDate: input.endDate,
      firstDueDate: input.firstDueDate || undefined,
      periodicity: input.periodicity,
      amount: input.rentAmount,
    });
    return { items, total: scheduleTotal(items) };
  }, [input]);
}

function Row({ it, periodicity }: { it: ScheduledInstallment; periodicity: PaymentPeriodicity }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular text-muted-foreground">
        {it.sequence}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm tabular">vence {formatYmd(it.dueDate)}</p>
        <p className="truncate text-xs text-muted-foreground tabular">
          {formatYmdShort(it.periodStart)} a {formatYmdShort(it.periodEnd)}
          {it.prorated && ` · proporcional (não fecha a ${PERIODICITY_UNIT[periodicity]})`}
        </p>
      </div>
      <span className={cn('text-sm font-medium tabular', it.prorated && 'text-muted-foreground')}>
        {formatBRL(it.amount)}
      </span>
    </li>
  );
}

/**
 * Prévia do cronograma (§39 etapa 6): primeiras parcelas, a última (que pode
 * ser proporcional) e o total. "Ver todas" abre a lista inteira.
 */
export function SchedulePreview({
  input,
  head = 3,
  className,
}: {
  input: SchedulePreviewInput;
  head?: number;
  className?: string;
}) {
  const schedule = useSchedule(input);
  const [all, setAll] = useState(false);
  if (!schedule || schedule.items.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Preencha início, término e valor para ver as parcelas.
      </p>
    );
  }
  const { items, total } = schedule;
  const collapsed = !all && items.length > head + 2;
  const shown = collapsed ? items.slice(0, head) : items;
  const last = items[items.length - 1]!;
  const deposit = toCents(input.depositAmount) > 0 ? input.depositAmount : null;

  return (
    <div className={className}>
      <ul className="divide-y divide-border">
        {deposit && (
          <li className="flex items-center gap-3 py-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-info/12 text-[10px] font-semibold text-info">
              CA
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">Caução</p>
              <p className="text-xs text-muted-foreground tabular">
                vence {formatYmd(input.startDate)}
              </p>
            </div>
            <span className="text-sm font-medium tabular">{formatBRL(deposit)}</span>
          </li>
        )}
        {shown.map((it) => (
          <Row key={it.sequence} it={it} periodicity={input.periodicity} />
        ))}
        {collapsed && (
          <>
            <li className="py-1.5 text-center text-xs text-muted-foreground">
              + {items.length - head - 1} parcelas iguais
            </li>
            <Row it={last} periodicity={input.periodicity} />
          </>
        )}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? 'parcela' : 'parcelas'}
            {last.prorated && ' · última proporcional'}
          </p>
          <p className="text-base font-semibold tabular">Total {formatBRL(total)}</p>
        </div>
        {items.length > head + 2 && (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary hover:bg-accent"
          >
            {all ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {all ? 'Mostrar menos' : 'Ver todas'}
          </button>
        )}
      </div>
      {deposit && (
        <p className="mt-1 text-xs text-muted-foreground">
          <Badge variant="muted" className="mr-1">
            + caução
          </Badge>
          {formatBRL(deposit)} cobrada no início, fora do total do aluguel.
        </p>
      )}
    </div>
  );
}
