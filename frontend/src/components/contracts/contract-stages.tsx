'use client';

import type { ContractDto } from '@locamania/shared';
import { Check, X } from 'lucide-react';

import { cn, formatDateTime } from '@/lib/utils';

type StageState = 'done' | 'next' | 'todo' | 'cancelled';

interface Stage {
  key: string;
  label: string;
  at: string | null;
  state: StageState;
}

/** Etapas do contrato: Rascunho → Assinado → Entregue → Encerrado. */
export function contractStages(c: ContractDto): Stage[] {
  const reached = [true, c.signatureStatus === 'SIGNED', !!c.deliveredAt, c.status === 'ENDED'];
  const base = [
    { key: 'draft', label: 'Rascunho', at: c.createdAt },
    { key: 'signed', label: 'Assinado', at: c.signedAt },
    { key: 'delivered', label: 'Entregue', at: c.deliveredAt },
    { key: 'ended', label: 'Encerrado', at: c.endedAt },
  ];
  const nextIdx = reached.findIndex((r) => !r);
  return base.map((s, i) => {
    let state: StageState = reached[i] ? 'done' : i === nextIdx ? 'next' : 'todo';
    if (c.status === 'CANCELLED' && i === nextIdx)
      return { ...s, label: 'Cancelado', at: c.cancelledAt, state: 'cancelled' as const };
    if (c.status === 'CANCELLED' && !reached[i]) state = 'todo';
    return { ...s, state };
  });
}

/** Linha de etapas da ficha — no celular cabe nos 390 px (quatro colunas). */
export function ContractStages({
  contract,
  className,
}: {
  contract: ContractDto;
  className?: string;
}) {
  const stages = contractStages(contract);
  return (
    <ol className={cn('grid grid-cols-4', className)} aria-label="Etapas do contrato">
      {stages.map((s, i) => (
        <li
          key={s.key}
          className="relative flex flex-col items-center text-center"
          aria-current={s.state === 'next' ? 'step' : undefined}
        >
          {i > 0 && (
            <span
              className={cn(
                'absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2',
                s.state === 'done' ? 'bg-primary' : 'bg-border',
              )}
              aria-hidden
            />
          )}
          <span
            className={cn(
              'relative z-[1] flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold tabular',
              s.state === 'done' && 'border-primary bg-primary text-primary-foreground',
              s.state === 'next' && 'border-primary bg-card text-primary ring-4 ring-primary/15',
              s.state === 'todo' && 'border-border bg-card text-muted-foreground',
              s.state === 'cancelled' &&
                'border-destructive bg-destructive text-destructive-foreground',
            )}
          >
            {s.state === 'done' ? (
              <Check className="size-4" strokeWidth={3} />
            ) : s.state === 'cancelled' ? (
              <X className="size-4" strokeWidth={3} />
            ) : (
              i + 1
            )}
          </span>
          <span
            className={cn(
              'mt-1.5 text-xs font-medium sm:text-sm',
              s.state === 'todo' && 'text-muted-foreground',
              s.state === 'cancelled' && 'text-destructive',
            )}
          >
            {s.label}
          </span>
          <span className="text-[11px] leading-tight text-muted-foreground tabular sm:text-xs">
            {s.at ? formatDateTime(s.at).slice(0, 10) : s.state === 'next' ? 'próximo' : ' '}
          </span>
          <span className="sr-only">
            {s.state === 'done'
              ? 'concluído'
              : s.state === 'next'
                ? 'próximo passo'
                : s.state === 'cancelled'
                  ? 'cancelado'
                  : 'pendente'}
          </span>
        </li>
      ))}
    </ol>
  );
}
