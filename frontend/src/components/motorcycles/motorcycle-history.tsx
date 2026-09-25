'use client';

import type { MotorcycleHistoryItemDto } from '@locamania/shared';
import {
  ChevronRight,
  CircleDot,
  Gauge,
  History,
  KeyRound,
  Receipt,
  ShieldAlert,
  Undo2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips } from '@/components/ui/kit';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/client';
import { useMotorcycleHistory } from '@/lib/queries';
import { cn, formatDateTime, formatYmd } from '@/lib/utils';

type Kind = MotorcycleHistoryItemDto['kind'];
type Filter =
  'all' | 'rentals' | 'maintenance' | 'occurrences' | 'odometer' | 'expenses' | 'status';

const KIND: Record<Kind, { icon: LucideIcon; tone: string; filter: Filter }> = {
  RENTAL_START: { icon: KeyRound, tone: 'text-info', filter: 'rentals' },
  RENTAL_END: { icon: Undo2, tone: 'text-info', filter: 'rentals' },
  MAINTENANCE: { icon: Wrench, tone: 'text-warning', filter: 'maintenance' },
  OCCURRENCE: { icon: ShieldAlert, tone: 'text-destructive', filter: 'occurrences' },
  ODOMETER: { icon: Gauge, tone: 'text-muted-foreground', filter: 'odometer' },
  EXPENSE: { icon: Receipt, tone: 'text-muted-foreground', filter: 'expenses' },
  STATUS: { icon: CircleDot, tone: 'text-primary', filter: 'status' },
};

const FILTER_LABEL: Record<Filter, string> = {
  all: 'Tudo',
  rentals: 'Aluguéis',
  maintenance: 'Manutenção',
  occurrences: 'Ocorrências',
  odometer: 'Quilometragem',
  expenses: 'Gastos',
  status: 'Situação',
};

const MONTH = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

/** Data "só dia" (meia-noite UTC) não deve virar o dia anterior no fuso de SP. */
function when(iso: string): string {
  return iso.endsWith('T00:00:00.000Z') ? formatYmd(iso.slice(0, 10)) : formatDateTime(iso);
}

/**
 * Linha do tempo da moto (§6): quem alugou, km de saída e devolução,
 * manutenções, ocorrências, multas, gastos e mudanças de situação.
 */
export function MotorcycleHistory({
  motorcycleId,
  onOpenRecord,
}: {
  motorcycleId: string;
  onOpenRecord?: (id: string) => void;
}) {
  const { data, isLoading, error } = useMotorcycleHistory(motorcycleId);
  const [filter, setFilter] = useState<Filter>('all');

  const available = useMemo(() => {
    const set = new Set((data ?? []).map((h) => KIND[h.kind].filter));
    return (
      ['all', 'rentals', 'maintenance', 'occurrences', 'odometer', 'expenses', 'status'] as Filter[]
    ).filter((f) => f === 'all' || set.has(f));
  }, [data]);

  const groups = useMemo(() => {
    const items = (data ?? []).filter((h) => filter === 'all' || KIND[h.kind].filter === filter);
    const out: { month: string; items: MotorcycleHistoryItemDto[] }[] = [];
    for (const h of items) {
      const d = new Date(
        h.date.endsWith('T00:00:00.000Z')
          ? h.date.replace('T00:00:00.000Z', 'T12:00:00.000Z')
          : h.date,
      );
      const month = MONTH.format(d);
      const last = out[out.length - 1];
      if (last && last.month === month) last.items.push(h);
      else out.push({ month, items: [h] });
    }
    return out;
  }, [data, filter]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{errorMessage(error)}</p>;
  if (!data?.length)
    return (
      <EmptyState
        icon={History}
        title="Sem histórico ainda"
        description="Aluguéis, manutenções, ocorrências e leituras de km aparecem aqui."
      />
    );

  return (
    <div className="space-y-4">
      {available.length > 2 && (
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={available.map((f) => ({ value: f, label: FILTER_LABEL[f] }))}
        />
      )}
      {groups.map((g) => (
        <section key={g.month} className="space-y-1">
          <h4 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground first-letter:uppercase">
            {g.month}
          </h4>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {g.items.map((h) => {
              const k = KIND[h.kind];
              const recordId = h.link?.match(/[?&]record=([^&]+)/)?.[1];
              const body = (
                <>
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full bg-muted',
                      k.tone,
                    )}
                  >
                    <k.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">{h.title}</span>
                    {h.description && (
                      <span className="block text-xs text-muted-foreground">{h.description}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground tabular">
                    {when(h.date)}
                  </span>
                  {(h.link || recordId) && (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                </>
              );
              const cls = 'flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left';
              return (
                <li key={h.id}>
                  {recordId && onOpenRecord ? (
                    <button
                      type="button"
                      onClick={() => onOpenRecord(recordId)}
                      className={cn(cls, 'transition-colors hover:bg-accent/50')}
                    >
                      {body}
                    </button>
                  ) : h.link ? (
                    <Link href={h.link} className={cn(cls, 'transition-colors hover:bg-accent/50')}>
                      {body}
                    </Link>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
