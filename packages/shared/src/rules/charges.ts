import { ChargeDisplayStatus, type ChargeStatus } from '../enums';
import { diffDays, type Ymd } from '../utils/dates';
import { fromCents, toCents, type MoneyString } from '../utils/money';

/** Regras de cobrança configuráveis em Configurações › Pagamentos. */
export interface ChargeRules {
  /** Dias após o vencimento sem considerar atraso (tolerância). */
  graceDays: number;
  /** A partir de quantos dias antes do vencimento a cobrança fica "próxima do vencimento". */
  dueSoonDays: number;
  /** Multa única por atraso, em % do valor. */
  finePercent: number;
  /** Juros ao mês, em %, cobrados pro rata dia (mês comercial de 30 dias). */
  monthlyInterestPercent: number;
}

export const DEFAULT_CHARGE_RULES: ChargeRules = {
  graceDays: 1,
  dueSoonDays: 3,
  finePercent: 2,
  monthlyInterestPercent: 1,
};

/** Está em atraso de verdade (passou da tolerância)? */
export function isPastGrace(dueDate: Ymd, today: Ymd, graceDays: number): boolean {
  return diffDays(dueDate, today) > graceDays;
}

/**
 * Situação exibida da cobrança (§11): Pago, A vencer, Próximo do vencimento,
 * Em atraso, Cancelado. "Em atraso" também é reconhecido na leitura — se o job
 * diário não rodou (servidor dormindo), a tela não mente.
 */
export function chargeDisplayStatus(
  charge: { status: ChargeStatus; dueDate: Ymd },
  today: Ymd,
  rules: Pick<ChargeRules, 'graceDays' | 'dueSoonDays'>,
): ChargeDisplayStatus {
  if (charge.status === 'PAID') return ChargeDisplayStatus.PAID;
  if (charge.status === 'CANCELLED') return ChargeDisplayStatus.CANCELLED;
  if (charge.status === 'OVERDUE' || isPastGrace(charge.dueDate, today, rules.graceDays)) {
    return ChargeDisplayStatus.OVERDUE;
  }
  if (diffDays(today, charge.dueDate) <= rules.dueSoonDays) return ChargeDisplayStatus.DUE_SOON;
  return ChargeDisplayStatus.UPCOMING;
}

export interface LateFees {
  /** Dias corridos desde o vencimento (0 se ainda não venceu). */
  daysLate: number;
  /** Passou da tolerância — só então há encargo. */
  chargeable: boolean;
  fine: MoneyString;
  interest: MoneyString;
  /** Valor + multa + juros. */
  total: MoneyString;
}

/**
 * Encargos por atraso (§11, §14). Dentro da tolerância não há multa nem juros;
 * passou dela, a multa é única e os juros correm por dia **desde o vencimento**
 * (é o que o Código de Defesa do Consumidor e a prática bancária usam).
 */
export function computeLateFees(input: {
  amount: MoneyString;
  dueDate: Ymd;
  today: Ymd;
  rules: Pick<ChargeRules, 'graceDays' | 'finePercent' | 'monthlyInterestPercent'>;
}): LateFees {
  const cents = toCents(input.amount);
  const daysLate = Math.max(0, diffDays(input.dueDate, input.today));
  const chargeable = daysLate > input.rules.graceDays;
  if (!chargeable) {
    return { daysLate, chargeable, fine: '0.00', interest: '0.00', total: fromCents(cents) };
  }
  const fine = Math.round((cents * input.rules.finePercent) / 100);
  const interest = Math.round((cents * (input.rules.monthlyInterestPercent / 100) * daysLate) / 30);
  return {
    daysLate,
    chargeable,
    fine: fromCents(fine),
    interest: fromCents(interest),
    total: fromCents(cents + fine + interest),
  };
}

/**
 * Qual lembrete de pagamento vale hoje, dados os marcos configurados
 * (ex.: [7, 3, 1, 0, -1, -3] = 7, 3 e 1 dia antes, no dia, 1 e 3 depois).
 *
 * Devolve o marco mais recente já alcançado. Se o job não rodou num dia (o
 * servidor gratuito dorme), o aviso daquele marco sai no dia seguinte em vez de
 * se perder; a deduplicação por marco impede repetir.
 */
export function currentReminderOffset(dueDate: Ymd, today: Ymd, offsets: number[]): number | null {
  const daysUntil = diffDays(today, dueDate);
  const sorted = [...new Set(offsets)].sort((a, b) => b - a);
  let current: number | null = null;
  for (const offset of sorted) {
    if (daysUntil <= offset) current = offset;
    else break;
  }
  return current;
}

/** Texto do lembrete para o cliente, conforme a distância do vencimento. */
export function reminderMessage(daysUntil: number): string {
  if (daysUntil > 1) return `Seu aluguel vence em ${daysUntil} dias.`;
  if (daysUntil === 1) return 'Seu pagamento vence amanhã.';
  if (daysUntil === 0) return 'Seu pagamento vence hoje.';
  return 'Identificamos que seu pagamento está em atraso.';
}
