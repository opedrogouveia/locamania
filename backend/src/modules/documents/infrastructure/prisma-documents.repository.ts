import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { formatPlate, type DocumentOwnerType, type Ymd } from '@locamania/shared';

import { dbDate, ymd } from '../../../shared/http/mappers';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { DocumentRecord, DocumentsRepository } from '../domain/documents.ports';

const SELECT = {
  id: true, ownerType: true, ownerId: true, typeCode: true, title: true, fileName: true, mimeType: true,
  sizeBytes: true, expiresAt: true, visibleToCustomer: true, notes: true, uploadedById: true, uploadedByCustomerId: true, createdAt: true,
} satisfies Prisma.DocumentSelect;

type Row = Prisma.DocumentGetPayload<{ select: typeof SELECT }>;

@Injectable()
export class PrismaDocumentsRepository implements DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async toRecords(rows: Row[]): Promise<DocumentRecord[]> {
    const userIds = [...new Set(rows.map((r) => r.uploadedById).filter(Boolean))] as string[];
    const customerIds = [...new Set(rows.map((r) => r.uploadedByCustomerId).filter(Boolean))] as string[];
    const [users, customers] = await Promise.all([
      userIds.length ? this.prisma.raw.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
      customerIds.length ? this.prisma.raw.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } }) : [],
    ]);
    const names = new Map([...users, ...customers].map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      ownerType: r.ownerType,
      ownerId: r.ownerId,
      typeCode: r.typeCode,
      title: r.title,
      fileName: r.fileName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      expiresAt: ymd(r.expiresAt),
      visibleToCustomer: r.visibleToCustomer,
      notes: r.notes,
      uploadedByName: (r.uploadedById && names.get(r.uploadedById)) || (r.uploadedByCustomerId && names.get(r.uploadedByCustomerId)) || null,
      createdAt: r.createdAt,
    }));
  }

  async list(f: Parameters<DocumentsRepository['list']>[0]) {
    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
      ...(f.ownerType ? { ownerType: f.ownerType } : {}),
      ...(f.ownerId ? { ownerId: f.ownerId } : {}),
      ...(f.typeCode ? { typeCode: f.typeCode } : {}),
      ...(f.visibleToCustomer !== undefined ? { visibleToCustomer: f.visibleToCustomer } : {}),
      ...(f.expiresBefore || f.expiresAfter
        ? { expiresAt: { ...(f.expiresBefore ? { lte: dbDate(f.expiresBefore) } : {}), ...(f.expiresAfter ? { gte: dbDate(f.expiresAfter) } : {}) } }
        : {}),
      ...(f.search ? { OR: [{ title: { contains: f.search, mode: 'insensitive' } }, { fileName: { contains: f.search, mode: 'insensitive' } }] } : {}),
    };
    const orderBy: Prisma.DocumentOrderByWithRelationInput = f.expiresBefore ? { expiresAt: 'asc' } : { createdAt: 'desc' };
    const [rows, total] = await this.prisma.raw.$transaction([
      this.prisma.raw.document.findMany({ where, select: SELECT, orderBy, skip: f.skip, take: f.take }),
      this.prisma.raw.document.count({ where }),
    ]);
    return { items: await this.toRecords(rows), total };
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const r = await this.prisma.raw.document.findFirst({ where: { id, deletedAt: null }, select: SELECT });
    return r ? (await this.toRecords([r]))[0]! : null;
  }

  async data(id: string) {
    const r = await this.prisma.raw.document.findFirst({ where: { id, deletedAt: null }, select: { data: true, mimeType: true, fileName: true } });
    return r ? { data: Buffer.from(r.data), mimeType: r.mimeType, fileName: r.fileName } : null;
  }

  async create(data: Parameters<DocumentsRepository['create']>[0]): Promise<DocumentRecord> {
    const r = await this.prisma.client.document.create({
      // Uint8Array "puro": o tipo Buffer do Node novo não bate com o Bytes do Prisma 6.
      data: { ...data, data: new Uint8Array(data.data), expiresAt: dbDate(data.expiresAt) },
      select: SELECT,
    });
    return (await this.toRecords([r]))[0]!;
  }

  async update(id: string, data: Parameters<DocumentsRepository['update']>[1]): Promise<DocumentRecord> {
    const { expiresAt, ...rest } = data;
    const r = await this.prisma.client.document.update({
      where: { id },
      data: { ...rest, ...(expiresAt !== undefined ? { expiresAt: dbDate(expiresAt) } : {}) },
      select: SELECT,
    });
    return (await this.toRecords([r]))[0]!;
  }

  async archive(id: string): Promise<void> {
    await this.prisma.client.document.update({ where: { id }, data: { deletedAt: new Date() }, select: { id: true } });
  }

  async ownerExists(ownerType: DocumentOwnerType, ownerId: string): Promise<boolean> {
    const db = this.prisma.raw;
    const where = { where: { id: ownerId } };
    switch (ownerType) {
      case 'CUSTOMER': return (await db.customer.count(where)) > 0;
      case 'MOTORCYCLE': return (await db.motorcycle.count(where)) > 0;
      case 'CONTRACT': return (await db.contract.count(where)) > 0;
      case 'MAINTENANCE': return (await db.maintenanceRecord.count(where)) > 0;
      case 'OCCURRENCE': return (await db.occurrence.count(where)) > 0;
      case 'CHARGE': return (await db.charge.count(where)) > 0;
      case 'RETURN': return (await db.returnInspection.count(where)) > 0;
      case 'FINANCIAL_ENTRY': return (await db.financialEntry.count(where)) > 0;
    }
  }

  async ownerLabels(refs: { ownerType: DocumentOwnerType; ownerId: string }[]): Promise<Map<string, string>> {
    const ids = (t: DocumentOwnerType) => [...new Set(refs.filter((r) => r.ownerType === t).map((r) => r.ownerId))];
    const db = this.prisma.raw;
    const map = new Map<string, string>();
    const [customers, motorcycles, contracts] = await Promise.all([
      db.customer.findMany({ where: { id: { in: ids('CUSTOMER') } }, select: { id: true, name: true } }),
      db.motorcycle.findMany({ where: { id: { in: ids('MOTORCYCLE') } }, select: { id: true, plate: true } }),
      db.contract.findMany({ where: { id: { in: ids('CONTRACT') } }, select: { id: true, number: true } }),
    ]);
    customers.forEach((c) => map.set(c.id, c.name));
    motorcycles.forEach((m) => map.set(m.id, formatPlate(m.plate)));
    contracts.forEach((c) => map.set(c.id, c.number));
    return map;
  }

  async cnhExpiring(before: Ymd) {
    const rows = await this.prisma.raw.customer.findMany({
      where: {
        deletedAt: null,
        cnhExpiresAt: { lte: dbDate(before) },
        // Só quem está (ou pode estar) com moto: clientes encerrados/inativos não geram alerta.
        status: { in: ['ACTIVE', 'OVERDUE'] },
      },
      select: { id: true, name: true, cnhExpiresAt: true },
      orderBy: { cnhExpiresAt: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, cnhExpiresAt: ymd(r.cnhExpiresAt)! }));
  }

  async customerOwnsDocument(documentId: string, customerId: string): Promise<boolean> {
    const d = await this.prisma.raw.document.findFirst({
      where: { id: documentId, deletedAt: null, visibleToCustomer: true },
      select: { ownerType: true, ownerId: true },
    });
    if (!d) return false;
    if (d.ownerType === 'CUSTOMER') return d.ownerId === customerId;
    if (d.ownerType === 'CONTRACT') return (await this.prisma.raw.contract.count({ where: { id: d.ownerId, customerId } })) > 0;
    if (d.ownerType === 'CHARGE') return (await this.prisma.raw.charge.count({ where: { id: d.ownerId, customerId } })) > 0;
    if (d.ownerType === 'MOTORCYCLE') {
      return (await this.prisma.raw.contract.count({ where: { motorcycleId: d.ownerId, customerId, status: 'ACTIVE' } })) > 0;
    }
    return false;
  }
}
