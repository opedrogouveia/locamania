import { Injectable } from '@nestjs/common';
import type { Customer as PrismaCustomer, Prisma } from '@prisma/client';
import { addDays, onlyDigits, toCents, type CustomerStatus, type Ymd } from '@locamania/shared';

import { dbDate, ymd } from '../../../shared/http/mappers';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  ActiveRental,
  CustomerRecord,
  CustomersRepository,
  CustomerWriteData,
  ListCustomersParams,
  MoneySummary,
} from '../domain/customers.ports';

function toRecord(c: PrismaCustomer): CustomerRecord {
  return {
    id: c.id,
    number: c.number,
    name: c.name,
    cpf: c.cpf,
    rg: c.rg,
    birthDate: ymd(c.birthDate),
    phone: c.phone,
    whatsapp: c.whatsapp,
    email: c.email,
    postalCode: c.postalCode,
    street: c.street,
    streetNumber: c.streetNumber,
    complement: c.complement,
    district: c.district,
    city: c.city,
    state: c.state,
    cnhNumber: c.cnhNumber,
    cnhCategory: c.cnhCategory,
    cnhExpiresAt: ymd(c.cnhExpiresAt),
    status: c.status,
    manualStatus: c.manualStatus,
    blockedReason: c.blockedReason,
    inCollection: c.inCollection,
    collectionSince: ymd(c.collectionSince),
    notes: c.notes,
    portalEnabled: c.portalEnabled,
    portalLastLoginAt: c.portalLastLoginAt,
    privacyAcceptedAt: c.privacyAcceptedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function toData(data: CustomerWriteData): Prisma.CustomerUncheckedUpdateInput {
  const { birthDate, cnhExpiresAt, collectionSince, ...rest } = data;
  return {
    ...rest,
    ...(birthDate !== undefined ? { birthDate: dbDate(birthDate) } : {}),
    ...(cnhExpiresAt !== undefined ? { cnhExpiresAt: dbDate(cnhExpiresAt) } : {}),
    ...(collectionSince !== undefined ? { collectionSince: dbDate(collectionSince) } : {}),
  };
}

/** Cobrança em atraso de verdade: marcada pelo job OU pendente além da tolerância. */
function overdueWhere(today: Ymd, graceDays: number): Prisma.ChargeWhereInput {
  return {
    OR: [
      { status: 'OVERDUE' },
      { status: 'PENDING', dueDate: { lt: dbDate(addDays(today, -graceDays)) } },
    ],
  };
}

@Injectable()
export class PrismaCustomersRepository implements CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListCustomersParams): Promise<{ items: CustomerRecord[]; total: number }> {
    const digits = params.search ? onlyDigits(params.search) : '';
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.inCollection !== undefined ? { inCollection: params.inCollection } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
              ...(digits.length >= 3
                ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }, { whatsapp: { contains: digits } }]
                : []),
              ...(/^\d+$/.test(params.search.trim()) ? [{ number: Number(params.search.trim()) }] : []),
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.customer.findMany({ where, orderBy: { name: 'asc' }, skip: params.skip, take: params.take }),
      this.prisma.client.customer.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    const c = await this.prisma.client.customer.findFirst({ where: { id, deletedAt: null } });
    return c ? toRecord(c) : null;
  }

  async findByCpf(cpf: string): Promise<CustomerRecord | null> {
    // Unicidade considera também os arquivados (o CPF é @unique).
    const c = await this.prisma.client.customer.findUnique({ where: { cpf } });
    return c ? toRecord(c) : null;
  }

  async create(data: CustomerWriteData & { name: string; cpf: string }): Promise<CustomerRecord> {
    return toRecord(await this.prisma.client.customer.create({ data: toData(data) as Prisma.CustomerUncheckedCreateInput }));
  }

  async update(id: string, data: CustomerWriteData): Promise<CustomerRecord> {
    return toRecord(await this.prisma.client.customer.update({ where: { id }, data: toData(data) }));
  }

  async archive(id: string): Promise<void> {
    await this.prisma.client.customer.update({
      where: { id },
      data: { deletedAt: new Date(), portalEnabled: false, sessionVersion: { increment: 1 } },
    });
  }

  async setPortal(id: string, enabled: boolean): Promise<void> {
    await this.prisma.client.customer.update({
      where: { id },
      data: enabled ? { portalEnabled: true } : { portalEnabled: false, sessionVersion: { increment: 1 } },
    });
  }

  async activeRentals(customerIds: string[]): Promise<Map<string, ActiveRental>> {
    if (customerIds.length === 0) return new Map();
    const rows = await this.prisma.raw.contract.findMany({
      where: { customerId: { in: customerIds }, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        customerId: true,
        motorcycle: { select: { id: true, plate: true, brandCode: true, modelCode: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    const map = new Map<string, ActiveRental>();
    for (const r of rows) if (!map.has(r.customerId)) map.set(r.customerId, { contractId: r.id, motorcycle: r.motorcycle });
    return map;
  }

  async overdueSummary(customerIds: string[], today: Ymd, graceDays: number): Promise<Map<string, MoneySummary>> {
    if (customerIds.length === 0) return new Map();
    const rows = await this.prisma.raw.charge.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, ...overdueWhere(today, graceDays) },
      _count: { _all: true },
      _sum: { amount: true },
    });
    return new Map(
      rows.map((r) => [r.customerId, { count: r._count._all, cents: toCents(r._sum.amount?.toFixed(2) ?? '0') }]),
    );
  }

  async totals(customerId: string, today: Ymd, graceDays: number) {
    const [paid, pending, overdue] = await Promise.all([
      this.prisma.raw.charge.aggregate({ where: { customerId, status: 'PAID' }, _sum: { paidAmount: true } }),
      this.prisma.raw.charge.aggregate({
        where: { customerId, status: 'PENDING', dueDate: { gte: dbDate(addDays(today, -graceDays)) } },
        _sum: { amount: true },
      }),
      this.prisma.raw.charge.aggregate({ where: { customerId, ...overdueWhere(today, graceDays) }, _sum: { amount: true } }),
    ]);
    return {
      paidCents: toCents(paid._sum.paidAmount?.toFixed(2) ?? '0'),
      pendingCents: toCents(pending._sum.amount?.toFixed(2) ?? '0'),
      overdueCents: toCents(overdue._sum.amount?.toFixed(2) ?? '0'),
    };
  }

  async nextCharge(customerId: string) {
    const c = await this.prisma.raw.charge.findFirst({
      where: { customerId, status: { in: ['PENDING', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
      select: { id: true, dueDate: true, amount: true },
    });
    return c ? { id: c.id, dueDate: ymd(c.dueDate), amountCents: toCents(c.amount.toFixed(2)) } : null;
  }

  async documents(customerId: string) {
    const rows = await this.prisma.raw.document.findMany({
      where: { ownerType: 'CUSTOMER', ownerId: customerId, deletedAt: null },
      select: { id: true, typeCode: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ id: r.id, typeCode: r.typeCode, expiresAt: ymd(r.expiresAt) }));
  }

  async hasActiveContract(customerId: string): Promise<boolean> {
    return (await this.prisma.raw.contract.count({ where: { customerId, status: { in: ['ACTIVE', 'DRAFT'] }, deletedAt: null } })) > 0;
  }

  async statusFacts(customerId: string, today: Ymd, graceDays: number) {
    const [active, overdue, any] = await Promise.all([
      this.prisma.raw.contract.count({ where: { customerId, status: 'ACTIVE', deletedAt: null } }),
      this.prisma.raw.charge.count({ where: { customerId, ...overdueWhere(today, graceDays) } }),
      this.prisma.raw.contract.count({ where: { customerId, status: { in: ['ACTIVE', 'ENDED'] }, deletedAt: null } }),
    ]);
    return { hasActiveContract: active > 0, hasOverdue: overdue > 0, hadContract: any > 0 };
  }

  async setStatus(id: string, status: CustomerStatus): Promise<void> {
    await this.prisma.client.customer.update({ where: { id }, data: { status } });
  }
}
