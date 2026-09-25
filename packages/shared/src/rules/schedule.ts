import { PaymentPeriodicity } from '../enums';
import { addDays, addMonths, diffDays, minYmd, type Ymd } from '../utils/dates';
import { fromCents, toCents, type MoneyString } from '../utils/money';

export interface RentScheduleInput {
  /** Primeiro dia do aluguel. */
  startDate: Ymd;
  /** Último dia do aluguel (inclusive). */
  endDate: Ymd;
  /** Vencimento da 1ª parcela. Padrão: o próprio início (cobrança antecipada). */
  firstDueDate?: Ymd;
  periodicity: PaymentPeriodicity;
  /** Valor cheio de um período. */
  amount: MoneyString;
}

export interface ScheduledInstallment {
  sequence: number;
  dueDate: Ymd;
  /** Período coberto pela parcela (inclusive nas duas pontas). */
  periodStart: Ymd;
  periodEnd: Ymd;
  amount: MoneyString;
  /** Última parcela menor que um período inteiro, cobrada pelos dias. */
  prorated: boolean;
}

/** Limite de segurança: contrato de 5 anos semanal = 261 parcelas. */
const MAX_INSTALLMENTS = 400;

function periodStartAt(start: Ymd, periodicity: PaymentPeriodicity, index: number): Ymd {
  switch (periodicity) {
    case 'WEEKLY':
      return addDays(start, 7 * index);
    case 'BIWEEKLY':
      return addDays(start, 14 * index);
    case 'MONTHLY':
      return addMonths(start, index, Number(start.slice(8, 10)));
  }
}

/**
 * Cronograma das parcelas do aluguel.
 *
 * Cada parcela cobre um período que começa no início do contrato + N períodos
 * (7 dias, 14 dias ou o mesmo dia do mês). O vencimento guarda a mesma
 * distância do início que a 1ª parcela: com o 1º vencimento no dia do início, o
 * aluguel é pago **antes** de usar (padrão das locadoras de moto).
 *
 * Se o término não fecha um período inteiro, a última parcela é proporcional
 * aos dias — cobrar a semana cheia por 3 dias de uso vira discussão no balcão.
 */
export function buildRentSchedule(input: RentScheduleInput): ScheduledInstallment[] {
  const { startDate, endDate, periodicity } = input;
  const firstDue = input.firstDueDate ?? startDate;
  if (endDate < startDate) return [];

  const fullCents = toCents(input.amount);
  const dueOffset = diffDays(startDate, firstDue);
  const firstDueDay = Number(firstDue.slice(8, 10));
  const result: ScheduledInstallment[] = [];

  for (let i = 0; i < MAX_INSTALLMENTS; i++) {
    const periodStart = periodStartAt(startDate, periodicity, i);
    if (periodStart > endDate) break;

    const nextStart = periodStartAt(startDate, periodicity, i + 1);
    const fullEnd = addDays(nextStart, -1);
    const periodEnd = minYmd(fullEnd, endDate);
    const prorated = periodEnd < fullEnd;

    const periodDays = diffDays(periodStart, nextStart);
    const coveredDays = diffDays(periodStart, periodEnd) + 1;
    const cents = prorated ? Math.round((fullCents * coveredDays) / periodDays) : fullCents;

    const dueDate =
      periodicity === 'MONTHLY'
        ? addMonths(firstDue, i, firstDueDay)
        : addDays(periodStart, dueOffset);

    result.push({
      sequence: i + 1,
      dueDate,
      periodStart,
      periodEnd,
      amount: fromCents(cents),
      prorated,
    });
  }
  return result;
}

/** Soma do cronograma — mostrada na revisão do contrato. */
export function scheduleTotal(items: ScheduledInstallment[]): MoneyString {
  return fromCents(items.reduce((acc, it) => acc + toCents(it.amount), 0));
}
