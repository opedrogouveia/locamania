import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Ymd } from '@locamania/shared';

import { dbDate, money, ymd } from '../../../shared/http/mappers';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { OccurrenceRecord, OccurrencesRepository, OccurrenceWrite } from '../domain/occurrences.ports';

const INCLUDE = {
  motorcycle: { select: { id: true, plate: true, brandCode: true, modelCode: true } },
  customer: { select: { id: true, name: true } },
  contract: { select: { id: true, number: true } },
  charge: { select: { id: true, status: true } },
} satisfies Prisma.OccurrenceInclude;

type Row = Prisma.OccurrenceGetPayload<{ include: typeof INCLUDE }>;

function toData(d: OccurrenceWrite): Prisma.OccurrenceUncheckedUpdateInput {
  const { occurredAt, fineDueDate, ...rest } = d;
  return {
    ...rest,
    ...(occurredAt !== undefined ? { occurredAt: dbDate(occurredAt) } : {}),
    ...(fineDueDate !== undefined ? { fineDueDate: dbDate(fineDueDate) } : {}),
  };
}

@Injectable()
export class PrismaOccurrencesRepository implements OccurrencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async toRecords(rows: Row[]): Promise<OccurrenceRecord[]> {
    const ids = rows.map((r) => r.id);
    const [docs, users] = await Promise.all([
      ids.length
        ? this.prisma.raw.document.groupBy({ by: ['ownerId'], where: { ownerType: 'OCCURRENCE', ownerId: { in: ids }, deletedAt: null }, _count: { _all: true } })
        : Promise.resolve([]),
      this.prisma.raw.user.findMany({ where: { id: { in: rows.map((r) => r.createdById).filter(Boolean) as string[] } }, select: { id: true, name: true } }),
    ]);
    const count = new Map(docs.map((d) => [d.ownerId, d._count._all]));
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      occurredAt: ymd(r.occurredAt),
      motorcycle: r.motorcycle,
      customer: r.customer,
      contract: r.contract,
      description: r.description,
      amount: money(r.amount),
      fineNumber: r.fineNumber,
      fineDueDate: ymd(r.fineDueDate),
      charge: r.charge,
      notes: r.notes,
      documentsCount: count.get(r.id) ?? 0,
      createdByName: r.createdById ? (names.get(r.createdById) ?? null) : null,
      createdAt: r.createdAt,
    }));
  }

  async list(f: Parameters<OccurrencesRepository['list']>[0]) {
    const plate = f.search?.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const where: Prisma.OccurrenceWhereInput = {
      deletedAt: null,
      ...(f.type ? { type: f.type } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.motorcycleId ? { motorcycleId: f.motorcycleId } : {}),
      ...(f.customerId ? { customerId: f.customerId } : {}),
      ...(f.search
        ? {
            OR: [
              { description: { contains: f.search, mode: 'insensitive' } },
              { fineNumber: { contains: f.search, mode: 'insensitive' } },
              { customer: { name: { contains: f.search, mode: 'insensitive' } } },
              ...(plate ? [{ motorcycle: { plate: { contains: plate } } }] : []),
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.occurrence.findMany({ where, include: INCLUDE, orderBy: { occurredAt: 'desc' }, skip: f.skip, take: f.take }),
      this.prisma.client.occurrence.count({ where }),
    ]);
    return { items: await this.toRecords(rows), total };
  }

  async findById(id: string): Promise<OccurrenceRecord | null> {
    const r = await this.prisma.client.occurrence.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
    return r ? (await this.toRecords([r]))[0]! : null;
  }

  async create(data: OccurrenceWrite & { type: OccurrenceWrite['type']; occurredAt: Ymd; description: string }, userId: string): Promise<string> {
    const r = await this.prisma.client.occurrence.create({ data: { ...(toData(data) as Prisma.OccurrenceUncheckedCreateInput), createdById: userId } });
    return r.id;
  }

  async update(id: string, data: OccurrenceWrite): Promise<void> {
    await this.prisma.client.occurrence.update({ where: { id }, data: toData(data) });
  }

  async archive(id: string): Promise<void> {
    await this.prisma.client.occurrence.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async contractOn(motorcycleId: string, date: Ymd) {
    const d = dbDate(date);
    const c = await this.prisma.raw.contract.findFirst({
      where: {
        motorcycleId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'ENDED'] },
        startDate: { lte: d },
        OR: [{ status: 'ACTIVE' }, { returnInspection: { returnedAt: { gte: d } } }],
      },
      orderBy: { startDate: 'desc' },
      select: { id: true, customerId: true },
    });
    return c;
  }
}
