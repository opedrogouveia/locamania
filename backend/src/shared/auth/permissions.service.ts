import { Injectable, Logger } from '@nestjs/common';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  isPermission,
  STAFF_ROLES,
  type Permission,
  type StaffRole,
} from '@locamania/shared';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Matriz papel → permissões, lida do banco (`RolePermission`) com cache em
 * memória. Editar em Configurações › Permissões chama `invalidate()`.
 *
 * OWNER sempre tem tudo, independente do banco: ninguém consegue tirar do
 * Proprietário o acesso que permite desfazer o erro.
 */
@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);
  private cache: Map<StaffRole, ReadonlySet<Permission>> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async forRole(role: StaffRole): Promise<ReadonlySet<Permission>> {
    if (role === 'OWNER') return new Set(ALL_PERMISSIONS);
    const map = await this.load();
    return map.get(role) ?? new Set(DEFAULT_ROLE_PERMISSIONS[role]);
  }

  async matrix(): Promise<Record<StaffRole, Permission[]>> {
    const map = await this.load();
    return Object.fromEntries(
      STAFF_ROLES.map((role) => [role, role === 'OWNER' ? ALL_PERMISSIONS : [...(map.get(role) ?? [])]]),
    ) as Record<StaffRole, Permission[]>;
  }

  invalidate(): void {
    this.cache = null;
  }

  private async load(): Promise<Map<StaffRole, ReadonlySet<Permission>>> {
    if (this.cache) return this.cache;
    const rows = await this.prisma.raw.rolePermission.findMany();
    const map = new Map<StaffRole, ReadonlySet<Permission>>();
    for (const role of STAFF_ROLES) {
      const row = rows.find((r) => r.role === role);
      const perms = row ? row.permissions.filter(isPermission) : DEFAULT_ROLE_PERMISSIONS[role];
      map.set(role, new Set(perms));
    }
    if (rows.length === 0) this.logger.warn('Matriz de permissões vazia no banco — usando o padrão.');
    this.cache = map;
    return map;
  }
}
