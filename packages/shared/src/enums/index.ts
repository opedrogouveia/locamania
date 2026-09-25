/**
 * Enums compartilhados — espelham 1:1 os enums do Postgres/Prisma
 * (backend/prisma/schema.prisma). Fonte da verdade dos valores.
 *
 * Padrão: objeto `as const` (valor em runtime) + união de literais de mesmo
 * nome, evitando as armadilhas de `enum` do TypeScript. Os rótulos em pt-BR
 * ficam em `labels.ts`, num lugar só, para renomear na tela sem mexer em dado.
 */

const values = <T extends string>(obj: Record<T, T>) => Object.values(obj) as T[];

export const StaffRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  FINANCE: 'FINANCE',
  STAFF: 'STAFF',
} as const;
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];
export const STAFF_ROLES = values(StaffRole);

export const CustomerStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  OVERDUE: 'OVERDUE',
  CONTRACT_ENDED: 'CONTRACT_ENDED',
  BLOCKED: 'BLOCKED',
} as const;
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];
export const CUSTOMER_STATUSES = values(CustomerStatus);

/** Situações que a administradora define à mão; as demais são calculadas. */
export const CustomerManualStatus = {
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
} as const;
export type CustomerManualStatus = (typeof CustomerManualStatus)[keyof typeof CustomerManualStatus];

export const CnhCategory = {
  A: 'A',
  B: 'B',
  AB: 'AB',
  ACC: 'ACC',
  C: 'C',
  D: 'D',
  E: 'E',
  AC: 'AC',
  AD: 'AD',
  AE: 'AE',
} as const;
export type CnhCategory = (typeof CnhCategory)[keyof typeof CnhCategory];
export const CNH_CATEGORIES = values(CnhCategory);

export const MotorcycleStatus = {
  AVAILABLE: 'AVAILABLE',
  RENTED: 'RENTED',
  RESERVED: 'RESERVED',
  MAINTENANCE: 'MAINTENANCE',
  BLOCKED: 'BLOCKED',
  INACTIVE: 'INACTIVE',
} as const;
export type MotorcycleStatus = (typeof MotorcycleStatus)[keyof typeof MotorcycleStatus];
export const MOTORCYCLE_STATUSES = values(MotorcycleStatus);

export const ContractStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];
export const CONTRACT_STATUSES = values(ContractStatus);

export const SignatureStatus = {
  PENDING: 'PENDING',
  SIGNED: 'SIGNED',
} as const;
export type SignatureStatus = (typeof SignatureStatus)[keyof typeof SignatureStatus];

export const SignatureMethod = {
  IN_PERSON: 'IN_PERSON',
  ELECTRONIC_ACCEPTANCE: 'ELECTRONIC_ACCEPTANCE',
  PROVIDER: 'PROVIDER',
} as const;
export type SignatureMethod = (typeof SignatureMethod)[keyof typeof SignatureMethod];

export const PaymentPeriodicity = {
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
} as const;
export type PaymentPeriodicity = (typeof PaymentPeriodicity)[keyof typeof PaymentPeriodicity];
export const PAYMENT_PERIODICITIES = values(PaymentPeriodicity);

export const ChargeKind = {
  RENT: 'RENT',
  DEPOSIT: 'DEPOSIT',
  FINE: 'FINE',
  DAMAGE: 'DAMAGE',
  OTHER: 'OTHER',
} as const;
export type ChargeKind = (typeof ChargeKind)[keyof typeof ChargeKind];
export const CHARGE_KINDS = values(ChargeKind);

/** Situação gravada no banco. */
export const ChargeStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;
export type ChargeStatus = (typeof ChargeStatus)[keyof typeof ChargeStatus];

/**
 * Situação exibida (§11 dos requisitos): calculada na leitura a partir da
 * gravada + data de hoje + parâmetros. "Próximo do vencimento" não é gravado
 * porque envelheceria sozinho.
 */
