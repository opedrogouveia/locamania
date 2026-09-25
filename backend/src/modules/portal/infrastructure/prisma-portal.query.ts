import { Injectable } from '@nestjs/common';

import { money, ymd } from '../../../shared/http/mappers';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { PortalChargeRow, PortalContractRow, PortalQuery } from '../application/portal.service';

const CHARGE_SELECT = {
  id: true, number: true, kind: true, description: true, dueDate: true, amount: true, status: true, paidAt: true, paidAmount: true, method: true,
} as const;

@Injectable()
export class PrismaPortalQuery implements PortalQuery {
  constructor(private readonly prisma: PrismaService) {}

  /** Contrato atual: o ativo; senão o rascunho; senão o último encerrado. */
  async currentContract(customerId: string): Promise<PortalContractRow | null> {
    const db = this.prisma.raw;
    const select = {
      id: true, number: true, status: true, signatureStatus: true, signedAt: true, startDate: true, endDate: true,
      periodicity: true, rentAmount: true, depositAmount: true,
      motorcycle: {
        select: {
          id: true, plate: true, brandCode: true, modelCode: true, color: true, manufactureYear: true, currentKm: true,
          odometerReadings: { orderBy: { readAt: 'desc' as const }, take: 1, select: { readAt: true } },
        },
      },
    };
    for (const status of ['ACTIVE', 'DRAFT', 'ENDED'] as const) {
      const c = await db.contract.findFirst({ where: { customerId, status, deletedAt: null }, select, orderBy: { startDate: 'desc' } });
      if (c) {
        return {
          id: c.id,
          number: c.number,
          status: c.status,
          signatureStatus: c.signatureStatus,
          signedAt: c.signedAt,
          startDate: ymd(c.startDate),
          endDate: ymd(c.endDate),
          periodicity: c.periodicity,
          rentAmount: money(c.rentAmount),
          depositAmount: money(c.depositAmount),
          motorcycle: {
            id: c.motorcycle.id,
            plate: c.motorcycle.plate,
            brandCode: c.motorcycle.brandCode,
            modelCode: c.motorcycle.modelCode,
            color: c.motorcycle.color,
            manufactureYear: c.motorcycle.manufactureYear,
            currentKm: c.motorcycle.currentKm,
            lastKmAt: c.motorcycle.odometerReadings[0]?.readAt ?? null,
          },
        };
      }
    }
    return null;
  }

  private row(c: { id: string; number: string; kind: PortalChargeRow['kind']; description: string; dueDate: Date; amount: { toFixed(n: number): string }; status: PortalChargeRow['status']; paidAt: Date | null; paidAmount: { toFixed(n: number): string } | null; method: PortalChargeRow['method'] }): PortalChargeRow {
    return {
      id: c.id,
      number: c.number,
      kind: c.kind,
      description: c.description,
      dueDate: ymd(c.dueDate),
      amount: c.amount.toFixed(2),
      status: c.status,
      paidAt: c.paidAt,
      paidAmount: c.paidAmount ? c.paidAmount.toFixed(2) : null,
      method: c.method,
    };
  }

  async charges(customerId: string): Promise<PortalChargeRow[]> {
    const rows = await this.prisma.raw.charge.findMany({ where: { customerId }, select: CHARGE_SELECT, orderBy: [{ dueDate: 'desc' }] });
    return rows.map((r) => this.row(r));
  }

  async charge(customerId: string, chargeId: string): Promise<PortalChargeRow | null> {
    // O filtro por customerId é o isolamento (§46): cobrança de outro cliente "não existe".
    const r = await this.prisma.raw.charge.findFirst({ where: { id: chargeId, customerId }, select: CHARGE_SELECT });
    return r ? this.row(r) : null;
  }

  async profile(customerId: string) {
    const c = await this.prisma.raw.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { name: true, cpf: true, email: true, phone: true, whatsapp: true, street: true, streetNumber: true, complement: true, district: true, city: true, state: true, postalCode: true, cnhExpiresAt: true, status: true },
    });
    return c ? { ...c, cnhExpiresAt: ymd(c.cnhExpiresAt) } : null;
  }

  async doneMaintenance(motorcycleId: string, since: Date) {
    const rows = await this.prisma.raw.maintenanceRecord.findMany({
      where: { motorcycleId, status: 'DONE', deletedAt: null, completedAt: { gte: since } },
      select: { completedAt: true, types: { select: { type: { select: { name: true } } } } },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => ({ date: ymd(r.completedAt!), types: r.types.map((t) => t.type.name) }));
  }
}
