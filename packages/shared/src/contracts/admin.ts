import type {
  ActorType,
  AuditAction,
  CatalogGroup,
  TrackerCommandStatus,
  TrackerCommandType,
} from '../enums';
import type { ParameterGroup, ParameterValueType } from '../parameters';
import type { Ymd } from '../utils/dates';
import type { MoneyString } from '../utils/money';
import type { PaginationQuery } from './common';

// ───────────────────────────── Configurações (§42) ─────────────────────────────

export interface CompanySettingsDto {
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
  updatedAt: string;
}

export type UpdateCompanySettingsRequest = Partial<Omit<CompanySettingsDto, 'updatedAt'>>;

export interface ParameterDto {
  key: string;
  group: ParameterGroup;
  label: string;
  description: string | null;
  valueType: ParameterValueType;
  value: string;
  defaultValue: string;
  min: number | null;
  max: number | null;
}

export interface UpdateParameterRequest {
  value: string;
}

export interface CatalogItemDto {
  id: string;
  group: CatalogGroup;
  code: string;
  label: string;
  sortOrder: number;
  active: boolean;
  userCreated: boolean;
}

export interface CreateCatalogItemRequest {
  group: CatalogGroup;
  label: string;
  /** Opcional: gerado a partir do rótulo. */
  code?: string;
  sortOrder?: number;
}

export interface UpdateCatalogItemRequest {
  label?: string;
  sortOrder?: number;
  active?: boolean;
}

export interface IntegrationStatusDto {
  key: 'payments' | 'whatsapp' | 'email' | 'tracker' | 'signature' | 'sentry';
  label: string;
  provider: string;
  configured: boolean;
  sandbox: boolean;
  description: string;
}

export interface JobRunDto {
  id: string;
  name: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown> | null;
  trigger: string;
}

// ───────────────────────────── Dashboard (§2.1) ─────────────────────────────

export interface DashboardAlertDto {
  id: string;
  severity: 'DANGER' | 'WARNING' | 'SUCCESS' | 'INFO';
  kind: string;
  title: string;
  description: string;
  link: string;
  date: string | null;
}

export interface DashboardDto {
  today: Ymd;
  fleet: {
    total: number;
    rented: number;
    available: number;
    reserved: number;
    maintenance: number;
    blocked: number;
    inactive: number;
  };
  customers: { active: number; delinquent: number; inCollection: number; total: number };
  payments: {
    dueToday: { count: number; amount: MoneyString | null };
    dueNextDays: { count: number; amount: MoneyString | null; days: number };
    overdue: { count: number; amount: MoneyString | null };
    receivedThisMonth: MoneyString | null;
  };
  contractsEndingSoon: number;
  maintenanceDueSoon: number;
  maintenanceOverdue: number;
  documentsExpiring: number;
  alerts: DashboardAlertDto[];
  /** Receita das últimas semanas (nulo sem `finance.view`). */
  revenueTrend: { label: string; start: Ymd; amount: MoneyString }[] | null;
}

// ───────────────────────────── Pesquisa (§27) ─────────────────────────────

export interface SearchResultDto {
  type: 'customer' | 'motorcycle' | 'contract';
  id: string;
  title: string;
  subtitle: string;
  link: string;
  /** Placa ou nº de contrato idêntico ao pesquisado: abre direto. */
  exact: boolean;
}

// ───────────────────────────── Relatórios (§26) ─────────────────────────────

export type ReportKey = 'fleet' | 'customers' | 'finance' | 'maintenance' | 'rentals';

export interface ReportQuery {
  from?: Ymd;
  to?: Ymd;
}

export interface ReportTableDto {
  key: ReportKey;
  title: string;
  subtitle: string;
  generatedAt: string;
  summary: { label: string; value: string }[];
  sections: {
    title: string;
    columns: { key: string; label: string; align?: 'left' | 'right' }[];
    rows: Record<string, string | number | null>[];
  }[];
}

// ───────────────────────────── Histórico / auditoria (§30) ─────────────────────────────

export interface AuditLogDto {
  id: string;
  occurredAt: string;
  actorType: ActorType;
  actorId: string | null;
  actorName: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  /** Frase pronta: "Maria alterou o valor do aluguel do contrato LOC-2026-0012". */
  summary: string;
  changedFields: { field: string; label: string; from?: unknown; to?: unknown }[];
  ip: string | null;
}

export interface ListAuditQuery extends PaginationQuery {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: AuditAction;
  from?: Ymd;
  to?: Ymd;
}

// ───────────────────────────── Rastreamento (§31, §32) ─────────────────────────────

export interface TrackerCapabilitiesDto {
  location: boolean;
  odometer: boolean;
  block: boolean;
}

export interface TrackerStatusDto {
  motorcycle: { id: string; plate: string; label: string; status: string };
  provider: string;
  deviceId: string | null;
  sandbox: boolean;
  capabilities: TrackerCapabilitiesDto;
  online: boolean;
  lastCommunicationAt: string | null;
  position: { lat: number; lng: number; speedKmh: number | null; recordedAt: string } | null;
  mapUrl: string | null;
  lastCommand: TrackerCommandDto | null;
}

export interface TrackerCommandDto {
  id: string;
  type: TrackerCommandType;
  status: TrackerCommandStatus;
  reason: string;
  requestedBy: string | null;
  requestedAt: string;
  providerResponse: string | null;
}

/** Bloqueio seguro: motivo obrigatório e confirmação digitando a placa. */
export interface TrackerCommandRequest {
  type: TrackerCommandType;
  reason: string;
  confirmPlate: string;
}
