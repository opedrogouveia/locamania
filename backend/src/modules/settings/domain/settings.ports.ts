import type { CatalogGroup } from '@locamania/shared';

export const SETTINGS_REPOSITORY = Symbol('SettingsRepository');

export interface CompanyRecord {
  tradeName: string;
  legalName: string | null;
  cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  postalCode: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  pixKey: string | null;
  supportHours: string | null;
  contractTemplate: string;
  updatedAt: Date;
}

export interface CatalogRecord {
  id: string;
  group: string;
  code: string;
  label: string;
  sortOrder: number;
  active: boolean;
  userCreated: boolean;
}

export interface MaintenanceTypeRecord {
  id: string;
  code: string;
  name: string;
  defaultIntervalKm: number | null;
  defaultIntervalDays: number | null;
  active: boolean;
  sortOrder: number;
}

export interface SettingsRepository {
  company(): Promise<CompanyRecord>;
  updateCompany(data: Partial<Omit<CompanyRecord, 'updatedAt'>>): Promise<CompanyRecord>;

  catalog(group: CatalogGroup, includeInactive: boolean): Promise<CatalogRecord[]>;
  catalogByCode(group: CatalogGroup, code: string): Promise<CatalogRecord | null>;
  createCatalogItem(data: { group: CatalogGroup; code: string; label: string; sortOrder: number; userCreated: boolean }): Promise<CatalogRecord>;
  updateCatalogItem(id: string, data: { label?: string; sortOrder?: number; active?: boolean }): Promise<CatalogRecord>;
  maxCatalogOrder(group: CatalogGroup): Promise<number>;

  maintenanceTypes(includeInactive: boolean): Promise<MaintenanceTypeRecord[]>;
  maintenanceTypeByCode(code: string): Promise<MaintenanceTypeRecord | null>;
  createMaintenanceType(data: Omit<MaintenanceTypeRecord, 'id'>): Promise<MaintenanceTypeRecord>;
  updateMaintenanceType(id: string, data: Partial<Omit<MaintenanceTypeRecord, 'id' | 'code'>>): Promise<MaintenanceTypeRecord>;
}
