import { Injectable } from '@nestjs/common';
import type { SupportMessageStatus } from '@locamania/shared';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { CommunicationRepository, SupportRow } from '../application/communication.service';

@Injectable()
export class PrismaCommunicationRepository implements CommunicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async userNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))] as string[];
    if (!unique.length) return new Map();
    const users = await this.prisma.raw.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u.name]));
  }

  async announcements(skip: number, take: number) {
    const [rows, total] = await this.prisma.raw.$transaction([
      this.prisma.raw.announcement.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.raw.announcement.count(),
    ]);
    const names = await this.userNames(rows.map((r) => r.createdById));
    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        audience: r.audience,
        recipientsCount: r.recipientsCount,
        createdByName: r.createdById ? (names.get(r.createdById) ?? null) : null,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  async createAnnouncement(data: { title: string; body: string; audience: 'ALL_ACTIVE' | 'SELECTED'; recipientsCount: number; createdById: string }): Promise<string> {
    return (await this.prisma.client.announcement.create({ data })).id;
  }

  async activeCustomerIds(): Promise<string[]> {
    const rows = await this.prisma.raw.customer.findMany({
      where: { deletedAt: null, contracts: { some: { status: 'ACTIVE', deletedAt: null } } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private async toRows(rows: { id: string; customer: { id: string; name: string }; subject: string; body: string; status: SupportMessageStatus; answer: string | null; answeredById: string | null; answeredAt: Date | null; createdAt: Date }[]): Promise<SupportRow[]> {
    const names = await this.userNames(rows.map((r) => r.answeredById));
    return rows.map((r) => ({ ...r, answeredByName: r.answeredById ? (names.get(r.answeredById) ?? null) : null }));
  }

  async support(f: { status?: SupportMessageStatus; customerId?: string; skip: number; take: number }) {
    const where = { ...(f.status ? { status: f.status } : {}), ...(f.customerId ? { customerId: f.customerId } : {}) };
    const [rows, total] = await this.prisma.raw.$transaction([
      this.prisma.raw.supportMessage.findMany({
        where,
        include: { customer: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: f.skip,
        take: f.take,
      }),
      this.prisma.raw.supportMessage.count({ where }),
    ]);
    return { items: await this.toRows(rows), total };
  }

  async findSupport(id: string): Promise<SupportRow | null> {
    const r = await this.prisma.raw.supportMessage.findUnique({ where: { id }, include: { customer: { select: { id: true, name: true } } } });
    return r ? (await this.toRows([r]))[0]! : null;
  }

  async createSupport(customerId: string, subject: string, body: string): Promise<string> {
    return (await this.prisma.client.supportMessage.create({ data: { customerId, subject, body } })).id;
  }

  async answerSupport(id: string, answer: string, close: boolean, userId: string): Promise<void> {
    await this.prisma.client.supportMessage.update({
      where: { id },
      data: { answer, answeredById: userId, answeredAt: new Date(), status: close ? 'CLOSED' : 'ANSWERED' },
    });
  }

  async closeSupport(id: string): Promise<void> {
    await this.prisma.client.supportMessage.update({ where: { id }, data: { status: 'CLOSED' } });
  }
}