export const ChargeDisplayStatus = {
  PAID: 'PAID',
  UPCOMING: 'UPCOMING',
  DUE_SOON: 'DUE_SOON',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;
export type ChargeDisplayStatus = (typeof ChargeDisplayStatus)[keyof typeof ChargeDisplayStatus];
export const CHARGE_DISPLAY_STATUSES = values(ChargeDisplayStatus);

export const PaymentMethod = {
  PIX: 'PIX',
  CASH: 'CASH',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  BOLETO: 'BOLETO',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
export const PAYMENT_METHODS = values(PaymentMethod);

export const MaintenanceStatus = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;
export type MaintenanceStatus = (typeof MaintenanceStatus)[keyof typeof MaintenanceStatus];
export const MAINTENANCE_STATUSES = values(MaintenanceStatus);

/** Situação de um plano de manutenção — sempre calculada. */
export const MaintenanceDueStatus = {
  OK: 'OK',
  DUE_SOON: 'DUE_SOON',
  OVERDUE: 'OVERDUE',
} as const;
export type MaintenanceDueStatus = (typeof MaintenanceDueStatus)[keyof typeof MaintenanceDueStatus];

export const OccurrenceType = {
  TRAFFIC_FINE: 'TRAFFIC_FINE',
  ACCIDENT: 'ACCIDENT',
  DAMAGE: 'DAMAGE',
  THEFT: 'THEFT',
  MECHANICAL_ISSUE: 'MECHANICAL_ISSUE',
  OTHER: 'OTHER',
} as const;
export type OccurrenceType = (typeof OccurrenceType)[keyof typeof OccurrenceType];
export const OCCURRENCE_TYPES = values(OccurrenceType);

export const OccurrenceStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
} as const;
export type OccurrenceStatus = (typeof OccurrenceStatus)[keyof typeof OccurrenceStatus];
export const OCCURRENCE_STATUSES = values(OccurrenceStatus);

export const OdometerSource = {
  CONTRACT_START: 'CONTRACT_START',
  RETURN: 'RETURN',
  MAINTENANCE: 'MAINTENANCE',
  MANUAL: 'MANUAL',
  CUSTOMER: 'CUSTOMER',
  TRACKER: 'TRACKER',
} as const;
export type OdometerSource = (typeof OdometerSource)[keyof typeof OdometerSource];

export const ReturnCondition = {
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  DAMAGED: 'DAMAGED',
} as const;
export type ReturnCondition = (typeof ReturnCondition)[keyof typeof ReturnCondition];
export const RETURN_CONDITIONS = values(ReturnCondition);

export const FuelLevel = {
  EMPTY: 'EMPTY',
  QUARTER: 'QUARTER',
  HALF: 'HALF',
  THREE_QUARTERS: 'THREE_QUARTERS',
  FULL: 'FULL',
} as const;
export type FuelLevel = (typeof FuelLevel)[keyof typeof FuelLevel];
export const FUEL_LEVELS = values(FuelLevel);

export const DepositOutcome = {
  NONE: 'NONE',
  REFUNDED: 'REFUNDED',
  RETAINED: 'RETAINED',
  PARTIALLY_RETAINED: 'PARTIALLY_RETAINED',
} as const;
export type DepositOutcome = (typeof DepositOutcome)[keyof typeof DepositOutcome];
export const DEPOSIT_OUTCOMES = values(DepositOutcome);

export const DocumentOwnerType = {
  CUSTOMER: 'CUSTOMER',
  MOTORCYCLE: 'MOTORCYCLE',
  CONTRACT: 'CONTRACT',
  MAINTENANCE: 'MAINTENANCE',
  OCCURRENCE: 'OCCURRENCE',
  CHARGE: 'CHARGE',
  RETURN: 'RETURN',
  FINANCIAL_ENTRY: 'FINANCIAL_ENTRY',
} as const;
export type DocumentOwnerType = (typeof DocumentOwnerType)[keyof typeof DocumentOwnerType];
export const DOCUMENT_OWNER_TYPES = values(DocumentOwnerType);

export const FinancialEntryType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;
export type FinancialEntryType = (typeof FinancialEntryType)[keyof typeof FinancialEntryType];

export const NotificationRecipientType = {
  USER: 'USER',
  CUSTOMER: 'CUSTOMER',
} as const;
export type NotificationRecipientType =
  (typeof NotificationRecipientType)[keyof typeof NotificationRecipientType];

export const NotificationSeverity = {
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  DANGER: 'DANGER',
} as const;
export type NotificationSeverity = (typeof NotificationSeverity)[keyof typeof NotificationSeverity];

export const NotificationChannel = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const DeliveryStatus = {
  SENT: 'SENT',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

/**
 * Tipos de notificação. Cada um tem título/descrição no catálogo de eventos
 * (labels.ts) e pode ser ligado/desligado em Configurações › Notificações.
 */
export const NotificationType = {
  // Cliente e equipe
  PAYMENT_REMINDER: 'PAYMENT_REMINDER',
  PAYMENT_DUE_TODAY: 'PAYMENT_DUE_TODAY',
  PAYMENT_OVERDUE: 'PAYMENT_OVERDUE',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  MAINTENANCE_DUE_SOON: 'MAINTENANCE_DUE_SOON',
  MAINTENANCE_OVERDUE: 'MAINTENANCE_OVERDUE',
  CONTRACT_ENDING: 'CONTRACT_ENDING',
  CONTRACT_UPDATED: 'CONTRACT_UPDATED',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  SUPPORT_REPLY: 'SUPPORT_REPLY',
  // Só equipe
  CUSTOMER_DELINQUENT: 'CUSTOMER_DELINQUENT',
  DOCUMENT_EXPIRING: 'DOCUMENT_EXPIRING',
  DOCUMENT_EXPIRED: 'DOCUMENT_EXPIRED',
  MOTORCYCLE_IDLE: 'MOTORCYCLE_IDLE',
  OCCURRENCE_CREATED: 'OCCURRENCE_CREATED',
  SUPPORT_MESSAGE: 'SUPPORT_MESSAGE',
  ODOMETER_REPORTED: 'ODOMETER_REPORTED',
  TRACKER_COMMAND: 'TRACKER_COMMAND',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
export const NOTIFICATION_TYPES = values(NotificationType);

export const SupportMessageStatus = {
  OPEN: 'OPEN',
  ANSWERED: 'ANSWERED',
  CLOSED: 'CLOSED',
} as const;
export type SupportMessageStatus = (typeof SupportMessageStatus)[keyof typeof SupportMessageStatus];

export const AnnouncementAudience = {
  ALL_ACTIVE: 'ALL_ACTIVE',
  SELECTED: 'SELECTED',
} as const;
export type AnnouncementAudience = (typeof AnnouncementAudience)[keyof typeof AnnouncementAudience];

export const TrackerCommandType = {
  BLOCK: 'BLOCK',
  UNBLOCK: 'UNBLOCK',
} as const;
export type TrackerCommandType = (typeof TrackerCommandType)[keyof typeof TrackerCommandType];

export const TrackerCommandStatus = {
  REQUESTED: 'REQUESTED',
  SENT: 'SENT',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  SIMULATED: 'SIMULATED',
} as const;
export type TrackerCommandStatus = (typeof TrackerCommandStatus)[keyof typeof TrackerCommandStatus];

export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  STATUS_CHANGE: 'STATUS_CHANGE',
  EXPORT: 'EXPORT',
  COMMAND: 'COMMAND',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
export const AUDIT_ACTIONS = values(AuditAction);

export const ActorType = {
  USER: 'USER',
  CUSTOMER: 'CUSTOMER',
  SYSTEM: 'SYSTEM',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

/** Unidades federativas — lista fechada (endereço vem do CEP). */
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
export type BrazilianState = (typeof BRAZILIAN_STATES)[number];

/**
 * Grupos do catálogo genérico (CatalogItem). O registro guarda o `code`; a tela
 * mostra o `label`, que a administradora pode renomear sem reescrever histórico.
 */
export const CatalogGroup = {
  MOTORCYCLE_BRAND: 'MOTORCYCLE_BRAND',
  MOTORCYCLE_MODEL: 'MOTORCYCLE_MODEL',
  DOCUMENT_TYPE: 'DOCUMENT_TYPE',
  EXPENSE_CATEGORY: 'EXPENSE_CATEGORY',
  INCOME_CATEGORY: 'INCOME_CATEGORY',
} as const;
export type CatalogGroup = (typeof CatalogGroup)[keyof typeof CatalogGroup];
export const CATALOG_GROUPS = values(CatalogGroup);
