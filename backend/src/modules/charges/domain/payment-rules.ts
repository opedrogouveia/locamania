import { computeLateFees, fromCents, toCents, type ChargeRules, type ChargeStatus, type Ymd } from '@locamania/shared';

import { ValidationError } from '../../../shared/errors/domain-errors';

export function assertPayable(status: ChargeStatus): void {
  if (status === 'PAID') throw new ValidationError('Esta cobrança já está paga.');
  if (status === 'CANCELLED') throw new ValidationError('Esta cobrança foi cancelada.');
}

/**
 * Valores da baixa: se a tela não mandar multa/juros, usa o cálculo pela data
 * do pagamento (quem paga no dia 12 uma parcela do dia 10 paga os encargos do
 * dia 12, não os de hoje).
 */
export function paymentAmounts(input: {
  amount: string;
  dueDate: Ymd;
  paidOn: Ymd;
  rules: Pick<ChargeRules, 'graceDays' | 'finePercent' | 'monthlyInterestPercent'>;
  fine?: string | null;
  interest?: string | null;
  discount?: string | null;
}): { fine: string; interest: string; discount: string; expected: string } {
  const fees = computeLateFees({ amount: input.amount, dueDate: input.dueDate, today: input.paidOn, rules: input.rules });
  const fine = input.fine ?? fees.fine;
  const interest = input.interest ?? fees.interest;
  const discount = input.discount ?? '0.00';
  const expected = fromCents(toCents(input.amount) + toCents(fine) + toCents(interest) - toCents(discount));
  if (toCents(expected) < 0) throw new ValidationError('O desconto não pode ser maior que o valor.');
  return { fine, interest, discount, expected };
}

/** Dia do pagamento → instante (meio-dia em São Paulo), para não "voltar um dia" em UTC. */
export function paidOnToInstant(paidOn: Ymd, today: Ymd, now: Date): Date {
  return paidOn === today ? now : new Date(`${paidOn}T12:00:00-03:00`);
}
