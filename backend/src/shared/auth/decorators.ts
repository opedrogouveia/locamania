import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission } from '@locamania/shared';
import type { Request } from 'express';

import { ForbiddenError } from '../errors/domain-errors';
import type { CustomerPrincipal, Principal, StaffPrincipal } from './principal';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const IS_CUSTOMER_ROUTE_KEY = 'auth:isCustomerRoute';
export const PERMISSIONS_KEY = 'auth:permissions';
export const ANY_PERMISSIONS_KEY = 'auth:anyPermissions';
export const RATE_LIMIT_KEY = 'auth:rateLimit';

/** Rota pública (login, webhook, health). Ignora a autenticação. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Rota do app do cliente. Sem este decorator, a rota é da equipe e **recusa
 * token de cliente** — o padrão é o seguro: esquecer o decorator nunca abre
 * dado administrativo para o cliente.
 */
export const CustomerRoute = () => SetMetadata(IS_CUSTOMER_ROUTE_KEY, true);

/** Exige TODAS as permissões listadas (rotas da equipe). */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/** Exige PELO MENOS UMA das permissões (ex.: cadastrar item de catálogo de dentro de um formulário). */
export const RequireAnyPermission = (...permissions: Permission[]) => SetMetadata(ANY_PERMISSIONS_KEY, permissions);

export interface RateLimitOptions {
  /** Requisições permitidas na janela. */
  max: number;
  windowMs: number;
  /** Nome do balde (rotas diferentes não somam). */
  bucket: string;
}

/** Freio por IP (login, recuperação de senha, webhook). */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

function principalOf(ctx: ExecutionContext): Principal | undefined {
  return ctx.switchToHttp().getRequest<Request>().user as Principal | undefined;
}

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal | undefined => principalOf(ctx),
);

export const CurrentStaff = createParamDecorator((_data: unknown, ctx: ExecutionContext): StaffPrincipal => {
  const p = principalOf(ctx);
  if (p?.kind !== 'staff') throw new ForbiddenError('Acesso restrito à equipe.');
  return p;
});

export const CurrentCustomer = createParamDecorator((_data: unknown, ctx: ExecutionContext): CustomerPrincipal => {
  const p = principalOf(ctx);
  if (p?.kind !== 'customer') throw new ForbiddenError('Acesso restrito ao cliente.');
  return p;
});
