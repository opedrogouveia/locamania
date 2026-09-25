'use client';

/**
 * Peças pequenas de layout usadas em todas as telas (DESIGN_SYSTEM §2):
 * Field, FilterChips, StatCard, DetailList, SectionCard, SearchInput, Money.
 */
import type { LucideIcon } from 'lucide-react';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Label } from './label';

// ───────────────────────────── Field ─────────────────────────────

/** Rótulo + controle + dica + erro, com ids ligados (acessibilidade). */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-[13px]">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children(id)}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Grade de formulário: 1 coluna no celular, 2 ou 3 no desktop. */
export function FormGrid({ cols = 2, className, children }: { cols?: 2 | 3 | 4; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4',
        cols === 2 && 'sm:grid-cols-2',
        cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        cols === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ───────────────────────────── FilterChips ─────────────────────────────

export interface ChipOption<V extends string> {
  value: V;
  label: string;
  count?: number;
  tone?: 'default' | 'danger' | 'warning' | 'success';
}

/** Filtros em "pílulas" que rolam de lado no celular. */
export function FilterChips<V extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: V;
  onChange: (value: V) => void;
  options: ChipOption<V>[];
  className?: string;
}) {
  return (
    <div className={cn('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0', className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-accent',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular',
                  active
                    ? 'bg-primary-foreground/20'
                    : o.tone === 'danger'
                      ? 'bg-destructive/12 text-destructive'
                      : o.tone === 'warning'
                        ? 'bg-warning/15 text-warning'
                        : 'bg-muted text-muted-foreground',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────────── StatCard ─────────────────────────────

const TONES = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/12 text-destructive',
  info: 'bg-info/12 text-info',
  muted: 'bg-muted text-muted-foreground',
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
  className?: string;
}) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-xs font-medium text-muted-foreground sm:text-[13px]">{label}</p>
        <p className="truncate text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
        {hint && <p className="line-clamp-2 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {Icon && (
        <span className={cn('hidden size-10 shrink-0 items-center justify-center rounded-lg sm:flex', TONES[tone])}>
          <Icon className="size-[18px] sm:size-5" aria-hidden />
        </span>
      )}
    </div>
  );
  const cls = cn('rounded-xl border border-border bg-card p-4 shadow-sm transition-colors', href && 'hover:border-ring/40 hover:bg-accent/30', className);
  return href ? (
    <Link href={href} className={cn(cls, 'block')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ───────────────────────────── DetailList ─────────────────────────────

/** Pares rótulo/valor da ficha. Vazio vira "—". */
export function DetailList({ items, cols = 2, className }: { items: { label: string; value: ReactNode; wide?: boolean }[]; cols?: 1 | 2 | 3; className?: string }) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-4',
        cols === 2 && 'sm:grid-cols-2',
        cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className={cn('min-w-0', it.wide && 'sm:col-span-full')}>
          <dt className="text-xs font-medium text-muted-foreground">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm">{it.value === null || it.value === undefined || it.value === '' ? '—' : it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ───────────────────────────── SectionCard ─────────────────────────────

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-3 sm:p-5 sm:pb-3">
          <div className="min-w-0 space-y-1">
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn('p-4 pt-0 sm:p-5 sm:pt-0', !title && !actions && 'pt-4 sm:pt-5', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

// ───────────────────────────── SearchInput ─────────────────────────────

/** Busca com espera curta (não dispara uma requisição por tecla). */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  className,
  delay = 300,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  delay?: number;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), delay);
    return () => clearTimeout(t);
  }, [local, value, onChange, delay]);
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex h-10 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
      />
      {local && (
        <button
          type="button"
          onClick={() => {
            setLocal('');
            onChange('');
          }}
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Limpar busca"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

// ───────────────────────────── Toolbar ─────────────────────────────

/** Linha de filtros/busca da lista: empilha no celular. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between', className)}>{children}</div>;
}

/** Cartão do celular: título, linha de apoio e badge à direita. */
export function MobileRow({
  title,
  subtitle,
  meta,
  right,
  leading,
  wrapTitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  leading?: ReactNode;
  /** Título em até 2 linhas (descrições longas), em vez de cortar com "…". */
  wrapTitle?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {leading}
      <div className="min-w-0 flex-1">
        <p className={cn('text-[15px] font-medium', wrapTitle ? 'line-clamp-2 leading-snug' : 'truncate')}>{title}</p>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{meta}</div>}
      </div>
      {right && <div className="flex shrink-0 flex-col items-end gap-1 text-right">{right}</div>}
    </div>
  );
}

// ───────────────────────────── StickyActions ─────────────────────────────

/**
 * Botões do formulário: no celular ficam presos acima da barra inferior (o
 * polegar alcança sem rolar até o fim); no desktop, no fim do formulário.
 */
export function StickyActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'sticky bottom-[calc(3.9rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none',
        className,
      )}
    >
      <div className="flex justify-end gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{children}</div>
    </div>
  );
}
