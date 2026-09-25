import { Injectable } from '@nestjs/common';
import type { CatalogGroup } from '@locamania/shared';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  CatalogRecord,
  CompanyRecord,
  MaintenanceTypeRecord,
  SettingsRepository,
} from '../domain/settings.ports';
import { DEFAULT_CONTRACT_TEMPLATE } from '../../contracts/domain/contract-template';

const COMPANY_ID = 'company';

@Injectable()
export class PrismaSettingsRepository implements SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async company(): Promise<CompanyRecord> {
    const row = await this.prisma.client.companySettings.findUnique({ where: { id: COMPANY_ID } });
    if (row) return row;
    // Primeira execução sem seed: cria o registro com o modelo padrão.
    return this.prisma.client.companySettings.create({
      data: { id: COMPANY_ID, tradeName: 'Locamania', contractTemplate: DEFAULT_CONTRACT_TEMPLATE },
    });
  }

  async updateCompany(data: Partial<Omit<CompanyRecord, 'updatedAt'>>): Promise<CompanyRecord> {
    await this.company();
    return this.prisma.client.companySettings.update({ where: { id: COMPANY_ID }, data });
  }

  catalog(group: CatalogGroup, includeInactive: boolean): Promise<CatalogRecord[]> {
    return this.prisma.client.catalogItem.findMany({
      where: { group, ...(includeInactive ? {} : { active: true }) },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  catalogByCode(group: CatalogGroup, code: string): Promise<CatalogRecord | null> {
    return this.prisma.client.catalogItem.findUnique({ where: { group_code: { group, code } } });
  }

  createCatalogItem(data: { group: CatalogGroup; code: string; label: string; sortOrder: number; userCreated: boolean }): Promise<CatalogRecord> {
    return this.prisma.client.catalogItem.create({ data });
  }

  updateCatalogItem(id: string, data: { label?: string; sortOrder?: number; active?: boolean }): Promise<CatalogRecord> {
    return this.prisma.client.catalogItem.update({ where: { id }, data });
  }

  async maxCatalogOrder(group: CatalogGroup): Promise<number> {
    const agg = await this.prisma.client.catalogItem.aggregate({ where: { group }, _max: { sortOrder: true } });
    return agg._max.sortOrder ?? 0;
  }

  maintenanceTypes(includeInactive: boolean): Promise<MaintenanceTypeRecord[]> {
    return this.prisma.client.maintenanceType.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true, defaultIntervalKm: true, defaultIntervalDays: true, active: true, sortOrder: true },
    });
  }

  maintenanceTypeByCode(code: string): Promise<MaintenanceTypeRecord | null> {
    return this.prisma.client.maintenanceType.findUnique({ where: { code } });
  }

  createMaintenanceType(data: Omit<MaintenanceTypeRecord, 'id'>): Promise<MaintenanceTypeRecord> {
    return this.prisma.client.maintenanceType.create({ data });
  }

  updateMaintenanceType(id: string, data: Partial<Omit<MaintenanceTypeRecord, 'id' | 'code'>>): Promise<MaintenanceTypeRecord> {
    return this.prisma.client.maintenanceType.update({ where: { id }, data });
  }
}
