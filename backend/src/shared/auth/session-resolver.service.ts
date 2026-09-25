import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';
import type { JwtPayload, Principal } from './principal';

interface CacheEntry {
  principal: Principal | null;
  at: number;
}

const TTL_MS = 15_000;

/**
 * Transforma o JWT num `Principal`, conferindo a conta no banco: ativa, não
 * arquivada e com a mesma versão de sessão. É o que faz "desativar usuário",
 * "trocar senha" e "encerrar sessões" valerem na hora — um JWT puro seguiria
 * válido até expirar.
 *
 * Cache de 15 s: evita uma consulta por requisição sem atrasar demais o corte.
 */
@Injectable()
export class SessionResolverService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async resolve(payload: JwtPayload): Promise<Principal | null> {
    const key = `${payload.typ}:${payload.sub}:${payload.ver}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.principal;

    const principal = payload.typ === 'staff' ? await this.staff(payload) : await this.customer(payload);
    this.cache.set(key, { principal, at: Date.now() });
    if (this.cache.size > 2000) this.cache.clear();
    return principal;
  }

  /** Esquece o cache de uma conta (após trocar senha, desativar, mudar papel). */
  forget(kind: 'staff' | 'customer', id: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${kind}:${id}:`)) this.cache.delete(key);
    }
  }

  forgetAllStaff(): void {
    for (const key of this.cache.keys()) if (key.startsWith('staff:')) this.cache.delete(key);
  }

  private async staff(payload: JwtPayload): Promise<Principal | null> {
    const user = await this.prisma.raw.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active || user.deletedAt || user.sessionVersion !== payload.ver) return null;
    return {
      kind: 'staff',
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: await this.permissions.forRole(user.role),
    };
  }

  private async customer(payload: JwtPayload): Promise<Principal | null> {
    const customer = await this.prisma.raw.customer.findUnique({ where: { id: payload.sub } });
    if (
      !customer ||
      !customer.portalEnabled ||
      customer.deletedAt ||
      customer.sessionVersion !== payload.ver
    ) {
      return null;
    }
    return { kind: 'customer', id: customer.id, name: customer.name, email: customer.email };
  }
}
