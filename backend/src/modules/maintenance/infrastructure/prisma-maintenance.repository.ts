import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { toCents, type MaintenanceStatus, type MotorcycleStatus, type Ymd } from '@locamania/shared';

import { dbDate, money, ymd } from '../../../shared/http/mappers';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { MaintenanceRepository, PlanRecord, RecordRow, RecordWrite } from '../domain/maintenance.ports';

const RECORD_INCLUDE = {
  motorcycle: { select: { id: true, plate: true, brandCode: true, modelCode: true, status: true, currentKm: true } },
  types: { select: { type: { select: { id: true, name: true } } } },
} satisfies Prisma.MaintenanceRecordInclude;

type RecordDb = Prisma.MaintenanceRecordGetPayload<{ include: typeof RECORD_INCLUDE }>;

@Injectable()
export class PrismaMaintenanceRepository implements MaintenanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async plans(filter: { motorcycleId?: string; activeOnly?: boolean; motorcycleIds?: string[] }): Promise<PlanRecord[]> {
    const rows = await this.prisma.raw.maintenancePlan.findMany({
      where: {
        ...(filter.motorcycleId ? { motorcycleId: filter.motorcycleId } : {}),
        ...(filter.motorcycleIds ? { motorcycleId: { in: filter.motorcycleIds } } : {}),
        ...(filter.activeOnly ? { active: true, type: { active: true } } : {}),
        motorcycle: { deletedAt: null, status: { not: 'INACTIVE' } },
      },
      include: {
        motorcycle: {
          select: {
            id: true, plate: true, brandCode: true, modelCode: true, currentKm: true, status: true,
            contracts: { where: { status: 'ACTIVE', deletedAt: null }, select: { customer: { select: { id: true, name: true } } }, take: 1 },
          },
        },
        type: { select: { id: true, name: true, sortOrder: true } },
      },
      orderBy: [{ motorcycle: { plate: 'asc' } }, { type: { sortOrder: 'asc' } }],
    });
    return rows.map((r) => ({
      id: r.id,
      motorcycle: { id: r.motorcycle.id, plate: r.motorcycle.plate, brandCode: r.motorcycle.brandCode, modelCode: r.motorcycle.modelCode, currentKm: r.motorcycle.currentKm, status: r.motorcycle.status },
      type: { id: r.type.id, name: r.type.name },
      intervalKm: r.intervalKm,
      intervalDays: r.intervalDays,
      lastDoneKm: r.lastDoneKm,
      lastDoneAt: ymd(r.lastDoneAt),
      nextDueKm: r.nextDueKm,
      nextDueDate: ymd(r.nextDueDate),
      active: r.active,
      renter: r.motorcycle.contracts[0]?.customer ?? null,
    }));
  }

  async upsertPlan(motorcycleId: string, typeId: string, data: Parameters<MaintenanceRepository['upsertPlan']>[2]): Promise<void> {
    const values = { ...data, lastDoneAt: dbDate(data.lastDoneAt), nextDueDate: dbDate(data.nextDueDate) };
    await this.prisma.client.maintenancePlan.upsert({
      where: { motorcycleId_typeId: { motorcycleId, typeId } },
      create: { motorcycleId, typeId, ...values },
      update: values,
    });
  }

  typeById(id: string) {
    return this.prisma.raw.maintenanceType.findUnique({ where: { id }, select: { id: true, name: true, defaultIntervalKm: true, defaultIntervalDays: true } });
  }

  private async toRows(rows: RecordDb[]): Promise<RecordRow[]> {
    const ids = rows.map((r) => r.id);
    const [docs, users] = await Promise.all([
      ids.length
        ? this.prisma.raw.document.groupBy({ by: ['ownerId'], where: { ownerType: 'MAINTENANCE', ownerId: { in: ids }, deletedAt: null }, _count: { _all: true } })
        : Promise.resolve([]),
      this.prisma.raw.user.findMany({ where: { id: { in: rows.map((r) => r.createdById).filter(Boolean) as string[] } }, select: { id: true, name: true } }),
    ]);
    const docCount = new Map(docs.map((d) => [d.ownerId, d._count._all]));
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      motorcycle: r.motorcycle,
      status: r.status,
      types: r.types.map((t) => t.type),
      scheduledFor: ymd(r.scheduledFor),
      startedAt: ymd(r.startedAt),
      completedAt: ymd(r.completedAt),
      km: r.km,
      workshop: r.workshop,
      parts: r.parts,
      cost: money(r.cost),
      notes: r.notes,
      documentsCount: docCount.get(r.id) ?? 0,
      createdByName: r.createdById ? (names.get(r.createdById) ?? null) : null,
      createdAt: r.createdAt,
    }));
  }

  async records(filter: { status?: MaintenanceStatus[]; motorcycleId?: string; from?: Ymd; to?: Ymd; search?: string; skip: number; take: number }) {
    const plate = filter.search?.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const done = filter.status?.length === 1 && filter.status[0] === 'DONE';
    const where: Prisma.MaintenanceRecordWhereInput = {
      deletedAt: null,
      ...(filter.status ? { status: { in: filter.status } } : {}),
      ...(filter.motorcycleId ? { motorcycleId: filter.motorcycleId } : {}),
      ...(filter.from || filter.to
        ? { [done ? 'completedAt' : 'scheduledFor']: { ...(filter.from ? { gte: dbDate(filter.from) } : {}), ...(filter.to ? { lte: dbDate(filter.to) } : {}) } }
        : {}),
      ...(filter.search
        ? {
            OR: [
              ...(plate ? [{ motorcycle: { plate: { contains: plate } } }] : []),
              { workshop: { contains: filter.search, mode: 'insensitive' as const } },
              { types: { some: { type: { name: { contains: filter.search, mode: 'insensitive' as const } } } } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.MaintenanceRecordOrderByWithRelationInput[] = done
      ? [{ completedAt: 'desc' }, { createdAt: 'desc' }]
      : [{ scheduledFor: 'asc' }, { createdAt: 'desc' }];
    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.maintenanceRecord.findMany({ where, include: RECORD_INCLUDE, orderBy, skip: filter.skip, take: filter.take }),
      this.prisma.client.maintenanceRecord.count({ where }),
    ]);
    return { items: await this.toRows(rows), total };
  }

  async findRecord(id: string): Promise<RecordRow | null> {
    const r = await this.prisma.client.maintenanceRecord.findFirst({ where: { id, deletedAt: null }, include: RECORD_INCLUDE });
    return r ? (await this.toRows([r]))[0]! : null;
  }

  async createRecord(motorcycleId: string, data: RecordWrite & { typeIds: string[]; status: MaintenanceStatus }, userId: string): Promise<string> {
    const r = await this.prisma.client.maintenanceRecord.create({
      data: {
        motorcycleId,
        status: data.status,
        scheduledFor: dbDate(data.scheduledFor ?? null),
        startedAt: dbDate(data.startedAt ?? null),
        completedAt: dbDate(data.completedAt ?? null),
        km: data.km ?? null,
        workshop: data.workshop ?? null,
        parts: data.parts ?? null,
        cost: data.cost ?? null,
        notes: data.notes ?? null,
        createdById: userId,
        types: { create: data.typeIds.map((typeId) => ({ typeId })) },
      },
    });
    return r.id;
  }

  async updateRecord(id: string, data: RecordWrite): Promise<void> {
    const { typeIds, scheduledFor, startedAt, completedAt, ...rest } = data;
    await this.prisma.client.maintenanceRecord.update({
      where: { id },
      data: {
        ...rest,
        ...(scheduledFor !== undefined ? { scheduledFor: dbDate(scheduledFor) } : {}),
        ...(startedAt !== undefined ? { startedAt: dbDate(startedAt) } : {}),
        ...(completedAt !== undefined ? { completedAt: dbDate(completedAt) } : {}),
        ...(typeIds ? { types: { deleteMany: {}, create: typeIds.map((typeId) => ({ typeId })) } } : {}),
      },
    });
  }

  async complete(id: string, data: Parameters<MaintenanceRepository['complete']>[1]): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      const r = await tx.maintenanceRecord.update({
        where: { id },
        data: {
          status: 'DONE',
          completedAt: dbDate(data.completedAt),
          km: data.km,
          cost: data.cost,
          workshop: data.workshop,
          parts: data.parts,
          notes: data.notes,
        },
      });
      for (const p of data.plans) {
        await tx.maintenancePlan.update({
          where: { id: p.planId },
          data: { lastDoneKm: p.lastDoneKm, lastDoneAt: dbDate(p.lastDoneAt), nextDueKm: p.nextDueKm, nextDueDate: dbDate(p.nextDueDate) },
        });
      }
      await tx.odometerReading.create({ data: { motorcycleId: r.motorcycleId, km: data.km, source: 'MAINTENANCE', userId: data.userId, notes: 'Manutenção concluída' } });
      await tx.motorcycle.updateMany({ where: { id: r.motorcycleId, currentKm: { lt: data.km } }, data: { currentKm: data.km } });
      if (data.nextMotorcycleStatus) {
        await tx.motorcycle.update({
          where: { id: r.motorcycleId },
          data: {
            status: data.nextMotorcycleStatus,
            statusReason: null,
            availableSince: data.nextMotorcycleStatus === 'AVAILABLE' ? new Date() : null,
          },
        });
      }
    });
  }

  async setMotorcycleStatus(motorcycleId: string, status: MotorcycleStatus, reason: string | null): Promise<void> {
    await this.prisma.client.motorcycle.update({
      where: { id: motorcycleId },
      data: { status, statusReason: reason, availableSince: status === 'AVAILABLE' ? new Date() : null },
    });
  }

  async hasActiveContract(motorcycleId: string): Promise<boolean> {
    return (await this.prisma.raw.contract.count({ where: { motorcycleId, status: 'ACTIVE', deletedAt: null } })) > 0;
  }

  countOpenRecords(motorcycleId: string, exceptId?: string): Promise<number> {
    return this.prisma.raw.maintenanceRecord.count({
      where: { motorcycleId, status: 'IN_PROGRESS', deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
  }

  async summary(since: Ymd) {
    const [inProgress, scheduled, done] = await Promise.all([
      this.prisma.raw.maintenanceRecord.count({ where: { status: 'IN_PROGRESS', deletedAt: null } }),
      this.prisma.raw.maintenanceRecord.count({ where: { status: 'SCHEDULED', deletedAt: null } }),
      this.prisma.raw.maintenanceRecord.aggregate({
        where: { status: 'DONE', deletedAt: null, completedAt: { gte: dbDate(since) } },
        _count: { _all: true },
        _sum: { cost: true },
      }),
    ]);
    return { inProgress, scheduled, doneCount: done._count._all, doneCostCents: toCents(done._sum.cost?.toFixed(2) ?? '0') };
  }
}
