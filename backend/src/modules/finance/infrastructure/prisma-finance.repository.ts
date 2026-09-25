import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { addDays, toCents, type Ymd } from '@locamania/shared';

import { dbDate, money, ymd } from '../../../shared/http/mappers';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { EntryRecord, EntryWrite, FinanceRepository, PeriodFacts } from '../domain/finance.ports';

const INCLUDE = {
  motorcycle: { select: { id: true, plate: true } },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.FinancialEntryInclude;

type Row = Prisma.FinancialEntryGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class PrismaFinanceRepository implements FinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async toRecords(rows: Row[]): Promise<EntryRecord[]> {
    const users = await this.prisma.raw.user.findMany({
      where: { id: { in: rows.map((r) => r.createdById).filter(Boolean) as string[] } },
      select: { id: true, name: true },
    });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      categoryCode: r.categoryCode,
      description: r.description,
      amount: money(r.amount),
      date: ymd(r.date),
      motorcycle: r.motorcycle,
      customer: r.customer,
      supplier: r.supplier,
      method: r.method,
      createdByName: r.createdById ? (names.get(r.createdById) ?? null) : null,
      createdAt: r.createdAt,
    }));
  }

  async list(f: Parameters<FinanceRepository['list']>[0]) {
    const where: Prisma.FinancialEntryWhereInput = {
      deletedAt: null,
      ...(f.type ? { type: f.type } : {}),
      ...(f.categoryCode ? { categoryCode: f.categoryCode } : {}),
      ...(f.motorcycleId ? { motorcycleId: f.motorcycleId } : {}),
      ...(f.from || f.to ? { date: { ...(f.from ? { gte: dbDate(f.from) } : {}), ...(f.to ? { lte: dbDate(f.to) } : {}) } } : {}),
      ...(f.search ? { OR: [{ description: { contains: f.search, mode: 'insensitive' } }, { supplier: { contains: f.search, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.financialEntry.findMany({ where, include: INCLUDE, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], skip: f.skip, take: f.take }),
      this.prisma.client.financialEntry.count({ where }),
    ]);
    return { items: await this.toRecords(rows), total };
  }

  async findById(id: string): Promise<EntryRecord | null> {
    const r = await this.prisma.client.financialEntry.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
    return r ? (await this.toRecords([r]))[0]! : null;
  }

  async create(data: Parameters<FinanceRepository['create']>[0], userId: string): Promise<string> {
    const r = await this.prisma.client.financialEntry.create({
      data: {
        type: data.type,
        categoryCode: data.categoryCode,
        description: data.description,
        amount: data.amount,
        date: dbDate(data.date),
        motorcycleId: data.motorcycleId ?? null,
        customerId: data.customerId ?? null,
        supplier: data.supplier ?? null,
        method: data.method ?? null,
        createdById: userId,
      },
    });
    return r.id;
  }

  async update(id: string, data: EntryWrite): Promise<void> {
    const { date, ...rest } = data;
    await this.prisma.client.financialEntry.update({ where: { id }, data: { ...rest, ...(date ? { date: dbDate(date) } : {}) } });
  }

  async archive(id: string): Promise<void> {
    await this.prisma.client.financialEntry.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async periodFacts(from: Ymd, to: Ymd, today: Ymd, graceDays: number): Promise<PeriodFacts> {
    const db = this.prisma.raw;
    const start = new Date(`${from}T00:00:00-03:00`);
    const end = new Date(`${addDays(to, 1)}T00:00:00-03:00`);
    const overdueLimit = dbDate(addDays(today, -graceDays));
    const [paid, records, entries, pending, overdue] = await Promise.all([
      db.charge.findMany({
        where: { status: 'PAID', paidAt: { gte: start, lt: end } },
        select: { paidAt: true, paidAmount: true, amount: true, motorcycleId: true, customerId: true, kind: true, customer: { select: { name: true } } },
      }),
      db.maintenanceRecord.findMany({
        where: { status: 'DONE', deletedAt: null, completedAt: { gte: dbDate(from), lte: dbDate(to) }, cost: { not: null } },
        select: { completedAt: true, cost: true, motorcycleId: true },
      }),
      db.financialEntry.findMany({
        where: { deletedAt: null, date: { gte: dbDate(from), lte: dbDate(to) } },
        select: { date: true, amount: true, type: true, categoryCode: true, motorcycleId: true },
      }),
      db.charge.aggregate({
        where: { status: 'PENDING', dueDate: { gte: overdueLimit, lte: dbDate(to) }, AND: [{ dueDate: { gte: dbDate(from) } }] },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      db.charge.groupBy({
        by: ['customerId'],
        where: { OR: [{ status: 'OVERDUE' }, { status: 'PENDING', dueDate: { lt: overdueLimit } }] },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    const motoIds = [...new Set([...paid.map((p) => p.motorcycleId), ...records.map((r) => r.motorcycleId), ...entries.map((e) => e.motorcycleId)].filter(Boolean))] as string[];
    const motos = await db.motorcycle.findMany({ where: { id: { in: motoIds } }, select: { id: true, plate: true, brandCode: true, modelCode: true } });
    return {
      payments: paid.map((p) => ({
        paidAt: p.paidAt!,
        cents: toCents((p.paidAmount ?? p.amount).toFixed(2)),
        motorcycleId: p.motorcycleId,
        customerId: p.customerId,
        customerName: p.customer.name,
        kind: p.kind,
      })),
      maintenance: records.map((r) => ({ date: ymd(r.completedAt!), cents: toCents(r.cost!.toFixed(2)), motorcycleId: r.motorcycleId })),
      entries: entries.map((e) => ({ date: ymd(e.date), cents: toCents(e.amount.toFixed(2)), type: e.type, categoryCode: e.categoryCode, motorcycleId: e.motorcycleId })),
      pending: { count: pending._count._all, cents: toCents(pending._sum.amount?.toFixed(2) ?? '0') },
      overdue: {
        count: overdue.reduce((a, o) => a + o._count._all, 0),
        cents: overdue.reduce((a, o) => a + toCents(o._sum.amount?.toFixed(2) ?? '0'), 0),
        byCustomer: overdue.map((o) => ({ customerId: o.customerId, cents: toCents(o._sum.amount?.toFixed(2) ?? '0') })),
      },
      motorcycles: new Map(motos.map((m) => [m.id, { plate: m.plate, brandCode: m.brandCode, modelCode: m.modelCode }])),
    };
  }
}
