import type { MaintenanceDueStatus, MotorcycleStatus, OdometerSource } from '../enums';
import type { Ymd } from '../utils/dates';
import type { MoneyString } from '../utils/money';
import type { PaginationQuery } from './common';

export interface MotorcycleListItemDto {
  id: string;
  plate: string;
  brandCode: string;
  brandLabel: string;
  modelCode: string;
  modelLabel: string;
  /** "Honda CG 160 Titan". */
  label: string;
  manufactureYear: number | null;
  modelYear: number | null;
  color: string | null;
  currentKm: number;
  status: MotorcycleStatus;
  statusReason: string | null;
  hasTracker: boolean;
  currentRental: { contractId: string; customerId: string; customerName: string } | null;
  /** Pior situação entre os planos de manutenção. */
  maintenanceDue: MaintenanceDueStatus;
  nextMaintenance: {
    typeName: string;
    kmRemaining: number | null;
    daysRemaining: number | null;
    nextDueDate: Ymd | null;
  } | null;
  /** Dias disponível sem aluguel (só para motos disponíveis). */
  idleDays: number | null;
}

export interface MotorcycleDto extends MotorcycleListItemDto {
  renavam: string | null;
  chassis: string | null;
  acquiredAt: Ymd | null;
  /** Nulo sem `finance.view`. */
  purchasePrice: MoneyString | null;
  trackerProvider: string | null;
  trackerDeviceId: string | null;
  notes: string | null;
  lastOdometerAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMotorcycleRequest {
  brandCode: string;
  modelCode: string;
  plate: string;
  manufactureYear?: number | null;
  modelYear?: number | null;
  color?: string | null;
  renavam?: string | null;
  chassis?: string | null;
  currentKm: number;
  acquiredAt?: Ymd | null;
  purchasePrice?: string | number | null;
  hasTracker?: boolean;
  trackerProvider?: string | null;
  trackerDeviceId?: string | null;
  notes?: string | null;
}

export type UpdateMotorcycleRequest = Partial<Omit<CreateMotorcycleRequest, 'currentKm'>>;

export interface ListMotorcyclesQuery extends PaginationQuery {
  status?: MotorcycleStatus;
  maintenanceDue?: MaintenanceDueStatus;
}

/** Situação manual; "Alugada" e "Reservada" só pelo contrato. */
export interface SetMotorcycleStatusRequest {
  status: 'AVAILABLE' | 'MAINTENANCE' | 'BLOCKED' | 'INACTIVE';
  reason?: string | null;
}

export interface OdometerReadingDto {
  id: string;
  km: number;
  readAt: string;
  source: OdometerSource;
  notes: string | null;
  recordedBy: string | null;
}

export interface CreateOdometerReadingRequest {
  km: number;
  notes?: string | null;
}

/** Linha do tempo da moto (§6): aluguéis, km, manutenção, ocorrências, gastos. */
export interface MotorcycleHistoryItemDto {
  id: string;
  date: string;
  kind: 'RENTAL_START' | 'RENTAL_END' | 'MAINTENANCE' | 'OCCURRENCE' | 'ODOMETER' | 'EXPENSE' | 'STATUS';
  title: string;
  description: string | null;
  link: string | null;
}
