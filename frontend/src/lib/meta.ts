import {
  CHARGE_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  CUSTOMER_STATUS_LABELS,
  MAINTENANCE_DUE_LABELS,
  MAINTENANCE_STATUS_LABELS,
  MOTORCYCLE_STATUS_LABELS,
  OCCURRENCE_STATUS_LABELS,
  SUPPORT_STATUS_LABELS,
  type ChargeDisplayStatus,
  type ContractStatus,
  type CustomerStatus,
  type ExpiryState,
  type MaintenanceDueStatus,
  type MaintenanceStatus,
  type MotorcycleStatus,
  type NotificationSeverity,
  type OccurrenceStatus,
  type SupportMessageStatus,
} from '@locamania/shared';

import type { BadgeProps } from '@/components/ui/badge';

type Variant = NonNullable<BadgeProps['variant']>;

/**
 * Situação → cor do Badge (DESIGN_SYSTEM §6). O rótulo vem do shared; aqui só
 * a variante. Enum novo = um mapa novo aqui.
 */
export const MOTORCYCLE_STATUS_VARIANT: Record<MotorcycleStatus, Variant> = {
  AVAILABLE: 'success',
  RENTED: 'info',
  RESERVED: 'default',
  MAINTENANCE: 'warning',
  BLOCKED: 'destructive',
  INACTIVE: 'muted',
};

export const CHARGE_STATUS_VARIANT: Record<ChargeDisplayStatus, Variant> = {
  PAID: 'success',
  UPCOMING: 'muted',
  DUE_SOON: 'warning',
  OVERDUE: 'destructive',
  CANCELLED: 'outline',
};

export const CUSTOMER_STATUS_VARIANT: Record<CustomerStatus, Variant> = {
  ACTIVE: 'success',
  OVERDUE: 'destructive',
  BLOCKED: 'destructive',
  CONTRACT_ENDED: 'muted',
  INACTIVE: 'muted',
};

export const CONTRACT_STATUS_VARIANT: Record<ContractStatus, Variant> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  ENDED: 'muted',
  CANCELLED: 'outline',
};

export const MAINTENANCE_DUE_VARIANT: Record<MaintenanceDueStatus, Variant> = {
  OK: 'success',
  DUE_SOON: 'warning',
  OVERDUE: 'destructive',
};

export const MAINTENANCE_STATUS_VARIANT: Record<MaintenanceStatus, Variant> = {
  SCHEDULED: 'default',
  IN_PROGRESS: 'warning',
  DONE: 'success',
  CANCELLED: 'outline',
};

export const OCCURRENCE_STATUS_VARIANT: Record<OccurrenceStatus, Variant> = {
  OPEN: 'destructive',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CANCELLED: 'outline',
};

export const SUPPORT_STATUS_VARIANT: Record<SupportMessageStatus, Variant> = {
  OPEN: 'warning',
  ANSWERED: 'success',
  CLOSED: 'muted',
};

export const EXPIRY_VARIANT: Record<ExpiryState, Variant> = {
  VALID: 'success',
  EXPIRING: 'warning',
  EXPIRED: 'destructive',
  UNKNOWN: 'muted',
};

export const EXPIRY_LABELS: Record<ExpiryState, string> = {
  VALID: 'Válido',
  EXPIRING: 'Vencendo',
  EXPIRED: 'Vencido',
  UNKNOWN: 'Sem validade',
};

export const SEVERITY_VARIANT: Record<NotificationSeverity, Variant> = {
  DANGER: 'destructive',
  WARNING: 'warning',
  SUCCESS: 'success',
  INFO: 'info',
};

/** Cor da bolinha (alertas) — tokens, nunca hex. */
export const SEVERITY_DOT: Record<NotificationSeverity, string> = {
  DANGER: 'bg-destructive',
  WARNING: 'bg-warning',
  SUCCESS: 'bg-success',
  INFO: 'bg-info',
};

export const LABELS = {
  motorcycle: MOTORCYCLE_STATUS_LABELS,
  charge: CHARGE_STATUS_LABELS,
  customer: CUSTOMER_STATUS_LABELS,
  contract: CONTRACT_STATUS_LABELS,
  maintenanceDue: MAINTENANCE_DUE_LABELS,
  maintenance: MAINTENANCE_STATUS_LABELS,
  occurrence: OCCURRENCE_STATUS_LABELS,
  support: SUPPORT_STATUS_LABELS,
  expiry: EXPIRY_LABELS,
};
