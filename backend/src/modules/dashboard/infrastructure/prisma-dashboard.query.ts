import { Injectable } from '@nestjs/common';
import { toCents, type Ymd } from '@locamania/shared';

import { dbDate, ymd } from '../../../shared/http/mappers';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { DashboardQuery } from '../application/dashboard.service';

const cents = (d: { toFixed(n: number): string } | null | undefined) => toCents(d?.toFixed(2) ?? '0');

@Injectable()
export class PrismaDashboardQuery implements DashboardQuery {
  constructor(private readonly prisma: PrismaService) {}

  async fleet() {
    const rows = await this.prisma.raw.motorcycle.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } });
    return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  }

  async customers(today: Ymd, graceDays: number) {
    const limit = dbDate(new Date(Date.parse(`${today}T00:00:00Z`) - graceDays * 86_400_000).toISOString().slice(0, 10));
    const db = this.prisma.raw;
    const [active, delinquent, inCollection, total] = await Promise.all([
      db.customer.count({ where: { deletedAt: null, contracts: { some: { status: 'ACTIVE', deletedAt: null } } } }),
      db.charge.findMany({
        where: { OR: [{ status: 'OVERDUE' }, { status: 'PENDING', dueDate: { lt: limit } }] },
        distinct: ['customerId'],
        select: { customerId: true },
      }),
      db.customer.count({ where: { deletedAt: null, inCollection: true } }),
      db.customer.count({ where: { deletedAt: null } }),
    ]);
    return { active, delinquent: delinquent.length, inCollection, total };
  }

  async dueBetween(from: Ymd, to: Ymd, graceLimit: Ymd) {
    const agg = await this.prisma.raw.charge.aggregate({
      where: { status: 'PENDING', dueDate: { gte: dbDate(from), lte: dbDate(to) }, AND: [{ dueDate: { gte: dbDate(graceLimit) } }] },
      _count: { _all: true },
      _sum: { amount: true },
    });
    return { count: agg._count._all, cents: cents(agg._sum.amount) };
  }

  async overdue(graceLimit: Ymd) {
    const agg = await this.prisma.raw.charge.aggregate({
      where: { OR: [{ status: 'OVERDUE' }, { status: 'PENDING', dueDate: { lt: dbDate(graceLimit) } }] },
      _count: { _all: true },
      _sum: { amount: true },
    });
    return { count: agg._count._all, cents: cents(agg._sum.amount) };
  }

  async receivedSince(since: Ymd) {
    const agg = await this.prisma.raw.charge.aggregate({
      where: { status: 'PAID', kind: { not: 'DEPOSIT' }, paidAt: { gte: new Date(`${since}T00:00:00-03:00`) } },
      _sum: { paidAmount: true },
    });
    return cents(agg._sum.paidAmount);
  }

  async overdueByCustomer(graceLimit: Ymd, take: number) {
    const rows = await this.prisma.raw.charge.groupBy({
      by: ['customerId'],
      where: { OR: [{ status: 'OVERDUE' }, { status: 'PENDING', dueDate: { lt: dbDate(graceLimit) } }] },
      _count: { _all: true },
      _sum: { amount: true },
      _min: { dueDate: true },
      orderBy: { _min: { dueDate: 'asc' } },
      take,
    });
    const names = await this.prisma.raw.customer.findMany({ where: { id: { in: rows.map((r) => r.customerId) } }, select: { id: true, name: true } });
    const map = new Map(names.map((n) => [n.id, n.name]));
    return rows.map((r) => ({ customerId: r.customerId, name: map.get(r.customerId) ?? '—', count: r._count._all, cents: cents(r._sum.amount), oldest: ymd(r._min.dueDate!) }));
  }

  async dueTodayList(today: Ymd, take: number) {
    const rows = await this.prisma.raw.charge.findMany({
      where: { status: 'PENDING', dueDate: dbDate(today) },
      select: { id: true, customerId: true, amount: true, customer: { select: { name: true } } },
      take,
    });
    return rows.map((r) => ({ id: r.id, customerId: r.customerId, name: r.customer.name, cents: cents(r.amount) }));
  }

  async dueTomorrowList(tomorrow: Ymd, take: number) {
    const rows = await this.prisma.raw.charge.findMany({
      where: { status: 'PENDING', dueDate: dbDate(tomorrow) },
      select: { customerId: true, amount: true, customer: { select: { name: true } } },
      take,
    });
    return rows.map((r) => ({ customerId: r.customerId, name: r.customer.name, cents: cents(r.amount) }));
  }

  async contractsEnding(until: Ymd) {
    const rows = await this.prisma.raw.contract.findMany({
      where: { status: 'ACTIVE', deletedAt: null, endDate: { lte: dbDate(until) } },
      select: { id: true, number: true, endDate: true, customer: { select: { name: true } }, motorcycle: { select: { plate: true } } },
      orderBy: { endDate: 'asc' },
      take: 20,
    });
    return rows.map((r) => ({ id: r.id, number: r.number, customerName: r.customer.name, endDate: ymd(r.endDate), plate: r.motorcycle.plate }));
  }

  async idleMotorcycles(before: Date) {
    const rows = await this.prisma.raw.motorcycle.findMany({
      where: { deletedAt: null, status: 'AVAILABLE', availableSince: { lte: before } },
      select: { id: true, plate: true, availableSince: true },
      orderBy: { availableSince: 'asc' },
      take: 10,
    });
    return rows.map((r) => ({ id: r.id, plate: r.plate, availableSince: r.availableSince! }));
  }

  async recentPayments(since: Date, take: number) {
    const rows = await this.prisma.raw.charge.findMany({
      where: { status: 'PAID', paidAt: { gte: since } },
      select: { id: true, customerId: true, paidAmount: true, paidAt: true, customer: { select: { name: true } } },
      orderBy: { paidAt: 'desc' },
      take,
    });
    return rows.map((r) => ({ id: r.id, customerId: r.customerId, name: r.customer.name, cents: cents(r.paidAmount), paidAt: r.paidAt! }));
  }

  async recentOccurrences(since: Ymd, take: number) {
    const rows = await this.prisma.raw.occurrence.findMany({
      where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] }, occurredAt: { gte: dbDate(since) } },
      select: { id: true, type: true, description: true, occurredAt: true, motorcycle: { select: { plate: true } } },
      orderBy: { occurredAt: 'desc' },
      take,
    });
    return rows.map((r) => ({ id: r.id, type: r.type, description: r.description, plate: r.motorcycle?.plate ?? null, occurredAt: ymd(r.occurredAt) }));
  }

  openSupport() {
    return this.prisma.raw.supportMessage.count({ where: { status: 'OPEN' } });
  }
}
