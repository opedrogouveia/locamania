import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const DOT = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/50',
} as const;

/**
 * Número do financeiro (skill dataviz: "stat tile"). Sem ícone, para o valor em
 * reais caber inteiro mesmo com cinco lado a lado; a situação vem de um ponto
 * colorido + rótulo, nunca só da cor.
 */
export function KpiTile({
  label,
  value,
  hint,
  tone = 'muted',
  href,
  emphasis,
  className,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: keyof typeof DOT;
  href?: string;
  /** O número principal da tela (resultado): borda na cor do sinal. */
  emphasis?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-[13px]">
        <span className={cn('size-2 shrink-0 rounded-full', DOT[tone])} aria-hidden />
        <span className="truncate">{label}</span>
        {href && <ChevronRight className="ml-auto size-3.5 shrink-0" aria-hidden />}
      </p>
      <p className={cn('mt-1 whitespace-nowrap text-lg font-semibold tracking-tight sm:text-2xl', emphasis && tone === 'danger' && 'text-destructive')}>{value}</p>
      {hint && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const cls = cn(
    'min-w-0 rounded-xl border bg-card p-4 shadow-sm transition-colors',
    emphasis ? (tone === 'danger' ? 'border-destructive/40' : 'border-success/40') : 'border-border',
    href && 'hover:border-ring/40 hover:bg-accent/30',
    className,
  );
  return href ? (
    <Link href={href} className={cn(cls, 'block')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
