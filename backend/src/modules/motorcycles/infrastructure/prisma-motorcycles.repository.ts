import { Injectable } from '@nestjs/common';
import type { Motorcycle as PrismaMotorcycle, Prisma } from '@prisma/client';
import {
  CONTRACT_STATUS_LABELS,
  formatBRL,
  MAINTENANCE_STATUS_LABELS,
  MOTORCYCLE_STATUS_LABELS,
  OCCURRENCE_TYPE_LABELS,
  ODOMETER_SOURCE_LABELS,
  toCents,
  type MotorcycleStatus,
  type OdometerSource,
  type Ymd,
} from '@locamania/shared';

import { dbDate, ymd } from '../../../shared/http/mappers';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  CurrentRental,
  ListMotorcyclesParams,
  MotorcycleHistoryRecord,
  MotorcycleRecord,
  MotorcyclesRepository,
  MotorcycleWriteData,
  OdometerRecord,
  PlanForDue,
} from '../domain/motorcycles.ports';

function toRecord(m: PrismaMotorcycle): MotorcycleRecord {
  return {
    id: m.id,
    brandCode: m.brandCode,
    modelCode: m.modelCode,
    manufactureYear: m.manufactureYear,
    modelYear: m.modelYear,
    color: m.color,
    plate: m.plate,
    renavam: m.renavam,
    chassis: m.chassis,
    currentKm: m.currentKm,
    acquiredAt: ymd(m.acquiredAt),
    purchasePriceCents: m.purchasePrice ? toCents(m.purchasePrice.toFixed(2)) : null,
    status: m.status,
    statusReason: m.statusReason,
    availableSince: m.availableSince,
    hasTracker: m.hasTracker,
    trackerProvider: m.trackerProvider,
    trackerDeviceId: m.trackerDeviceId,
    notes: m.notes,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function toData(data: MotorcycleWriteData): Prisma.MotorcycleUncheckedUpdateInput {
  const { acquiredAt, purchasePrice, ...rest } = data;
  return {
    ...rest,
    ...(acquiredAt !== undefined ? { acquiredAt: dbDate(acquiredAt) } : {}),
    ...(purchasePrice !== undefined ? { purchasePrice } : {}),
  };
}

@Injectable()
export class PrismaMotorcyclesRepository implements MotorcyclesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListMotorcyclesParams): Promise<{ items: MotorcycleRecord[]; total: number }> {
    const term = params.search?.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const where: Prisma.MotorcycleWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.ids ? { id: { in: params.ids } } : {}),
      ...(params.search
        ? {
            OR: [
              ...(term ? [{ plate: { contains: term } }, { renavam: { contains: term } }, { chassis: { contains: term } }] : []),
              ...(params.modelCodes?.length ? [{ modelCode: { in: params.modelCodes } }, { brandCode: { in: params.modelCodes } }] : []),
              { color: { contains: params.search, mode: 'insensitive' as const } },
              { trackerDeviceId: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.motorcycle.findMany({ where, orderBy: [{ status: 'asc' }, { plate: 'asc' }], skip: params.skip, take: params.take }),
      this.prisma.client.motorcycle.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }

  async allIds(status?: MotorcycleStatus): Promise<string[]> {
    const rows = await this.prisma.raw.motorcycle.findMany({
      where: { deletedAt: null, ...(status ? { status } : {}) },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async findById(id: string): Promise<MotorcycleRecord | null> {
    const m = await this.prisma.client.motorcycle.findFirst({ where: { id, deletedAt: null } });
    return m ? toRecord(m) : null;
  }

  async findByPlate(plate: string): Promise<MotorcycleRecord | null> {
    const m = await this.prisma.client.motorcycle.findUnique({ where: { plate } });
    return m ? toRecord(m) : null;
  }

  async create(
    data: MotorcycleWriteData & { brandCode: string; modelCode: string; plate: string; currentKm: number },
    plans: { typeId: string; intervalKm: number | null; intervalDays: number | null; nextDueKm: number | null; nextDueDate: Ymd | null; lastDoneKm: number; lastDoneAt: Ymd }[],
    userId: string,
  ): Promise<MotorcycleRecord> {
    const created = await this.prisma.client.$transaction(async (tx) => {
      const m = await tx.motorcycle.create({
        data: { ...(toData(data) as Prisma.MotorcycleUncheckedCreateInput), status: 'AVAILABLE', availableSince: new Date() },
      });
      await tx.odometerReading.create({ data: { motorcycleId: m.id, km: data.currentKm, source: 'MANUAL', userId, notes: 'Cadastro da moto' } });
      if (plans.length) {
        await tx.maintenancePlan.createMany({
          data: plans.map((p) => ({
            motorcycleId: m.id,
            typeId: p.typeId,
            intervalKm: p.intervalKm,
            intervalDays: p.intervalDays,
            lastDoneKm: p.lastDoneKm,
            lastDoneAt: dbDate(p.lastDoneAt),
            nextDueKm: p.nextDueKm,
            nextDueDate: dbDate(p.nextDueDate),
          })),
        });
      }
      return m;
    });
    return toRecord(created);
  }

  async update(id: string, data: MotorcycleWriteData): Promise<MotorcycleRecord> {
    return toRecord(await this.prisma.client.motorcycle.update({ where: { id }, data: toData(data) }));
  }

  async setStatus(id: string, status: MotorcycleStatus, reason: string | null): Promise<MotorcycleRecord> {
    return toRecord(
      await this.prisma.client.motorcycle.update({
        where: { id },
        data: { status, statusReason: reason, ...(status === 'AVAILABLE' ? { availableSince: new Date() } : { availableSince: null }) },
      }),
    );
  }

  async archive(id: string): Promise<void> {
    await this.prisma.client.motorcycle.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async plansForDue(ids: string[]): Promise<PlanForDue[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.raw.maintenancePlan.findMany({
      where: { motorcycleId: { in: ids }, active: true, OR: [{ nextDueKm: { not: null } }, { nextDueDate: { not: null } }] },
      select: { motorcycleId: true, nextDueKm: true, nextDueDate: true, type: { select: { name: true, active: true } } },
    });
    return rows
      .filter((r) => r.type.active)
      .map((r) => ({ motorcycleId: r.motorcycleId, typeName: r.type.name, nextDueKm: r.nextDueKm, nextDueDate: ymd(r.nextDueDate) }));
  }

  async currentRentals(ids: string[]): Promise<Map<string, CurrentRental>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.raw.contract.findMany({
      where: { motorcycleId: { in: ids }, status: 'ACTIVE', deletedAt: null },
      select: { id: true, motorcycleId: true, customer: { select: { id: true, name: true } } },
    });
    return new Map(rows.map((r) => [r.motorcycleId, { contractId: r.id, customerId: r.customer.id, customerName: r.customer.name }]));
  }

  async hasOpenContract(id: string): Promise<boolean> {
    return (await this.prisma.raw.contract.count({ where: { motorcycleId: id, status: { in: ['ACTIVE', 'DRAFT'] }, deletedAt: null } })) > 0;
  }

  async odometer(id: string, take: number): Promise<OdometerRecord[]> {
    const rows = await this.prisma.raw.odometerReading.findMany({
      where: { motorcycleId: id },
      orderBy: { readAt: 'desc' },
      take,
    });
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    const customerIds = [...new Set(rows.map((r) => r.customerId).filter(Boolean))] as string[];
    const [users, customers] = await Promise.all([
      this.prisma.raw.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
      this.prisma.raw.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } }),
    ]);
    const names = new Map([...users, ...customers].map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      km: r.km,
      readAt: r.readAt,
      source: r.source,
      notes: r.notes,
      recordedBy: (r.userId && names.get(r.userId)) || (r.customerId && names.get(r.customerId)) || null,
    }));
  }

  async addOdometer(id: string, km: number, source: OdometerSource, notes: string | null, actor: { userId?: string; customerId?: string; contractId?: string }): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      await tx.odometerReading.create({ data: { motorcycleId: id, km, source, notes, ...actor } });
      // currentKm = maior leitura conhecida.
      await tx.motorcycle.updateMany({ where: { id, currentKm: { lt: km } }, data: { currentKm: km } });
    });
  }

  async lastOdometerAt(id: string): Promise<Date | null> {
    const r = await this.prisma.raw.odometerReading.findFirst({ where: { motorcycleId: id }, orderBy: { readAt: 'desc' }, select: { readAt: true } });
    return r?.readAt ?? null;
  }

  /** Linha do tempo da moto (§6), montada de várias tabelas — nada é apagado. */
  async history(id: string): Promise<MotorcycleHistoryRecord[]> {
    const db = this.prisma.raw;
    const [contracts, records, occurrences, readings, expenses, statusLogs] = await Promise.all([
      db.contract.findMany({
        where: { motorcycleId: id, deletedAt: null },
        select: { id: true, number: true, status: true, deliveredAt: true, endedAt: true, initialKm: true, customer: { select: { name: true } }, returnInspection: { select: { finalKm: true, condition: true } } },
      }),
      db.maintenanceRecord.findMany({
        where: { motorcycleId: id, deletedAt: null },
        select: { id: true, status: true, completedAt: true, scheduledFor: true, createdAt: true, km: true, workshop: true, types: { select: { type: { select: { name: true } } } } },
      }),
      db.occurrence.findMany({
        where: { motorcycleId: id, deletedAt: null },
        select: { id: true, type: true, occurredAt: true, description: true, customer: { select: { name: true } } },
      }),
      db.odometerReading.findMany({ where: { motorcycleId: id, source: { in: ['MANUAL', 'CUSTOMER', 'TRACKER'] } }, orderBy: { readAt: 'desc' }, take: 30 }),
      db.financialEntry.findMany({ where: { motorcycleId: id, deletedAt: null, type: 'EXPENSE' }, select: { id: true, date: true, description: true, amount: true } }),
      db.auditLog.findMany({ where: { entityType: 'Motorcycle', entityId: id, action: 'STATUS_CHANGE' }, orderBy: { occurredAt: 'desc' }, take: 30 }),
    ]);

    const out: MotorcycleHistoryRecord[] = [];
    for (const c of contracts) {
      if (c.deliveredAt) {
        out.push({
          id: `${c.id}-start`,
          date: c.deliveredAt,
          kind: 'RENTAL_START',
          title: `Alugada para ${c.customer.name}`,
          description: `Contrato ${c.number}${c.initialKm != null ? ` · saída com ${c.initialKm.toLocaleString('pt-BR')} km` : ''}`,
          link: `/admin/contracts/${c.id}`,
        });
      }
      if (c.endedAt) {
        out.push({
          id: `${c.id}-end`,
          date: c.endedAt,
          kind: 'RENTAL_END',
          title: `Devolvida por ${c.customer.name}`,
          description: `Contrato ${c.number} ${CONTRACT_STATUS_LABELS[c.status].toLowerCase()}${c.returnInspection ? ` · devolução com ${c.returnInspection.finalKm.toLocaleString('pt-BR')} km` : ''}`,
          link: `/admin/contracts/${c.id}`,
        });
      }
    }
    for (const r of records) {
      out.push({
        id: r.id,
        date: r.completedAt ?? r.scheduledFor ?? r.createdAt,
        kind: 'MAINTENANCE',
        title: r.types.map((t) => t.type.name).join(', ') || 'Manutenção',
        description: `${MAINTENANCE_STATUS_LABELS[r.status]}${r.km != null ? ` · ${r.km.toLocaleString('pt-BR')} km` : ''}${r.workshop ? ` · ${r.workshop}` : ''}`,
        link: `/admin/maintenance?record=${r.id}`,
      });
    }
    for (const o of occurrences) {
      out.push({
        id: o.id,
        date: o.occurredAt,
        kind: 'OCCURRENCE',
        title: OCCURRENCE_TYPE_LABELS[o.type],
        description: `${o.description}${o.customer ? ` · ${o.customer.name}` : ''}`,
        link: `/admin/occurrences/${o.id}`,
      });
    }
    for (const r of readings) {
      out.push({
        id: r.id,
        date: r.readAt,
        kind: 'ODOMETER',
        title: `${r.km.toLocaleString('pt-BR')} km`,
        description: ODOMETER_SOURCE_LABELS[r.source],
        link: null,
      });
    }
    for (const e of expenses) {
      out.push({ id: e.id, date: e.date, kind: 'EXPENSE', title: e.description, description: formatBRL(e.amount.toFixed(2)), link: '/admin/finance' });
    }
    for (const log of statusLogs) {
      const status = ((log.changes ?? {}) as { data?: { status?: MotorcycleStatus } }).data?.status;
      if (!status || status === 'RENTED') continue;
      out.push({
        id: log.id,
        date: log.occurredAt,
        kind: 'STATUS',
        title: `Situação: ${MOTORCYCLE_STATUS_LABELS[status]}`,
        description: log.actorName ? `por ${log.actorName}` : null,
        link: null,
      });
    }
    return out.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  maintenanceTypes() {
    return this.prisma.raw.maintenanceType.findMany({
      where: { active: true },
      select: { id: true, defaultIntervalKm: true, defaultIntervalDays: true, active: true },
    });
  }
}
