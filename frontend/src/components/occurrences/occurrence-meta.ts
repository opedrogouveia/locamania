import type { OccurrenceStatus, OccurrenceType } from '@locamania/shared';
import { Cog, FileWarning, Hammer, Siren, TriangleAlert, CircleHelp, type LucideIcon } from 'lucide-react';

/** Ícone de cada tipo de ocorrência (lista e ficha). */
export const OCCURRENCE_TYPE_ICON: Record<OccurrenceType, LucideIcon> = {
  TRAFFIC_FINE: FileWarning,
  ACCIDENT: TriangleAlert,
  DAMAGE: Hammer,
  THEFT: Siren,
  MECHANICAL_ISSUE: Cog,
  OTHER: CircleHelp,
};

/** Frase curta de cada situação, para o menu "Mudar situação". */
export const OCCURRENCE_STATUS_HINT: Record<OccurrenceStatus, string> = {
  OPEN: 'Registrada, ninguém cuidando ainda',
  IN_PROGRESS: 'Em tratamento (oficina, seguro, cobrança)',
  RESOLVED: 'Tudo certo, caso encerrado',
  CANCELLED: 'Registrada por engano ou sem efeito',
};
