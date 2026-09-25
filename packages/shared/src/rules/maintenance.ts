import { MaintenanceDueStatus } from '../enums';
import { addDays, diffDays, type Ymd } from '../utils/dates';

export interface MaintenanceAlertRules {
  /** Avisar quando faltarem até N km. */
  warnKm: number;
  /** Avisar quando faltarem até N dias. */
  warnDays: number;
}

export const DEFAULT_MAINTENANCE_RULES: MaintenanceAlertRules = { warnKm: 300, warnDays: 15 };

export interface MaintenanceDue {
  status: MaintenanceDueStatus;
  /** km até o próximo serviço (negativo = passou). Nulo se o plano não é por km. */
  kmRemaining: number | null;
  /** Dias até a data prevista (negativo = passou). Nulo se o plano não é por data. */
  daysRemaining: number | null;
  /** Qual critério está mais perto de vencer. */
  trigger: 'KM' | 'DATE' | null;
}

const rank = { OK: 0, DUE_SOON: 1, OVERDUE: 2 } as const;

/**
 * Situação de um plano de manutenção (§7, §41). O plano pode vencer por km, por
 * data ou pelos dois — vale o que chegar primeiro. Ex.: moto com 12.700 km e
 * troca de óleo prevista em 15.000 → 2.300 km restantes → OK; com aviso de 300
 * km, a partir de 14.700 fica "próxima"; em 15.000, "vencida".
 */
export function maintenanceDueStatus(
  plan: { nextDueKm: number | null; nextDueDate: Ymd | null },
  ctx: { currentKm: number; today: Ymd; rules: MaintenanceAlertRules },
): MaintenanceDue {
  const kmRemaining = plan.nextDueKm !== null ? plan.nextDueKm - ctx.currentKm : null;
  const daysRemaining = plan.nextDueDate !== null ? diffDays(ctx.today, plan.nextDueDate) : null;

  const byKm: MaintenanceDueStatus | null =
    kmRemaining === null
      ? null
      : kmRemaining <= 0
        ? 'OVERDUE'
        : kmRemaining <= ctx.rules.warnKm
          ? 'DUE_SOON'
          : 'OK';
  const byDate: MaintenanceDueStatus | null =
    daysRemaining === null
      ? null
      : daysRemaining < 0
        ? 'OVERDUE'
        : daysRemaining <= ctx.rules.warnDays
          ? 'DUE_SOON'
          : 'OK';

  if (byKm === null && byDate === null) {
    return { status: 'OK', kmRemaining, daysRemaining, trigger: null };
  }
  if (byDate === null || (byKm !== null && rank[byKm] >= rank[byDate])) {
    return { status: byKm!, kmRemaining, daysRemaining, trigger: 'KM' };
  }
  return { status: byDate, kmRemaining, daysRemaining, trigger: 'DATE' };
}

/**
 * Próximo vencimento depois de um serviço realizado: soma o intervalo ao km e
 * à data em que ele foi feito (não à previsão antiga — se a troca atrasou, o
 * próximo ciclo conta de quando ela aconteceu de fato).
 */
export function nextMaintenanceDue(
  interval: { intervalKm: number | null; intervalDays: number | null },
  done: { km: number | null; date: Ymd },
): { nextDueKm: number | null; nextDueDate: Ymd | null } {
  return {
    nextDueKm: interval.intervalKm && done.km !== null ? done.km + interval.intervalKm : null,
    nextDueDate: interval.intervalDays ? addDays(done.date, interval.intervalDays) : null,
  };
}

/** Frase para o cliente, sem dado interno (§9). */
export function customerMaintenanceMessage(due: MaintenanceDue, nextDueDate: Ymd | null): string {
  if (due.status === 'OVERDUE') {
    return 'Sua moto precisa passar por manutenção. Entre em contato com a Locamania.';
  }
  if (due.trigger === 'KM' && due.kmRemaining !== null) {
    return `Faltam aproximadamente ${due.kmRemaining.toLocaleString('pt-BR')} km para a próxima manutenção.`;
  }
  if (nextDueDate) {
    const [y, m, d] = nextDueDate.split('-');
    return `Revisão prevista para ${d}/${m}/${y}.`;
  }
  return 'Nenhuma manutenção prevista no momento.';
}
