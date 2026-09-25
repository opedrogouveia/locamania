import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  addDays,
  CHARGE_DISPLAY_STATUSES,
  onlyDigits,
  toCents,
  type ChargeDisplayStatus,
  type ChargeRules,
  type ChargeStatus,
  type Ymd,
} from '@locamania/shared';

import { dbDate, money, ymd } from '../../../shared/http/mappers';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { chargeNumber } from '../../contracts/domain/contract-rules';
import type { ChargeFilters, ChargeRecord, ChargesRepository, DelinquentRow } from '../domain/charges.ports';

const INCLUDE = {
  customer: { select: { id: true, name: true, email: true, phone: true, whatsapp: true, cpf: true } },
  contract: { select: { id: true, number: true } },
  motorcycle: { select: { id: true, plate: true } },
} satisfies Prisma.ChargeInclude;

type Row = Prisma.ChargeGetPayload<{ include: typeof INCLUDE }>;

/**
 * Situação exibida → filtro no banco. "Em atraso" inclui o pendente que passou
 * da tolerância e ainda não foi marcado pelo job (a lista não mente).
 */
export function displayStatusWhere(status: ChargeDisplayStatus, today: Ymd, rules: Pick<ChargeRules, 'graceDays' | 'dueSoonDays'>): Prisma.ChargeWhereInput {
  const overdueLimit = dbDate(addDays(today, -rules.graceDays));
  const soonLimit = dbDate(addDays(today, rules.dueSoonDays));
  switch (status) {
    case 'PAID':
      return { status: 'PAID' };
    case 'CANCELLED':
      return { status: 'CANCELLED' };
    case 'OVERDUE':
      return { OR: [{ status: 'OVERDUE' }, { status: 'PENDING', dueDate: { lt: overdueLimit } }] };
    case 'DUE_SOON':
      return { status: 'PENDING', dueDate: { gte: overdueLimit, lte: soonLimit } };
    case 'UPCOMING':
      return { status: 'PENDING', dueDate: { gt: soonLimit } };
  }
}

