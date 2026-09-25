'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Escolha única em cartões (periodicidade, moto, destino da moto, caução...).
 * Alvo de toque grande e o que está escolhido fica óbvio — melhor que um
 * select no celular quando as opções são poucas e precisam de explicação.
 */
export function ChoiceGroup<V extends string>({
  value,
  onChange,
  options,
  cols = 3,
  label,
  compact,
  className,
}: {
  value: V | null;
  onChange: (value: V) => void;
  options: {
    value: V;
    title: ReactNode;
    description?: ReactNode;
    aside?: ReactNode;
    disabled?: boolean;
  }[];
  cols?: 1 | 2 | 3 | 4;
  label: string;
  /** Poucas opções curtas: ficam lado a lado também no celular, sem a bolinha. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'grid gap-2',
        cols === 1 && 'grid-cols-1',
        cols === 2 && 'grid-cols-1 sm:grid-cols-2',
        cols === 3 && (compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'),
        cols === 4 && 'grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {options.map((o) => (
        <ChoiceCard
          key={o.value}
          selected={o.value === value}
          onSelect={() => onChange(o.value)}
          title={o.title}
          description={o.description}
          aside={o.aside}
          disabled={o.disabled}
          compact={compact}
        />
      ))}
    </div>
  );
}

export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  aside,
  disabled,
  compact,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex min-h-12 w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-primary bg-primary/[0.06] ring-1 ring-primary'
          : 'border-border hover:border-ring/40 hover:bg-accent/40',
        compact &&
          'flex-col items-center gap-0 px-2 text-center sm:flex-row sm:items-start sm:gap-3 sm:px-3 sm:text-left',
        className,
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
          compact && 'hidden sm:flex',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background',
        )}
        aria-hidden
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        )}
      </span>
      {aside && <span className="shrink-0 text-right text-sm">{aside}</span>}
    </button>
  );
}
