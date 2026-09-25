import type { MaintenanceStatus, MotorcycleStatus, Ymd } from '@locamania/shared';

export const MAINTENANCE_REPOSITORY = Symbol('MaintenanceRepository');

export interface PlanRecord {
  id: string;
  motorcycle: { id: string; plate: string; brandCode: string; modelCode: string; currentKm: number; status: MotorcycleStatus };
  type: { id: string; name: string };
  intervalKm: number | null;
  intervalDays: number | null;
  lastDoneKm: number | null;
  lastDoneAt: Ymd | null;
  nextDueKm: number | null;
  nextDueDate: Ymd | null;
  active: boolean;
  renter: { id: string; name: string } | null;
}

export interface RecordRow {
  id: string;
  motorcycle: { id: string; plate: string; brandCode: string; modelCode: string; status: MotorcycleStatus; currentKm: number };
  status: MaintenanceStatus;
  types: { id: string; name: string }[];
  scheduledFor: Ymd | null;
  startedAt: Ymd | null;
  completedAt: Ymd | null;
  km: number | null;
  workshop: string | null;
  parts: string | null;
  cost: string | null;
  notes: string | null;
  documentsCount: number;
  createdByName: string | null;
  createdAt: Date;
}

export interface RecordWrite {
  typeIds?: string[];
  status?: MaintenanceStatus;
  scheduledFor?: Ymd | null;
  startedAt?: Ymd | null;
  completedAt?: Ymd | null;
  km?: number | null;
  workshop?: string | null;
  parts?: string | null;
  cost?: string | null;
  notes?: string | null;
}

export interface MaintenanceRepository {
  plans(filter: { motorcycleId?: string; activeOnly?: boolean; motorcycleIds?: string[] }): Promise<PlanRecord[]>;
  upsertPlan(motorcycleId: string, typeId: string, data: { intervalKm: number | null; intervalDays: number | null; lastDoneKm: number | null; lastDoneAt: Ymd | null; nextDueKm: number | null; nextDueDate: Ymd | null; active: boolean }): Promise<void>;
  typeById(id: string): Promise<{ id: string; name: string; defaultIntervalKm: number | null; defaultIntervalDays: number | null } | null>;

  records(filter: { status?: MaintenanceStatus[]; motorcycleId?: string; from?: Ymd; to?: Ymd; search?: string; skip: number; take: number }): Promise<{ items: RecordRow[]; total: number }>;
  findRecord(id: string): Promise<RecordRow | null>;
  createRecord(motorcycleId: string, data: RecordWrite & { typeIds: string[]; status: MaintenanceStatus }, userId: string): Promise<string>;
  updateRecord(id: string, data: RecordWrite): Promise<void>;
  /** Conclusão: grava o registro, atualiza os planos dos tipos feitos, registra o km e devolve a moto. */
  complete(id: string, data: { completedAt: Ymd; km: number; cost: string | null; workshop: string | null; parts: string | null; notes: string | null; plans: { planId: string; lastDoneKm: number; lastDoneAt: Ymd; nextDueKm: number | null; nextDueDate: Ymd | null }[]; nextMotorcycleStatus: MotorcycleStatus | null; userId: string }): Promise<void>;
  setMotorcycleStatus(motorcycleId: string, status: MotorcycleStatus, reason: string | null): Promise<void>;
  hasActiveContract(motorcycleId: string): Promise<boolean>;
  countOpenRecords(motorcycleId: string, exceptId?: string): Promise<number>;
  summary(since: Ymd): Promise<{ inProgress: number; scheduled: number; doneCount: number; doneCostCents: number }>;
}