@Injectable()
export class PrismaChargesRepository implements ChargesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private baseWhere(f: Omit<ChargeFilters, 'status'>): Prisma.ChargeWhereInput {
    const digits = f.search ? onlyDigits(f.search) : '';
    return {
      ...(f.kind ? { kind: f.kind } : {}),
      ...(f.customerId ? { customerId: f.customerId } : {}),
      ...(f.contractId ? { contractId: f.contractId } : {}),
      ...(f.motorcycleId ? { motorcycleId: f.motorcycleId } : {}),
      ...(f.dueFrom || f.dueTo
        ? { dueDate: { ...(f.dueFrom ? { gte: dbDate(f.dueFrom) } : {}), ...(f.dueTo ? { lte: dbDate(f.dueTo) } : {}) } }
        : {}),
      ...(f.paidFrom || f.paidTo
        ? {
            paidAt: {
              ...(f.paidFrom ? { gte: new Date(`${f.paidFrom}T00:00:00-03:00`) } : {}),
              ...(f.paidTo ? { lt: new Date(`${addDays(f.paidTo, 1)}T00:00:00-03:00`) } : {}),
            },
          }
        : {}),
      ...(f.search
        ? {
            OR: [
              { number: { contains: f.search.toUpperCase() } },
              { customer: { name: { contains: f.search, mode: 'insensitive' } } },
              ...(digits.length >= 3 ? [{ customer: { cpf: { contains: digits } } }] : []),
              { contract: { number: { contains: f.search.toUpperCase() } } },
            ],
          }
        : {}),
    };
  }

  private async toRecords(rows: Row[]): Promise<ChargeRecord[]> {
    const userIds = [...new Set(rows.map((r) => r.registeredById).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.prisma.raw.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      kind: r.kind,
      sequence: r.sequence,
      description: r.description,
      customer: r.customer,
      contract: r.contract,
      motorcycle: r.motorcycle,
      occurrenceId: r.occurrenceId,
      periodStart: ymd(r.periodStart),
      periodEnd: ymd(r.periodEnd),
      dueDate: ymd(r.dueDate),
      amount: money(r.amount),
      status: r.status,
      paidAt: r.paidAt,
      paidAmount: money(r.paidAmount),
      fineAmount: money(r.fineAmount),
      interestAmount: money(r.interestAmount),
      discountAmount: money(r.discountAmount),
      method: r.method,
      notes: r.notes,
      receiptDocumentId: r.receiptDocumentId,
      registeredByName: r.registeredById ? (names.get(r.registeredById) ?? null) : null,
      cancelReason: r.cancelReason,
      gatewayProvider: r.gatewayProvider,
      gatewayChargeId: r.gatewayChargeId,
      gatewayPixCode: r.gatewayPixCode,
      gatewayExpiresAt: r.gatewayExpiresAt,
      gatewayPaidAt: r.gatewayPaidAt,
      createdAt: r.createdAt,
    }));
  }

  async list(filters: ChargeFilters, today: Ymd, rules: ChargeRules, page: { skip: number; take: number }) {
    const where: Prisma.ChargeWhereInput = {
      AND: [this.baseWhere(filters), ...(filters.status ? [displayStatusWhere(filters.status, today, rules)] : [])],
    };
    // Pagos: mais recentes primeiro. Em aberto: o que vence antes primeiro.
    const orderBy: Prisma.ChargeOrderByWithRelationInput[] =
      filters.status === 'PAID' ? [{ paidAt: 'desc' }] : filters.status === 'OVERDUE' ? [{ dueDate: 'asc' }] : [{ dueDate: 'asc' }, { seq: 'asc' }];
    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.charge.findMany({ where, include: INCLUDE, orderBy, skip: page.skip, take: page.take }),
      this.prisma.client.charge.count({ where }),
    ]);
    return { items: await this.toRecords(rows), total };
  }

  async summary(filters: Omit<ChargeFilters, 'status'>, today: Ymd, rules: ChargeRules) {
    const base = this.baseWhere(filters);
    const out = {} as Record<ChargeDisplayStatus, { count: number; cents: number }>;
    await Promise.all(
      CHARGE_DISPLAY_STATUSES.map(async (status) => {
        const agg = await this.prisma.raw.charge.aggregate({
          where: { AND: [base, displayStatusWhere(status, today, rules)] },
          _count: { _all: true },
          _sum: { amount: true, paidAmount: true },
        });
        const sum = status === 'PAID' ? agg._sum.paidAmount : agg._sum.amount;
        out[status] = { count: agg._count._all, cents: toCents(sum?.toFixed(2) ?? '0') };
      }),
    );
    return out;
  }

  async findById(id: string): Promise<ChargeRecord | null> {
    const r = await this.prisma.client.charge.findUnique({ where: { id }, include: INCLUDE });
    return r ? (await this.toRecords([r]))[0]! : null;
  }

  async findByGatewayId(gatewayChargeId: string): Promise<ChargeRecord | null> {
    const r = await this.prisma.client.charge.findUnique({ where: { gatewayChargeId }, include: INCLUDE });
    return r ? (await this.toRecords([r]))[0]! : null;
  }

  async create(data: Parameters<ChargesRepository['create']>[0]): Promise<ChargeRecord> {
    const id = await this.prisma.client.$transaction(async (tx) => {
      const [{ v }] = await tx.$queryRaw<{ v: bigint }[]>`SELECT nextval('"Charge_seq_seq"') AS v`;
      const seq = Number(v);
      const c = await tx.charge.create({
        data: {
          seq,
          number: chargeNumber(seq),
          customerId: data.customerId,
          contractId: data.contractId,
          motorcycleId: data.motorcycleId,
          occurrenceId: data.occurrenceId ?? null,
          kind: data.kind,
          description: data.description,
          dueDate: dbDate(data.dueDate),
          amount: data.amount,
        },
      });
      return c.id;
    });
    return (await this.findById(id))!;
  }

  async markPaid(id: string, data: Parameters<ChargesRepository['markPaid']>[1]): Promise<void> {
    await this.prisma.client.charge.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: data.paidAt,
        paidAmount: data.paidAmount,
        fineAmount: data.fineAmount,
        interestAmount: data.interestAmount,
        discountAmount: data.discountAmount,
        method: data.method,
        notes: data.notes,
        receiptDocumentId: data.receiptDocumentId,
        registeredById: data.registeredById,
        ...(data.gatewayPaidAt ? { gatewayPaidAt: data.gatewayPaidAt } : {}),
      },
    });
  }

  async reverse(id: string, status: ChargeStatus, note: string): Promise<void> {
    await this.prisma.client.charge.update({
      where: { id },
      data: {
        status,
        paidAt: null,
        paidAmount: null,
        fineAmount: null,
        interestAmount: null,
        discountAmount: null,
        method: null,
        registeredById: null,
        gatewayPaidAt: null,
        notes: note,
      },
    });
  }

  async cancel(id: string, reason: string): Promise<void> {
    await this.prisma.client.charge.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: reason } });
  }

  async setGateway(id: string, data: { provider: string; gatewayChargeId: string; pixCode: string; expiresAt: Date }): Promise<void> {
    // Dado técnico do gateway: sem entrada no histórico.
    await this.prisma.raw.charge.update({
      where: { id },
      data: { gatewayProvider: data.provider, gatewayChargeId: data.gatewayChargeId, gatewayPixCode: data.pixCode, gatewayExpiresAt: data.expiresAt },
    });
  }

  async delinquents(today: Ymd, graceDays: number): Promise<DelinquentRow[]> {
    const rows = await this.prisma.raw.charge.findMany({
      where: displayStatusWhere('OVERDUE', today, { graceDays, dueSoonDays: 0 }),
      select: { customerId: true, amount: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    });
    const map = new Map<string, DelinquentRow>();
    for (const r of rows) {
      if (!map.has(r.customerId)) map.set(r.customerId, { customerId: r.customerId, charges: [] });
      map.get(r.customerId)!.charges.push({ amount: r.amount.toFixed(2), dueDate: ymd(r.dueDate) });
    }
    return [...map.values()];
  }

  async customersInfo(ids: string[]) {
    const rows = await this.prisma.raw.customer.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, name: true, phone: true, whatsapp: true, status: true, inCollection: true,
        contracts: {
          where: { status: 'ACTIVE', deletedAt: null },
          select: { motorcycle: { select: { id: true, plate: true, brandCode: true, modelCode: true } } },
          take: 1,
        },
      },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        { name: r.name, phone: r.phone, whatsapp: r.whatsapp, status: r.status, inCollection: r.inCollection, motorcycle: r.contracts[0]?.motorcycle ?? null },
      ]),
    );
  }

  async recordGatewayEvent(e: { provider: string; eventId: string; type: string; payload: unknown; signatureValid: boolean; chargeId: string | null }) {
    const existing = await this.prisma.raw.gatewayEvent.findUnique({ where: { eventId: e.eventId } });
    if (existing) return { id: existing.id, isNew: false };
    try {
      const created = await this.prisma.raw.gatewayEvent.create({
        data: { ...e, payload: e.payload as Prisma.InputJsonValue },
      });
      return { id: created.id, isNew: true };
    } catch {
      // Dois webhooks iguais ao mesmo tempo: o segundo perde na unicidade.
      const again = await this.prisma.raw.gatewayEvent.findUnique({ where: { eventId: e.eventId } });
      return { id: again!.id, isNew: false };
    }
  }

  async finishGatewayEvent(id: string, error: string | null): Promise<void> {
    await this.prisma.raw.gatewayEvent.update({ where: { id }, data: { processedAt: new Date(), error } });
  }

  async markOverdue(today: Ymd, graceDays: number) {
    const rows = await this.prisma.raw.charge.findMany({
      where: { status: 'PENDING', dueDate: { lt: dbDate(addDays(today, -graceDays)) } },
      select: { id: true, customerId: true, number: true, amount: true, dueDate: true, description: true },
    });
    if (rows.length) {
      // Pelo client auditado: cada cobrança que virou "em atraso" aparece no histórico.
      await this.prisma.client.charge.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: 'OVERDUE' } });
    }
    return rows.map((r) => ({ ...r, amount: r.amount.toFixed(2), dueDate: ymd(r.dueDate) }));
  }

  async openForReminders(from: Ymd, to: Ymd) {
    const rows = await this.prisma.raw.charge.findMany({
      where: { status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { gte: dbDate(from), lte: dbDate(to) } },
      select: { id: true, customerId: true, number: true, amount: true, dueDate: true, status: true, description: true },
    });
    return rows.map((r) => ({ ...r, amount: r.amount.toFixed(2), dueDate: ymd(r.dueDate) }));
  }
}
