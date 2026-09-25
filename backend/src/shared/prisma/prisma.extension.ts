import { Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import type { AuditAction } from '@locamania/shared';
import type { ClsService } from 'nestjs-cls';

import { CLS_KEYS, type AppClsStore } from '../cls/cls-store';
import { buildChanges, extractEntityId, UNAUDITED_MODELS, WRITE_OPERATION_TO_ACTION } from './audit.util';

const logger = new Logger('AuditExtension');

/** Lê do CLS sem quebrar fora de uma requisição (jobs, seed). */
function safeGet<K extends keyof AppClsStore>(cls: ClsService<AppClsStore>, key: K): AppClsStore[K] | undefined {
  try {
    return cls.isActive() ? cls.get(key) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extensão do Prisma Client que audita TODA escrita (create/update/delete)
 * automaticamente, gravando um registro imutável em AuditLog (§6, §30).
 *
 * - Autor/IP/user-agent/correlationId vêm do contexto da requisição (nestjs-cls);
 *   fora de requisição (jobs), o autor é o SISTEMA.
 * - Grava via `base` (client não estendido) para não auditar a auditoria.
 * - `update` com `deletedAt` vira DELETE (arquivamento); com `status`, STATUS_CHANGE.
 * - Falha de auditoria nunca quebra a operação de negócio: loga e segue.
 */
export function createAuditExtension(base: PrismaClient, cls: ClsService<AppClsStore>) {
  return Prisma.defineExtension({
    name: 'locamania-audit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);

          let action: AuditAction | undefined = WRITE_OPERATION_TO_ACTION[operation];
          if (!action || UNAUDITED_MODELS.has(model)) return result;

          const data = (args as { data?: { deletedAt?: unknown; status?: unknown } }).data;
          if ((operation === 'update' || operation === 'updateMany') && data) {
            if (data.deletedAt != null) action = 'DELETE';
            else if (data.status != null) action = 'STATUS_CHANGE';
          }

          try {
            const actorType = safeGet(cls, CLS_KEYS.actorType) ?? 'SYSTEM';
            await base.auditLog.create({
              data: {
                action,
                entityType: model,
                entityId: extractEntityId(result, args),
                changes: buildChanges(operation, args, result) as Prisma.InputJsonValue,
                actorType,
                actorId: safeGet(cls, CLS_KEYS.actorId),
                actorName: safeGet(cls, CLS_KEYS.actorName) ?? (actorType === 'SYSTEM' ? 'Sistema' : undefined),
                metadata: {
                  ip: safeGet(cls, CLS_KEYS.ip) ?? null,
                  userAgent: safeGet(cls, CLS_KEYS.userAgent) ?? null,
                } as Prisma.InputJsonValue,
                correlationId: safeGet(cls, CLS_KEYS.correlationId),
              },
            });
          } catch (err) {
            logger.error(
              `Falha ao auditar ${operation} em ${model}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
          return result;
        },
      },
    },
  });
}
