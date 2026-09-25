import type { StaffRole } from '@locamania/shared';

import { ValidationError } from '../../../shared/errors/domain-errors';

/**
 * Travas para ninguém se trancar fora do sistema:
 * - você não se desativa nem tira o próprio perfil de Proprietário;
 * - sempre sobra pelo menos um Proprietário ativo (é quem gerencia usuários).
 */
export function assertNotLockingSelfOut(
  targetId: string,
  actorId: string,
  target: { role: StaffRole },
  changes: { active?: boolean; role?: StaffRole },
): void {
  if (targetId !== actorId) return;
  if (changes.active === false) throw new ValidationError('Você não pode desativar a sua própria conta.');
  if (target.role === 'OWNER' && changes.role && changes.role !== 'OWNER') {
    throw new ValidationError('Você não pode tirar o seu próprio perfil de Proprietário.');
  }
}

export function assertKeepsAnOwner(
  target: { role: StaffRole; active: boolean },
  changes: { active?: boolean; role?: StaffRole; archived?: boolean },
  otherActiveOwners: number,
): void {
  if (target.role !== 'OWNER' || !target.active) return;
  const losing = changes.archived || changes.active === false || (changes.role !== undefined && changes.role !== 'OWNER');
  if (losing && otherActiveOwners === 0) {
    throw new ValidationError('É preciso manter pelo menos um Proprietário ativo.');
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
