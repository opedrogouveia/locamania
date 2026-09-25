import type {
  MaintenanceDueDto,
  MaintenancePlanDto,
  MotorcycleListItemDto,
} from '@locamania/shared';

import { formatYmd, plural } from '@/lib/utils';

const km = (n: number) => `${Math.abs(n).toLocaleString('pt-BR')} km`;

/** Parte em km: "faltam 300 km" / "passou 415 km". */
function kmPart(kmRemaining: number): string {
  return kmRemaining > 0
    ? `faltam ${km(kmRemaining)}`
    : kmRemaining === 0
      ? 'chegou no km'
      : `passou ${km(kmRemaining)}`;
}

/** Parte em dias: "em 15 dias" / "venceu há 3 dias". */
function dayPart(days: number): string {
  if (days === 0) return 'vence hoje';
  if (days === 1) return 'vence amanhã';
  return days > 0
    ? `em ${plural(days, 'dia', 'dias')}`
    : `venceu há ${plural(-days, 'dia', 'dias')}`;
}

/**
 * Frase curta do quanto falta (§8, §41): usa o critério que está mais perto
 * de vencer. Ex.: "faltam 2.300 km", "passou 415 km", "em 15 dias".
 */
export function dueText(
  due: Pick<MaintenanceDueDto, 'kmRemaining' | 'daysRemaining' | 'trigger'>,
): string {
  if (due.trigger === 'DATE' && due.daysRemaining !== null) return dayPart(due.daysRemaining);
  if (due.kmRemaining !== null) return kmPart(due.kmRemaining);
  if (due.daysRemaining !== null) return dayPart(due.daysRemaining);
  return 'sem previsão';
}

/** Mesma frase para o resumo da lista de motos (sem o "trigger"). */
export function nextMaintenanceText(
  next: NonNullable<MotorcycleListItemDto['nextMaintenance']>,
): string {
  const byKm = next.kmRemaining;
  const byDays = next.daysRemaining;
  // Compara como o backend: ~150 km por dia de uso.
  if (byKm !== null && (byDays === null || byKm <= byDays * 150)) return kmPart(byKm);
  if (byDays !== null) return dayPart(byDays);
  return 'sem previsão';
}

/** "A cada 3.000 km ou 120 dias". */
export function intervalText(
  plan: Pick<MaintenancePlanDto, 'intervalKm' | 'intervalDays'>,
): string {
  const parts = [
    plan.intervalKm ? km(plan.intervalKm) : null,
    plan.intervalDays ? daysOrMonths(plan.intervalDays) : null,
  ].filter(Boolean);
  return parts.length ? `A cada ${parts.join(' ou ')}` : 'Sem intervalo';
}

/** 180 → "6 meses"; 540 → "18 meses"; 45 → "45 dias". */
export function daysOrMonths(days: number): string {
  if (days >= 60 && days % 30 === 0) return plural(days / 30, 'mês', 'meses');
  if (days % 365 === 0) return plural(days / 365, 'ano', 'anos');
  return plural(days, 'dia', 'dias');
}

/** "38.581 km ou 10/01/2027". */
export function nextDueText(plan: Pick<MaintenancePlanDto, 'nextDueKm' | 'nextDueDate'>): string {
  const parts = [
    plan.nextDueKm !== null ? km(plan.nextDueKm) : null,
    plan.nextDueDate ? formatYmd(plan.nextDueDate) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' ou ') : '—';
}

/** "35.581 km em 12/09/2026". */
export function lastDoneText(plan: Pick<MaintenancePlanDto, 'lastDoneKm' | 'lastDoneAt'>): string {
  if (plan.lastDoneKm === null && !plan.lastDoneAt) return 'Sem registro';
  if (plan.lastDoneKm === null) return formatYmd(plan.lastDoneAt);
  return [
    plan.lastDoneKm !== null ? km(plan.lastDoneKm) : null,
    plan.lastDoneAt ? `em ${formatYmd(plan.lastDoneAt)}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}
