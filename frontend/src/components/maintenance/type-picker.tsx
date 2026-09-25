'use client';

import { Check } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { useMaintenanceTypes } from '@/lib/queries';
import { cn } from '@/lib/utils';

/** Serviços da manutenção (vários de uma vez: troca de óleo + revisão...). Lista, não texto livre. */
export function MaintenanceTypePicker({
  value,
  onChange,
  id,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  id?: string;
}) {
  const { data, isLoading } = useMaintenanceTypes();
  if (isLoading) return <Skeleton className="h-20 w-full" />;
  const types = (data ?? []).filter((t) => t.active || value.includes(t.id));
  return (
    <div id={id} role="group" className="flex flex-wrap gap-2">
      {types.map((t) => {
        const on = value.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}
            className={cn(
              'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-accent',
            )}
          >
            {on && <Check className="size-3.5" aria-hidden />}
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
