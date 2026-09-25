'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  /** Esconde em telas médias (tablet); some sempre no cartão do celular. */
  hideBelow?: 'md' | 'lg' | 'xl';
}

export interface DataTableProps<T> {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Cartão do celular: o que importa para decidir sem abrir a ficha. */
  mobileCard: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  empty?: { icon?: React.ComponentProps<typeof EmptyState>['icon']; title: string; description?: string; action?: ReactNode };
  rowClassName?: (row: T) => string | undefined;
  className?: string;
}

const HIDE: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

/**
 * Lista responsiva: **tabela no desktop, cartões no celular** (DESIGN_SYSTEM
 * §5). Tabela com dez colunas em 390 px vira rolagem lateral — e ninguém usa.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  mobileCard,
  onRowClick,
  empty,
  rowClassName,
  className,
}: DataTableProps<T>) {
  if (loading && !rows) {
    return (
      <div className={cn('space-y-2 p-4', className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return empty ? <EmptyState {...empty} /> : null;
  }
  return (
    <div className={className}>
      {/* Celular */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            {onRowClick ? (
              <button
                type="button"
                onClick={() => onRowClick(row)}
                className={cn('block w-full px-4 py-3.5 text-left transition-colors active:bg-muted/70', rowClassName?.(row))}
              >
                {mobileCard(row)}
              </button>
            ) : (
              <div className={cn('px-4 py-3.5', rowClassName?.(row))}>{mobileCard(row)}</div>
            )}
          </li>
        ))}
      </ul>

      {/* Tablet/desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.hideBelow && HIDE[c.hideBelow], c.className)}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row))}
              >
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn(
                      c.align === 'right' && 'text-right tabular',
                      c.align === 'center' && 'text-center',
                      c.hideBelow && HIDE[c.hideBelow],
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
