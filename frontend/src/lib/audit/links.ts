/** Ficha de cada entidade do histórico (`entityType` = model do Prisma). */
const FICHA: Record<string, (id: string) => string> = {
  Customer: (id) => `/admin/customers/${id}`,
  Motorcycle: (id) => `/admin/motorcycles/${id}`,
  Contract: (id) => `/admin/contracts/${id}`,
  Occurrence: (id) => `/admin/occurrences/${id}`,
};

export function auditEntityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  return FICHA[entityType]?.(entityId) ?? null;
}

/**
 * Tipos oferecidos no filtro "O quê" (os que aparecem no histórico, na ordem de
 * uso). O rótulo vem de ENTITY_LABELS do shared.
 */
export const AUDIT_ENTITY_TYPES = [
  'Customer',
  'Motorcycle',
  'Contract',
  'Charge',
  'MaintenanceRecord',
  'MaintenancePlan',
  'Occurrence',
  'ReturnInspection',
  'Document',
  'FinancialEntry',
  'OdometerReading',
  'Announcement',
  'SupportMessage',
  'TrackerCommand',
  'User',
  'RolePermission',
  'CatalogItem',
  'MaintenanceType',
  'AppParameter',
  'CompanySettings',
  'Report',
] as const;
