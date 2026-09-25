import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { addDays, formatPlate, ymdToDate } from '@locamania/shared';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { AuditListParams, AuditQuery, AuditRecord } from '../application/audit-history.service';

@Injectable()
export class PrismaAuditQuery implements AuditQuery {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: AuditListParams): Promise<{ items: AuditRecord[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.entityIds ? { entityId: { in: params.entityIds } } : {}),
      ...(params.action ? { action: params.action } : {}),
      ...(params.from || params.to
        ? {
            occurredAt: {
              ...(params.from ? { gte: ymdToDate(params.from) } : {}),
              ...(params.to ? { lt: ymdToDate(addDays(params.to, 1)) } : {}),
            },
          }
        : {}),
      ...(params.search ? { actorName: { contains: params.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await this.prisma.raw.$transaction([
      this.prisma.raw.auditLog.findMany({ where, orderBy: { occurredAt: 'desc' }, skip: params.skip, take: params.take }),
      this.prisma.raw.auditLog.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt,
        actorType: r.actorType,
        actorId: r.actorId,
        actorName: r.actorName,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        changes: r.changes,
        ip: ((r.metadata ?? {}) as { ip?: string | null }).ip ?? null,
      })),
      total,
    };
  }

  async resolveNames(refs: { entityType: string; entityId: string }[]): Promise<Map<string, string>> {
    const byType = new Map<string, Set<string>>();
    for (const r of refs) {
      if (!byType.has(r.entityType)) byType.set(r.entityType, new Set());
      byType.get(r.entityType)!.add(r.entityId);
    }
    const names = new Map<string, string>();
    const ids = (t: string) => [...(byType.get(t) ?? [])];
    const db = this.prisma.raw;

    const tasks: Promise<void>[] = [];
    if (byType.has('Customer'))
      tasks.push(db.customer.findMany({ where: { id: { in: ids('Customer') } }, select: { id: true, name: true } })
        .then((rows) => rows.forEach((r) => names.set(r.id, r.name))));
    if (byType.has('Motorcycle'))
      tasks.push(db.motorcycle.findMany({ where: { id: { in: ids('Motorcycle') } }, select: { id: true, plate: true } })
        .then((rows) => rows.forEach((r) => names.set(r.id, formatPlate(r.plate)))));
    if (byType.has('Contract'))
      tasks.push(db.contract.findMany({ where: { id: { in: ids('Contract') } }, select: { id: true, number: true } })
        .then((rows) => rows.forEach((r) => names.set(r.id, r.number))));
    if (byType.has('Charge'))
      tasks.push(db.charge.findMany({ where: { id: { in: ids('Charge') } }, select: { id: true, number: true } })
        .then((rows) => rows.forEach((r) => names.set(r.id, r.number))));
    if (byType.has('User'))
      tasks.push(db.user.findMany({ where: { id: { in: ids('User') } }, select: { id: true, name: true } })
        .then((rows) => rows.forEach((r) => names.set(r.id, r.name))));
    if (byType.has('MaintenanceRecord'))
      tasks.push(db.maintenanceRecord.findMany({ where: { id: { in: ids('MaintenanceRecord') } }, select: { id: true, motorcycle: { select: { plate: true } } } })
        .then((rows) => rows.forEach((r) => names.set(r.id, `da moto ${formatPlate(r.motorcycle.plate)}`))));
    if (byType.has('Document'))
      tasks.push(db.document.findMany({ where: { id: { in: ids('Document') } }, select: { id: true, title: true } })
        .then((rows) => rows.forEach((r) => names.set(r.id, `"${r.title}"`))));
    if (byType.has('Occurrence'))
      tasks.push(db.occurrence.findMany({ where: { id: { in: ids('Occurrence') } }, select: { id: true, motorcycle: { select: { plate: true } }, customer: { select: { name: true } } } })
        .then((rows) => rows.forEach((r) => names.set(r.id, r.motorcycle ? `da moto ${formatPlate(r.motorcycle.plate)}` : r.customer ? `de ${r.customer.name}` : ''))));
    if (byType.has('FinancialEntry'))
      tasks.push(db.financialEntry.findMany({ where: { id: { in: ids('FinancialEntry') } }, select: { id: true, description: true } })
        .then((rows) => rows.forEach((r) => names.set(r.id, `"${r.description}"`))));
    if (byType.has('AppParameter')) for (const id of ids('AppParameter')) names.set(id, id);
    if (byType.has('Report')) {
      const REPORTS: Record<string, string> = { fleet: 'o relatório da frota', customers: 'o relatório de clientes', finance: 'o relatório financeiro', maintenance: 'o relatório de manutenção', rentals: 'o relatório de aluguéis' };
      for (const id of ids('Report')) if (REPORTS[id]) names.set(id, REPORTS[id]);
    }
    await Promise.all(tasks);
    return names;
  }

  async relatedIds(entityType: string, entityId: string): Promise<{ entityType: string; ids: string[] }[]> {
    const db = this.prisma.raw;
    if (entityType === 'Customer') {
      const [contracts, charges, occurrences] = await Promise.all([
        db.contract.findMany({ where: { customerId: entityId }, select: { id: true } }),
        db.charge.findMany({ where: { customerId: entityId }, select: { id: true } }),
        db.occurrence.findMany({ where: { customerId: entityId }, select: { id: true } }),
      ]);
      return [
        { entityType: 'Contract', ids: contracts.map((c) => c.id) },
        { entityType: 'Charge', ids: charges.map((c) => c.id) },
        { entityType: 'Occurrence', ids: occurrences.map((c) => c.id) },
      ].filter((r) => r.ids.length > 0);
    }
    if (entityType === 'Motorcycle') {
      const [contracts, records, occurrences] = await Promise.all([
        db.contract.findMany({ where: { motorcycleId: entityId }, select: { id: true } }),
        db.maintenanceRecord.findMany({ where: { motorcycleId: entityId }, select: { id: true } }),
        db.occurrence.findMany({ where: { motorcycleId: entityId }, select: { id: true } }),
      ]);
      return [
        { entityType: 'Contract', ids: contracts.map((c) => c.id) },
        { entityType: 'MaintenanceRecord', ids: records.map((c) => c.id) },
        { entityType: 'Occurrence', ids: occurrences.map((c) => c.id) },
      ].filter((r) => r.ids.length > 0);
    }
    if (entityType === 'Contract') {
      const charges = await db.charge.findMany({ where: { contractId: entityId }, select: { id: true } });
      return charges.length ? [{ entityType: 'Charge', ids: charges.map((c) => c.id) }] : [];
    }
    return [];
  }
}
