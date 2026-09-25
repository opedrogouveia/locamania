import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import type { Observable } from 'rxjs';

import type { Principal } from '../auth/principal';
import { CLS_KEYS, type AppClsStore } from '../cls/cls-store';

/**
 * Copia o autor autenticado (req.user) para o contexto da requisição, de onde a
 * extensão do Prisma e o AuditService leem quem fez. Roda depois dos guards.
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService<AppClsStore>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const principal = context.switchToHttp().getRequest<Request>().user as Principal | undefined;
    if (principal) {
      this.cls.set(CLS_KEYS.actorType, principal.kind === 'staff' ? 'USER' : 'CUSTOMER');
      this.cls.set(CLS_KEYS.actorId, principal.id);
      this.cls.set(CLS_KEYS.actorName, principal.name);
    }
    return next.handle();
  }
}
