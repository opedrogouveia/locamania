import type { MaintenanceDueStatus, MaintenanceStatus } from '../enums';
import type { Ymd } from '../utils/dates';
import type { MoneyString } from '../utils/money';
import type { PaginationQuery } from './common';

export interface MaintenanceTypeDto {
  id: string;
  code: string;
  name: string;
  defaultIntervalKm: number | null;
  defaultIntervalDays: number | null;
  active: boolean;
  sortOrder: number;
}

export interface UpsertMaintenanceTypeRequest {
  name: string;
  defaultIntervalKm?: number | null;
  defaultIntervalDays?: number | null;
  active?: boolean;
  sortOrder?: number;
}

export interface MaintenanceDueDto {
  status: MaintenanceDueStatus;
  kmRemaining: number | null;
  daysRemaining: number | null;
  trigger: 'KM' | 'DATE' | null;
}

export interface MaintenancePlanDto {
  id: string;
  motorcycle: { id: string; plate: string; label: string; currentKm: number; status: string };
  type: { id: string; name: string };
  intervalKm: number | null;
  intervalDays: number | null;
  lastDoneKm: number | null;
  lastDoneAt: Ymd | null;
  nextDueKm: number | null;
  nextDueDate: Ymd | null;
  due: MaintenanceDueDto;
  active: boolean;
  /** Cliente com a moto no momento (para avisar). */
  renter: { id: string; name: string } | null;
}

export interface UpsertMaintenancePlanRequest {
  typeId: string;
  intervalKm?: number | null;
  intervalDays?: number | null;
  lastDoneKm?: number | null;
  lastDoneAt?: Ymd | null;
  /** Se omitidos, calculados a partir do último serviço + intervalo. */
  nextDueKm?: number | null;
  nextDueDate?: Ymd | null;
  active?: boolean;
}

export interface MaintenanceRecordDto {
  id: string;
  motorcycle: { id: string; plate: string; label: string };
  status: MaintenanceStatus;
  types: { id: string; name: string }[];
  scheduledFor: Ymd | null;
  startedAt: Ymd | null;
  completedAt: Ymd | null;
  km: number | null;
  workshop: string | null;
  parts: string | null;
  /** Nulo sem `finance.view`. */
  cost: MoneyString | null;
  notes: string | null;
  documentsCount: number;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateMaintenanceRecordRequest {
  motorcycleId: string;
  typeIds: string[];
  status: MaintenanceStatus;
  scheduledFor?: Ymd | null;
  startedAt?: Ymd | null;
  completedAt?: Ymd | null;
  km?: number | null;
  workshop?: string | null;
  parts?: string | null;
  cost?: string | number | null;
  notes?: string | null;
  /** Ao iniciar, deixar a moto "Em manutenção". Padrão: true se não estiver alugada. */
  setMotorcycleInMaintenance?: boolean;
}

export type UpdateMaintenanceRecordRequest = Partial<Omit<CreateMaintenanceRecordRequest, 'motorcycleId'>>;

/** Concluir: recalcula o próximo intervalo dos planos dos tipos realizados. */
export interface CompleteMaintenanceRequest {
  completedAt: Ymd;
  km: number;
  cost?: string | number | null;
  workshop?: string | null;
  parts?: string | null;
  notes?: string | null;
  /** Para onde a moto vai depois (se estava em manutenção). */
  nextMotorcycleStatus?: 'AVAILABLE' | 'RENTED' | null;
}

export type MaintenanceTab = 'upcoming' | 'overdue' | 'in_progress' | 'done';

export interface ListMaintenanceQuery extends PaginationQuery {
  motorcycleId?: string;
  from?: Ymd;
  to?: Ymd;
}

export interface MaintenanceOverviewDto {
  upcoming: number;
  overdue: number;
  inProgress: number;
  scheduled: number;
  doneLast30Days: number;
  costLast30Days: MoneyString | null;
}
