import type { ClsStore } from 'nestjs-cls';

/**
 * Contexto da requisição propagado via AsyncLocalStorage (nestjs-cls).
 * Lido pela extensão do Prisma para preencher o autor na auditoria e pelo
 * exception filter para correlacionar erros.
 */
export interface AppClsStore extends ClsStore {
  actorType?: 'USER' | 'CUSTOMER' | 'SYSTEM';
  actorId?: string;
  actorName?: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

/** Chaves do store, centralizadas para evitar strings soltas. */
export const CLS_KEYS = {
  actorType: 'actorType',
  actorId: 'actorId',
  actorName: 'actorName',
  ip: 'ip',
  userAgent: 'userAgent',
  correlationId: 'correlationId',
} as const;
