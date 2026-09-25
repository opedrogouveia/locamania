import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Permission } from '@locamania/shared';
import type { Request } from 'express';

import { ForbiddenError } from '../errors/domain-errors';
import {
  ANY_PERMISSIONS_KEY,
  IS_CUSTOMER_ROUTE_KEY,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from './decorators';
import type { Principal } from './principal';

function meta<T>(reflector: Reflector, key: string, ctx: ExecutionContext): T | undefined {
  return reflector.getAllAndOverride<T>(key, [ctx.getHandler(), ctx.getClass()]);
}

/** 1º guard global: JWT válido, exceto em rotas @Public(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    if (meta<boolean>(this.reflector, IS_PUBLIC_KEY, context)) return true;
    return super.canActivate(context);
  }
}

/**
 * 2º guard global: separa equipe de cliente e aplica as permissões.
 *
 * - Rota @CustomerRoute() → só token de cliente.
 * - Qualquer outra → só token da equipe, com TODAS as @RequirePermissions().
 */
@Injectable()
export class ActorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (meta<boolean>(this.reflector, IS_PUBLIC_KEY, context)) return true;
    const principal = context.switchToHttp().getRequest<Request>().user as Principal | undefined;
    if (!principal) throw new ForbiddenError('Acesso negado.');

    const customerRoute = meta<boolean>(this.reflector, IS_CUSTOMER_ROUTE_KEY, context) ?? false;
    if (customerRoute) {
      if (principal.kind !== 'customer') throw new ForbiddenError('Esta área é do aplicativo do cliente.');
      return true;
    }

    if (principal.kind !== 'staff') throw new ForbiddenError('Acesso restrito à equipe da Locamania.');
    const required = meta<Permission[]>(this.reflector, PERMISSIONS_KEY, context) ?? [];
    const missing = required.filter((p) => !principal.permissions.has(p));
    if (missing.length > 0) throw new ForbiddenError('Seu perfil não tem permissão para esta ação.', 'MISSING_PERMISSION');
    const anyOf = meta<Permission[]>(this.reflector, ANY_PERMISSIONS_KEY, context) ?? [];
    if (anyOf.length > 0 && !anyOf.some((p) => principal.permissions.has(p))) {
      throw new ForbiddenError('Seu perfil não tem permissão para esta ação.', 'MISSING_PERMISSION');
    }
    return true;
  }
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * 3º guard global: freio por IP nas rotas marcadas com @RateLimit().
 * Em memória (instância única no Render free); com mais instâncias, Redis.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const opts = meta<RateLimitOptions>(this.reflector, RATE_LIMIT_KEY, context);
    if (!opts) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const key = `${opts.bucket}:${req.ip ?? 'unknown'}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      if (this.buckets.size > 5000) this.sweep(now);
      return true;
    }
    bucket.count += 1;
    if (bucket.count > opts.max) {
      throw new HttpException(
        'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private sweep(now: number): void {
    for (const [key, bucket] of this.buckets) if (now > bucket.resetAt) this.buckets.delete(key);
  }
}
