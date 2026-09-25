'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BarListItem {
  key: string;
  label: ReactNode;
  /** Linha de apoio (modelo da moto, custo, atraso). */
  hint?: ReactNode;
  value: number;
  /** Valor já formatado (R$). */
  display: string;
  /** Texto à direita, embaixo do valor (ex.: "38%", "saldo R$ 900"). */
  aside?: ReactNode;
  href?: string;
}

/**
 * Ranking em barras horizontais (receita por moto, despesas por categoria):
 * uma série, uma cor (a da série no gráfico de entradas × saídas), barra fina
 * com trilho, valor em texto — nunca na cor da série.
 */
export function BarList({
  items,
  colorClass,
  limit = 8,
  unit = 'itens',
  className,
}: {
  items: BarListItem[];
  colorClass: string;
  limit?: number;
  unit?: string;
  className?: string;
}) {
  const [all, setAll] = useState(false);
  const max = Math.max(...items.map((i) => i.value), 0) || 1;
  const shown = all ? items : items.slice(0, limit);
  return (
    <div className={className}>
      <ul className="divide-y divide-border">
        {shown.map((item) => {
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  {item.hint && <p className="truncate text-xs text-muted-foreground">{item.hint}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular">{item.display}</p>
                  {item.aside && <p className="whitespace-nowrap text-xs text-muted-foreground tabular">{item.aside}</p>}
                </div>
                {item.href && <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${Math.max(1.5, (item.value / max) * 100)}%` }} />
              </div>
            </>
          );
          return (
            <li key={item.key}>
              {item.href ? (
                <Link href={item.href} className="block px-4 py-3 transition-colors hover:bg-accent/50 sm:px-5">
                  {body}
                </Link>
              ) : (
                <div className="px-4 py-3 sm:px-5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > limit && (
        <div className="border-t border-border p-2">
          <Button variant="ghost" className="w-full" onClick={() => setAll((v) => !v)}>
            {all ? 'Mostrar menos' : `Ver todos (${items.length} ${unit})`}
          </Button>
        </div>
      )}
    </div>
  );
}
