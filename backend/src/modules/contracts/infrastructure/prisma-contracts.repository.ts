import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { addDays, toCents, type ContractStatus, type Ymd } from '@locamania/shared';

import { dbDate, money, ymd } from '../../../shared/http/mappers';
import { PrismaService, type PrismaTx } from '../../../shared/prisma/prisma.service';
import { chargeNumber, contractNumber } from '../domain/contract-rules';
import type {
  ContractChargeStats,
  ContractRecord,
  ContractsRepository,
  ListContractsParams,
  NewChargeData,
} from '../domain/contracts.ports';

const INCLUDE = {
  customer: {
    select: {
      id: true, name: true, cpf: true, rg: true, phone: true, whatsapp: true, email: true, street: true, streetNumber: true,
      complement: true, district: true, city: true, state: true, postalCode: true, cnhNumber: true, cnhCategory: true,
      cnhExpiresAt: true, portalEnabled: true,
    },
  },
  motorcycle: {
    select: {
      id: true, plate: true, brandCode: true, modelCode: true, manufactureYear: true, modelYear: true, color: true,
      renavam: true, chassis: true, currentKm: true, status: true,
    },
  },
  returnInspection: true,
} satisfies Prisma.ContractInclude;

type Row = Prisma.ContractGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class PrismaContractsRepository implements ContractsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async names(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))] as string[];
    if (!unique.length) return new Map();
    const users = await this.prisma.raw.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u.name]));
  }

  private toRecord(r: Row, names: Map<string, string>): ContractRecord {
    const ri = r.returnInspection;
    return {
      id: r.id,
      number: r.number,
      status: r.status,
      customer: { ...r.customer, cnhExpiresAt: ymd(r.customer.cnhExpiresAt) },
      motorcycle: r.motorcycle,
      startDate: ymd(r.startDate),
      endDate: ymd(r.endDate),
      firstDueDate: ymd(r.firstDueDate),
      periodicity: r.periodicity,
      rentAmount: money(r.rentAmount),
      depositAmount: money(r.depositAmount),
      initialKm: r.initialKm,
      rules: r.rules,
      notes: r.notes,
      renderedText: r.renderedText,
      documentHash: r.documentHash,
      signatureStatus: r.signatureStatus,
      signatureMethod: r.signatureMethod,
      signedAt: r.signedAt,
      signatureIp: r.signatureIp,
      sentAt: r.sentAt,
      deliveredAt: r.deliveredAt,
      endedAt: r.endedAt,
      cancelledAt: r.cancelledAt,
      cancelReason: r.cancelReason,
      createdByName: r.createdById ? (names.get(r.createdById) ?? null) : null,
      returnInspection: ri
        ? {
            id: ri.id,
            returnedAt: ymd(ri.returnedAt),
            finalKm: ri.finalKm,
            condition: ri.condition,
            fuelLevel: ri.fuelLevel,
            damages: ri.damages,
            pendingItems: ri.pendingItems,
            nextMotorcycleStatus: ri.nextMotorcycleStatus,
            depositOutcome: ri.depositOutcome,
            depositRetainedAmount: money(ri.depositRetainedAmount),
            notes: ri.notes,
            createdByName: ri.createdById ? (names.get(ri.createdById) ?? null) : null,
            createdAt: ri.createdAt,
          }
        : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async list(params: ListContractsParams): Promise<{ items: ContractRecord[]; total: number }> {
    const plate = params.search?.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const where: Prisma.ContractWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.motorcycleId ? { motorcycleId: params.motorcycleId } : {}),
      ...(params.endingBefore ? { status: 'ACTIVE' as ContractStatus, endDate: { lte: dbDate(params.endingBefore) } } : {}),
      ...(params.search
        ? {
            OR: [
              { number: { contains: params.search.toUpperCase() } },
              { customer: { name: { contains: params.search, mode: 'insensitive' } } },
              ...(plate ? [{ motorcycle: { plate: { contains: plate } } }] : []),
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.contract.findMany({
        where,
        include: INCLUDE,
        orderBy: params.endingBefore ? { endDate: 'asc' } : { seq: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.client.contract.count({ where }),
    ]);
    const names = await this.names(rows.map((r) => r.createdById));
    return { items: rows.map((r) => this.toRecord(r, names)), total };
  }

  async findById(id: string): Promise<ContractRecord | null> {
    const r = await this.prisma.client.contract.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
    if (!r) return null;
    const names = await this.names([r.createdById, r.returnInspection?.createdById]);
    return this.toRecord(r, names);
  }

  async chargeStats(contractIds: string[], today: Ymd, graceDays: number): Promise<Map<string, ContractChargeStats>> {
    const map = new Map<string, ContractChargeStats>();
    if (!contractIds.length) return map;
    const limit = dbDate(addDays(today, -graceDays));
    const charges = await this.prisma.raw.charge.findMany({
      where: { contractId: { in: contractIds }, status: { not: 'CANCELLED' } },
      select: { contractId: true, status: true, dueDate: true, amount: true, paidAmount: true },
    });
    for (const id of contractIds) map.set(id, { nextDueDate: null, overdueCount: 0, paidCents: 0, pendingCents: 0, overdueCents: 0 });
    for (const c of charges) {
      const s = map.get(c.contractId!)!;
      if (c.status === 'PAID') {
        s.paidCents += toCents((c.paidAmount ?? c.amount).toFixed(2));
        continue;
      }
      const overdue = c.status === 'OVERDUE' || c.dueDate < limit;
      if (overdue) {
        s.overdueCount += 1;
        s.overdueCents += toCents(c.amount.toFixed(2));
      } else {
        s.pendingCents += toCents(c.amount.toFixed(2));
      }
      const due = ymd(c.dueDate);
      if (!s.nextDueDate || due < s.nextDueDate) s.nextDueDate = due;
    }
    return map;
  }

  async createDraft(data: Parameters<ContractsRepository['createDraft']>[0]): Promise<ContractRecord> {
    const id = await this.prisma.client.$transaction(async (tx) => {
      const [{ v }] = await tx.$queryRaw<{ v: bigint }[]>`SELECT nextval('"Contract_seq_seq"') AS v`;
      const seq = Number(v);
      const c = await tx.contract.create({
        data: {
          seq,
          number: contractNumber(seq, data.startDate),
          customerId: data.customerId,
          motorcycleId: data.motorcycleId,
          startDate: dbDate(data.startDate),
          endDate: dbDate(data.endDate),
          firstDueDate: dbDate(data.firstDueDate),
          periodicity: data.periodicity,
          rentAmount: data.rentAmount,
          depositAmount: data.depositAmount,
          rules: data.rules,
          notes: data.notes,
          createdById: data.createdById,
        },
      });
      await tx.motorcycle.update({ where: { id: data.motorcycleId }, data: { status: 'RESERVED', availableSince: null } });
      return c.id;
    });
    return (await this.findById(id))!;
  }

  async updateDraft(id: string, data: Parameters<ContractsRepository['updateDraft']>[1], previousMotorcycleId: string): Promise<ContractRecord> {
    await this.prisma.client.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id },
        data: {
          ...(data.motorcycleId ? { motorcycleId: data.motorcycleId } : {}),
          ...(data.startDate ? { startDate: dbDate(data.startDate) } : {}),
          ...(data.endDate ? { endDate: dbDate(data.endDate) } : {}),
          ...(data.firstDueDate ? { firstDueDate: dbDate(data.firstDueDate) } : {}),
          ...(data.periodicity ? { periodicity: data.periodicity } : {}),
          ...(data.rentAmount ? { rentAmount: data.rentAmount } : {}),
          ...(data.depositAmount !== undefined ? { depositAmount: data.depositAmount } : {}),
          ...(data.rules !== undefined ? { rules: data.rules } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          // Mudou o contrato: o texto gerado antes deixa de valer.
          renderedText: null,
          documentHash: null,
        },
      });
      if (data.motorcycleId && data.motorcycleId !== previousMotorcycleId) {
        await tx.motorcycle.update({ where: { id: previousMotorcycleId }, data: { status: 'AVAILABLE', availableSince: new Date() } });
        await tx.motorcycle.update({ where: { id: data.motorcycleId }, data: { status: 'RESERVED', availableSince: null } });
      }
    });
    return (await this.findById(id))!;
  }

  async cancelDraft(id: string, reason: string, motorcycleId: string): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      await tx.contract.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await tx.motorcycle.updateMany({ where: { id: motorcycleId, status: 'RESERVED' }, data: { status: 'AVAILABLE', availableSince: new Date() } });
    });
  }

  async saveRendered(id: string, text: string, hash: string): Promise<void> {
    // Texto do contrato não interessa ao histórico (volumoso): grava sem auditoria.
    await this.prisma.raw.contract.update({ where: { id }, data: { renderedText: text, documentHash: hash } });
  }

  async registerSignature(id: string, data: { method: 'IN_PERSON' | 'ELECTRONIC_ACCEPTANCE' | 'PROVIDER'; ip: string | null; userAgent: string | null; documentId: string | null }): Promise<void> {
    await this.prisma.client.contract.update({
      where: { id },
      data: {
        signatureStatus: 'SIGNED',
        signatureMethod: data.method,
        signedAt: new Date(),
        signatureIp: data.ip,
        signatureUserAgent: data.userAgent,
        signedDocumentId: data.documentId,
      },
    });
  }

  async markSent(id: string): Promise<void> {
    await this.prisma.client.contract.update({ where: { id }, data: { sentAt: new Date() } });
  }

  private async createCharges(tx: PrismaTx, contract: { id: string; customerId: string; motorcycleId: string }, charges: NewChargeData[]): Promise<void> {
    if (!charges.length) return;
    const seqs = await tx.$queryRaw<{ v: bigint }[]>`SELECT nextval('"Charge_seq_seq"') AS v FROM generate_series(1, ${charges.length}::int)`;
    await tx.charge.createMany({
      data: charges.map((c, i) => {
        const seq = Number(seqs[i]!.v);
        return {
          seq,
          number: chargeNumber(seq),
          customerId: contract.customerId,
          contractId: contract.id,
          motorcycleId: contract.motorcycleId,
          kind: c.kind,
          sequence: c.sequence,
          description: c.description,
          periodStart: dbDate(c.periodStart),
          periodEnd: dbDate(c.periodEnd),
          dueDate: dbDate(c.dueDate),
          amount: c.amount,
        };
      }),
    });
  }

  async deliver(id: string, data: { initialKm: number; notes: string | null; userId: string; charges: NewChargeData[] }): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      const c = await tx.contract.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          deliveredAt: new Date(),
          initialKm: data.initialKm,
          ...(data.notes ? { notes: data.notes } : {}),
        },
      });
      await tx.motorcycle.update({
        where: { id: c.motorcycleId },
        data: { status: 'RENTED', statusReason: null, availableSince: null, currentKm: data.initialKm },
      });
      await tx.odometerReading.create({
        data: { motorcycleId: c.motorcycleId, km: data.initialKm, source: 'CONTRACT_START', userId: data.userId, contractId: id, customerId: c.customerId },
      });
      await this.createCharges(tx, c, data.charges);
    });
  }

  async adjustRent(id: string, rentAmount: string, effectiveFrom: Ymd, previousRent: string): Promise<number> {
    return this.prisma.client.$transaction(async (tx) => {
      await tx.contract.update({ where: { id }, data: { rentAmount } });
      const open = await tx.charge.findMany({
        where: { contractId: id, kind: 'RENT', status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { gte: dbDate(effectiveFrom) } },
        select: { id: true, amount: true },
      });
      const ratio = toCents(rentAmount) / Math.max(1, toCents(previousRent));
      for (const c of open) {
        // Parcela proporcional (última) mantém a proporção.
        const cents = Math.round(toCents(c.amount.toFixed(2)) * ratio);
        await tx.charge.update({ where: { id: c.id }, data: { amount: (cents / 100).toFixed(2) } });
      }
      return open.length;
    });
  }

  async extend(id: string, endDate: Ymd, updates: { sequence: number; amount: string; periodEnd: Ymd }[], charges: NewChargeData[]): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      const c = await tx.contract.update({ where: { id }, data: { endDate: dbDate(endDate) } });
      for (const u of updates) {
        await tx.charge.updateMany({
          where: { contractId: id, kind: 'RENT', sequence: u.sequence, status: { in: ['PENDING', 'OVERDUE'] } },
          data: { amount: u.amount, periodEnd: dbDate(u.periodEnd) },
        });
      }
      await this.createCharges(tx, c, charges);
    });
  }

  async endWithReturn(id: string, data: Parameters<ContractsRepository['endWithReturn']>[1]): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      const c = await tx.contract.update({ where: { id }, data: { status: 'ENDED', endedAt: new Date() } });
      await tx.returnInspection.create({
        data: {
          contractId: id,
          returnedAt: dbDate(data.returnedAt),
          finalKm: data.finalKm,
          condition: data.condition,
          fuelLevel: data.fuelLevel,
          damages: data.damages,
          pendingItems: data.pendingItems,
          nextMotorcycleStatus: data.nextMotorcycleStatus,
          depositOutcome: data.depositOutcome,
          depositRetainedAmount: data.depositRetainedAmount,
          notes: data.notes,
          createdById: data.userId,
        },
      });
      // Parcelas de períodos que começam depois da devolução deixam de existir.
      await tx.charge.updateMany({
        where: { contractId: id, kind: 'RENT', status: { in: ['PENDING', 'OVERDUE'] }, periodStart: { gt: dbDate(data.returnedAt) } },
        data: { status: 'CANCELLED', cancelReason: 'Contrato encerrado (devolução)' },
      });
      // Caução que nunca foi paga não fica cobrando depois do fim.
      await tx.charge.updateMany({
        where: { contractId: id, kind: 'DEPOSIT', status: { in: ['PENDING', 'OVERDUE'] } },
        data: { status: 'CANCELLED', cancelReason: 'Contrato encerrado (devolução)' },
      });
      await this.createCharges(tx, c, data.extraCharges);
      await tx.motorcycle.update({
        where: { id: c.motorcycleId },
        data: {
          status: data.nextMotorcycleStatus,
          statusReason: data.nextMotorcycleStatus === 'MAINTENANCE' ? 'Revisão após devolução' : null,
          availableSince: data.nextMotorcycleStatus === 'AVAILABLE' ? new Date() : null,
          currentKm: data.finalKm,
        },
      });
      await tx.odometerReading.create({
        data: { motorcycleId: c.motorcycleId, km: data.finalKm, source: 'RETURN', userId: data.userId, contractId: id, customerId: c.customerId },
      });
      if (data.depositRetainedAmount && Number(data.depositRetainedAmount) > 0) {
        await tx.financialEntry.create({
          data: {
            type: 'INCOME',
            categoryCode: 'DEPOSIT_RETAINED',
            description: `Caução retida — ${c.number}`,
            amount: data.depositRetainedAmount,
            date: dbDate(data.returnedAt),
            motorcycleId: c.motorcycleId,
            customerId: c.customerId,
            createdById: data.userId,
          },
        });
      }
    });
  }

  async customerOpenContract(customerId: string, exceptId?: string): Promise<boolean> {
    return (await this.prisma.raw.contract.count({
      where: { customerId, status: { in: ['ACTIVE', 'DRAFT'] }, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    })) > 0;
  }

  async motorcycleOpenContract(motorcycleId: string, exceptId?: string): Promise<boolean> {
    return (await this.prisma.raw.contract.count({
      where: { motorcycleId, status: { in: ['ACTIVE', 'DRAFT'] }, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    })) > 0;
  }

  async existingRentCharges(contractId: string) {
    const rows = await this.prisma.raw.charge.findMany({
      where: { contractId, kind: 'RENT' },
      select: { id: true, sequence: true, status: true, amount: true, periodEnd: true },
      orderBy: { sequence: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, sequence: r.sequence ?? 0, status: r.status, amount: r.amount.toFixed(2), periodEnd: ymd(r.periodEnd) }));
  }
}
