import { addMonths, endOfMonth, isYmd, startOfMonth, startOfWeek, type Ymd } from '@locamania/shared';

/** Atalhos de período do financeiro e dos relatórios (§25: hoje, semana, mês, personalizado). */
export type PeriodPreset = 'today' | 'week' | 'month' | 'last-month' | 'custom';

export const PERIOD_PRESETS: PeriodPreset[] = ['today', 'week', 'month', 'last-month', 'custom'];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Hoje',
  week: 'Esta semana',
  month: 'Este mês',
  'last-month': 'Mês passado',
  custom: 'Personalizado',
};

export function isPreset(value: string | undefined): value is PeriodPreset {
  return !!value && (PERIOD_PRESETS as string[]).includes(value);
}

/**
 * Início e fim do período (inclusivos). Semana começa na segunda. "Personalizado"
 * com datas inválidas cai no mês corrente; datas trocadas são desviradas.
 */
export function periodRange(preset: PeriodPreset, today: Ymd, from?: string, to?: string): { from: Ymd; to: Ymd } {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: startOfWeek(today), to: today };
    case 'last-month': {
      const start = addMonths(startOfMonth(today), -1, 1);
      return { from: start, to: endOfMonth(start) };
    }
    case 'custom': {
      if (from && to && isYmd(from) && isYmd(to)) return from <= to ? { from, to } : { from: to, to: from };
      if (from && isYmd(from)) return { from, to: from > today ? from : today };
      return { from: startOfMonth(today), to: today };
    }
    default:
      return { from: startOfMonth(today), to: today };
  }
}

