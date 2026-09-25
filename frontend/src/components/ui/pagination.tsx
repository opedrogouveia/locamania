'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Monta a sequência de páginas com reticências, no estilo 1 … 4 5 6 … 50.
 * Mantém sempre a primeira, a última e uma janela em volta da atual, para a
 * barra não crescer sem limite quando houver dezenas de páginas.
 */
function pageSequence(current: number, total: number, radius = 1): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total]);
  for (let p = current - radius; p <= current + radius; p++) {
    if (p > 1 && p < total) pages.add(p);
  }
  // Sem isto, a janela perto das pontas fica curta demais.
  if (current <= 3) [2, 3, 4].forEach((p) => p < total && pages.add(p));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => p > 1 && pages.add(p));

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  /** Unidade no resumo ("case(s)", "client(s)"...). */
  unit?: string;
  onPageChange: (page: number) => void;
  /** Opções de itens por página; omitir esconde o seletor. */
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  unit = 'itens',
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const pages = Math.max(totalPages, 1);
  const sequence = pageSequence(page, pages);

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-xs text-muted-foreground">
        {total} {unit} · página {page} de {pages}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {pageSizeOptions && onPageSizeChange && (
          <div className="flex items-center gap-1">
            {pageSizeOptions.map((size) => (
              <Button
                key={size}
                variant={pageSize === size ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageSizeChange(size)}
                aria-pressed={pageSize === size}
              >
                {size}
              </Button>
            ))}
          </div>
        )}

        <nav className="flex items-center gap-1" aria-label="Paginação">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            aria-label="Primeira página"
            title="Primeira página"
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft />
          </Button>

          {sequence.map((item, i) =>
            item === '…' ? (
              <span
                key={`gap-${i}`}
                className="px-1 text-sm text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? 'default' : 'outline'}
                size="icon-sm"
                onClick={() => onPageChange(item)}
                aria-label={`Página ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className="tabular-nums"
              >
                {item}
              </Button>
            ),
          )}

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
            aria-label="Próxima página"
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(pages)}
            disabled={page >= pages}
            aria-label="Última página"
            title="Última página"
          >
            <ChevronsRight />
          </Button>
        </nav>
      </div>
    </div>
  );
}
