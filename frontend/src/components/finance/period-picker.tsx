'use client';

import type { Ymd } from '@locamania/shared';
import { useId } from 'react';

import { Input } from '@/components/ui/input';
import { FilterChips } from '@/components/ui/kit';
import { PERIOD_LABELS, PERIOD_PRESETS, type PeriodPreset } from '@/lib/finance/period';
import { cn, todayYmd } from '@/lib/utils';

/**
 * Filtro de período (§25): hoje, semana, mês, mês passado ou datas à escolha.
 * Fica numa linha só, acima de tudo o que ele filtra (financeiro, relatórios).
 */
export function PeriodPicker({
  preset,
  from,
  to,
  onChange,
  className,
}: {
  preset: PeriodPreset;
  from: Ymd;
  to: Ymd;
  onChange: (next: { p: PeriodPreset; from?: string; to?: string }) => void;
  className?: string;
}) {
  const today = todayYmd();
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-center', className)}>
      <FilterChips
        value={preset}
        onChange={(p) => (p === 'custom' ? onChange({ p, from, to }) : onChange({ p, from: '', to: '' }))}
        options={PERIOD_PRESETS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
      />
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor={`${id}-from`} className="text-xs text-muted-foreground">
              De
            </label>
            <Input id={`${id}-from`} type="date" value={from} max={to || today} onChange={(e) => e.target.value && onChange({ p: 'custom', from: e.target.value, to })} className="sm:w-40" />
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">
              Até
            </label>
            <Input id={`${id}-to`} type="date" value={to} min={from} onChange={(e) => e.target.value && onChange({ p: 'custom', from, to: e.target.value })} className="sm:w-40" />
          </div>
        </div>
      )}
    </div>
  );
}
