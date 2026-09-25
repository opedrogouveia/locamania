import { Inject, Injectable } from '@nestjs/common';
import type { ActorType, AuditAction, AuditLogDto, PaginatedResponse, Ymd } from '@locamania/shared';

import { paginated, pageParams } from '../../../shared/http/pagination';
import { describeAudit } from '../domain/audit-describer';

export const AUDIT_QUERY = Symbol('AuditQuery');

export interface AuditRecord {
  id: string;
  occurredAt: Date;
  actorType: ActorType;
  actorId: string | null;
  actorName: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  changes: unknown;
  ip: string | null;
}

export interface AuditListParams {
  skip: number;
  take: number;
  actorId?: string;
  entityType?: string;
  entityIds?: string[];
  action?: AuditAction;
  from?: Ymd;
  to?: Ymd;
  search?: string;
}

/** Porta de leitura do histórico (implementação Prisma na infraestrutura). */
export interface AuditQuery {
  list(params: AuditListParams): Promise<{ items: AuditRecord[]; total: number }>;
  /** Nome legível de cada entidade (cliente → nome, moto → placa, contrato → número). */
  resolveNames(refs: { entityType: string; entityId: string }[]): Promise<Map<string, string>>;
  /** Ids relacionados a uma ficha (ex.: contratos e cobranças de um cliente). */
  relatedIds(entityType: string, entityId: string): Promise<{ entityType: string; ids: string[] }[]>;
}

@Injectable()
export class AuditHistoryService {
  constructor(@Inject(AUDIT_QUERY) private readonly query: AuditQuery) {}

  async list(input: {
    page?: number;
    pageSize?: number;
    actorId?: string;
    entityType?: string;
    entityId?: string;
    action?: AuditAction;
    from?: Ymd;
    to?: Ymd;
    search?: string;
  }): Promise<PaginatedResponse<AuditLogDto>> {
    const p = pageParams(input, 30);
    const { items, total } = await this.query.list({
      skip: p.skip,
      take: p.take,
      actorId: input.actorId,
      entityType: input.entityType,
      entityIds: input.entityId ? [input.entityId] : undefined,
      action: input.action,
      from: input.from,
      to: input.to,
      search: input.search,
    });
    return paginated(await this.describe(items), total, p);
  }

  /**
   * Linha do tempo de uma ficha: a própria entidade e o que pende dela (no
   * cliente, os contratos e as cobranças dele), numa lista só.
   */
  async timeline(entityType: string, entityId: string, page = 1, pageSize = 30): Promise<PaginatedResponse<AuditLogDto>> {
    const p = pageParams({ page, pageSize }, 30);
    const related = await this.query.relatedIds(entityType, entityId);
    const all = [{ entityType, ids: [entityId] }, ...related];
    const results = await Promise.all(
      all.map((r) => this.query.list({ skip: 0, take: p.skip + p.take, entityType: r.entityType, entityIds: r.ids })),
    );
    const merged = results
      .flatMap((r) => r.items)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    const total = results.reduce((acc, r) => acc + r.total, 0);
    return paginated(await this.describe(merged.slice(p.skip, p.skip + p.take)), total, p);
  }

  private async describe(items: AuditRecord[]): Promise<AuditLogDto[]> {
    const names = await this.query.resolveNames(
      items.filter((i) => i.entityId).map((i) => ({ entityType: i.entityType, entityId: i.entityId! })),
    );
    return items.map((item) => {
      const { summary, changedFields } = describeAudit(item, item.entityId ? (names.get(item.entityId) ?? null) : null);
      return {
        id: item.id,
        occurredAt: item.occurredAt.toISOString(),
        actorType: item.actorType,
        actorId: item.actorId,
        actorName: item.actorName,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        summary,
        changedFields,
        ip: item.ip,
      };
    });
  }
}
