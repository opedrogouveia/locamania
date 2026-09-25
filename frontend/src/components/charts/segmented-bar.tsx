'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';

export interface Segment {
  key: string;
  label: string;
  value: number;
  /** Classe de fundo por token (ex.: `bg-chart-1`). */
  colorClass: string;
  href?: string;
}

/**
 * Composição de um total (frota por situação): uma barra com segmentos
 * separados por 2 px de superfície + legenda com rótulo e quantidade — a
 * identidade nunca fica só na cor.
 */
export function SegmentedBar({ segments, total, className }: { segments: Segment[]; total: number; className?: string }) {
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div className={className}>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px] bg-muted" role="img" aria-label={visible.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        {visible.map((s) => (
          <div key={s.key} className={cn('h-full', s.colorClass)} style={{ width: `${(s.value / Math.max(total, 1)) * 100}%` }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
        {segments.map((s) => {
          const body = (
            <>
              <span className={cn('size-2.5 shrink-0 rounded-[3px]', s.colorClass)} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{s.label}</span>
              <span className="text-sm font-medium tabular">{s.value}</span>
            </>
          );
          return (
            <li key={s.key}>
              {s.href ? (
                <Link href={s.href} className="-mx-2 flex min-h-9 items-center gap-2 rounded-md px-2 hover:bg-accent">
                  {body}
                </Link>
              ) : (
                <div className="flex min-h-9 items-center gap-2">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
