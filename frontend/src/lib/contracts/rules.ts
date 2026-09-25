/**
 * Regras de tela do contrato e dos pagamentos (funções puras, sem React).
 * As validações espelham as do backend (`contract-rules.ts`) só para avisar
 * antes — quem decide de verdade é a API.
 */
import {
  addDays,
  addMonths,
  diffDays,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  toCents,
  type PaymentPeriodicity,
  type Ymd,
} from '@locamania/shared';

// ───────────────────────────── Novo aluguel ─────────────────────────────

/** Durações prontas do assistente (o término é o dia anterior ao "aniversário"). */
export const DURATION_PRESETS = [
  { months: 1, label: '1 mês' },
  { months: 3, label: '3 meses' },
  { months: 6, label: '6 meses' },
  { months: 12, label: '1 ano' },
] as const;

/** Término para N meses a partir do início: 01/10 + 3 meses → 31/12. */
export function endDateForMonths(start: Ymd, months: number): Ymd {
  return addDays(addMonths(start, months), -1);
}

/** Último dia do 1º período — o 1º vencimento precisa cair até ele. */
export function firstPeriodEnd(start: Ymd, periodicity: PaymentPeriodicity): Ymd {
  if (periodicity === 'MONTHLY') return addDays(addMonths(start, 1), -1);
  return addDays(start, periodicity === 'WEEKLY' ? 6 : 13);
}

/** Dias corridos do contrato (inclusive nas duas pontas). */
export function contractDays(start: Ymd, end: Ymd): number {
  return diffDays(start, end) + 1;
}

/** "3 meses e 5 dias", "26 semanas", "45 dias" — só para leitura. */
export function durationLabel(start: Ymd, end: Ymd): string {
  const days = contractDays(start, end);
  if (days <= 0) return '—';
  let months = 0;
  while (endDateForMonths(start, months + 1) <= end) months++;
  const rest = diffDays(months ? endDateForMonths(start, months) : addDays(start, -1), end);
  if (months === 0)
    return days % 7 === 0 ? `${days / 7} ${days === 7 ? 'semana' : 'semanas'}` : `${days} dias`;
  const m =
    months === 12
      ? '1 ano'
      : months === 24
        ? '2 anos'
        : `${months} ${months === 1 ? 'mês' : 'meses'}`;
  return rest > 0 ? `${m} e ${rest} ${rest === 1 ? 'dia' : 'dias'}` : m;
}

export interface ConditionsInput {
  startDate: Ymd;
  endDate: Ymd;
  firstDueDate: Ymd;
  periodicity: PaymentPeriodicity;
  rentAmount: string;
  depositAmount: string;
}

export type ConditionsErrors = Partial<Record<keyof ConditionsInput, string>>;

/** As mesmas regras da API, para avisar no campo antes de enviar. */
export function validateConditions(v: ConditionsInput, today: Ymd): ConditionsErrors {
  const e: ConditionsErrors = {};
  if (!v.startDate) e.startDate = 'Informe o início.';
  else if (diffDays(v.startDate, today) > 60)
    e.startDate = 'O início não pode ser mais de 60 dias no passado.';
  if (!v.endDate) e.endDate = 'Informe o término.';
  else if (v.startDate && v.endDate <= v.startDate)
    e.endDate = 'O término precisa ser depois do início.';
  else if (v.startDate && diffDays(v.startDate, v.endDate) > 366 * 3)
    e.endDate = 'O contrato pode ter no máximo 3 anos.';
  if (v.startDate && v.firstDueDate) {
    const limit = firstPeriodEnd(v.startDate, v.periodicity);
    if (v.firstDueDate < v.startDate || v.firstDueDate > limit)
      e.firstDueDate = 'O 1º vencimento precisa cair dentro do primeiro período.';
  }
  if (toCents(v.rentAmount) <= 0) e.rentAmount = 'Informe o valor do aluguel.';
  return e;
}

// ───────────────────────────── Períodos (Pagamentos) ─────────────────────────────

export type PeriodPreset = 'all' | 'today' | 'week' | 'next7' | 'month' | 'lastMonth' | 'custom';

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: 'Todo o período',
  today: 'Hoje',
  week: 'Esta semana',
  next7: 'Próximos 7 dias',
  month: 'Este mês',
  lastMonth: 'Mês passado',
  custom: 'Escolher datas',
};

/** Intervalo (inclusive) de um período pronto; `undefined` = sem limite. */
export function periodRange(
  preset: PeriodPreset,
  today: Ymd,
  custom?: { from?: Ymd; to?: Ymd },
): { from?: Ymd; to?: Ymd } {
  switch (preset) {
    case 'all':
      return {};
    case 'today':
      return { from: today, to: today };
    case 'week': {
      const from = startOfWeek(today);
      return { from, to: addDays(from, 6) };
    }
    case 'next7':
      return { from: today, to: addDays(today, 7) };
    case 'month':
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case 'lastMonth': {
      const last = addDays(startOfMonth(today), -1);
      return { from: startOfMonth(last), to: last };
    }
    case 'custom':
      return { from: custom?.from || undefined, to: custom?.to || undefined };
  }
}

export function isPeriodPreset(v: string | undefined): v is PeriodPreset {
  return !!v && v in PERIOD_LABELS;
}
