import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { SearchQuery } from '../application/search.service';

const LIMIT = 8;

@Injectable()
export class PrismaSearchQuery implements SearchQuery {
  constructor(private readonly prisma: PrismaService) {}

  customers(term: string, digits: string) {
    return this.prisma.raw.customer.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }, { whatsapp: { contains: digits } }] : []),
        ],
      },
      select: { id: true, name: true, cpf: true, phone: true, status: true },
      orderBy: { name: 'asc' },
      take: LIMIT,
    });
  }

  motorcycles(plate: string, modelCodes: string[]) {
    return this.prisma.raw.motorcycle.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(plate.length >= 2 ? [{ plate: { contains: plate } }] : []),
          ...(modelCodes.length ? [{ modelCode: { in: modelCodes } }, { brandCode: { in: modelCodes } }] : []),
        ],
      },
      select: { id: true, plate: true, brandCode: true, modelCode: true, status: true },
      orderBy: { plate: 'asc' },
      take: LIMIT,
    });
  }

  async contracts(term: string) {
    const rows = await this.prisma.raw.contract.findMany({
      where: { deletedAt: null, number: { contains: term.toUpperCase() } },
      select: { id: true, number: true, status: true, customer: { select: { name: true } }, motorcycle: { select: { plate: true } } },
      orderBy: { seq: 'desc' },
      take: LIMIT,
    });
    return rows.map((r) => ({ id: r.id, number: r.number, status: r.status, customerName: r.customer.name, plate: r.motorcycle.plate }));
  }
}
