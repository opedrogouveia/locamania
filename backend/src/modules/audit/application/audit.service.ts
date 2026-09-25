import { Global, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditAction } from '@locamania/shared';
import { ClsService } from 'nestjs-cls';

import { CLS_KEYS, type AppClsStore } from '../../../shared/cls/cls-store';
import { jsonSafe, maskSecrets } from '../../../shared/prisma/audit.util';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export interface AuditEventInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, unknown>;
  /** Sobrescreve o autor (ex.: LOGIN, antes de o contexto existir). */
  actor?: { type: 'USER' | 'CUSTOMER' | 'SYSTEM'; id?: string | null; name?: string | null };
}

/**
 * Eventos que a extensão do Prisma não captura sozinha: LOGIN, LOGOUT, EXPORT,
 * COMMAND (rastreador). Escreve pelo client base para não recursar.
 */
@Global()
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  private ctx<K extends keyof AppClsStore>(key: K): AppClsStore[K] | undefined {
    try {
      return this.cls.isActive() ? this.cls.get(key) : undefined;
    } catch {
      return undefined;
    }
  }

  async record(event: AuditEventInput): Promise<void> {
    try {
      await this.prisma.raw.auditLog.create({
        data: {
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId ?? undefined,
          changes: event.changes ? (maskSecrets(jsonSafe(event.changes)) as Prisma.InputJsonValue) : undefined,
          actorType: event.actor?.type ?? this.ctx(CLS_KEYS.actorType) ?? 'SYSTEM',
          actorId: event.actor?.id ?? this.ctx(CLS_KEYS.actorId),
          actorName: event.actor?.name ?? this.ctx(CLS_KEYS.actorName) ?? 'Sistema',
          metadata: {
            ip: this.ctx(CLS_KEYS.ip) ?? null,
            userAgent: this.ctx(CLS_KEYS.userAgent) ?? null,
          } as Prisma.InputJsonValue,
          correlationId: this.ctx(CLS_KEYS.correlationId),
        },
      });
    } catch (err) {
      this.logger.error(
        `Falha ao registrar ${event.action}/${event.entityType}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
