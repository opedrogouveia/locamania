import type { Permission, StaffRole } from '@locamania/shared';

/** Alguém da equipe, autenticado no painel. */
export interface StaffPrincipal {
  kind: 'staff';
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  permissions: ReadonlySet<Permission>;
}

/** Cliente, autenticado no app. `id` é o id do Customer. */
export interface CustomerPrincipal {
  kind: 'customer';
  id: string;
  name: string;
  email: string | null;
}

export type Principal = StaffPrincipal | CustomerPrincipal;

/** Conteúdo do JWT. `ver` = versão da sessão (trocar senha invalida tokens antigos). */
export interface JwtPayload {
  sub: string;
  typ: 'staff' | 'customer';
  ver: number;
}

export function hasPermission(principal: Principal | undefined, permission: Permission): boolean {
  return principal?.kind === 'staff' && principal.permissions.has(permission);
}

/**
 * O padrão de ocultação de valores: sem a permissão, o dinheiro sai `null` da
 * API — não é filtro de tela, o dado não trafega.
 */
export function moneyFor<T>(principal: Principal | undefined, permission: Permission, value: T): T | null {
  return hasPermission(principal, permission) ? value : null;
}
