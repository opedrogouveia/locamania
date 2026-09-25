import type { MotorcycleStatus, OdometerSource, Ymd } from '@locamania/shared';

export const MOTORCYCLES_REPOSITORY = Symbol('MotorcyclesRepository');

export interface MotorcycleRecord {
  id: string;
  brandCode: string;
  modelCode: string;
  manufactureYear: number | null;
  modelYear: number | null;
  color: string | null;
  plate: string;
  renavam: string | null;
  chassis: string | null;
  currentKm: number;
  acquiredAt: Ymd | null;
  purchasePriceCents: number | null;
  status: MotorcycleStatus;
  statusReason: string | null;
  availableSince: Date | null;
  hasTracker: boolean;
  trackerProvider: string | null;
  trackerDeviceId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MotorcycleWriteData {
  brandCode?: string;
  modelCode?: string;
  manufactureYear?: number | null;
  modelYear?: number | null;
  color?: string | null;
  plate?: string;
  renavam?: string | null;
  chassis?: string | null;
  currentKm?: number;
  acquiredAt?: Ymd | null;
  purchasePrice?: string | null;
  hasTracker?: boolean;
  trackerProvider?: string | null;
  trackerDeviceId?: string | null;
  notes?: string | null;
}

export interface PlanForDue {
  motorcycleId: string;
  typeName: string;
  nextDueKm: number | null;
  nextDueDate: Ymd | null;
}

export interface CurrentRental {
  contractId: string;
  customerId: string;
  customerName: string;
}

export interface OdometerRecord {
  id: string;
  km: number;
  readAt: Date;
  source: OdometerSource;
  notes: string | null;
  recordedBy: string | null;
}

export interface MotorcycleHistoryRecord {
  id: string;
  date: Date;
  kind: 'RENTAL_START' | 'RENTAL_END' | 'MAINTENANCE' | 'OCCURRENCE' | 'ODOMETER' | 'EXPENSE' | 'STATUS';
  title: string;
  description: string | null;
  link: string | null;
}

export interface ListMotorcyclesParams {
  skip: number;
  take: number;
  search?: string;
  modelCodes?: string[];
  status?: MotorcycleStatus;
  ids?: string[];
}

export interface MotorcyclesRepository {
  list(params: ListMotorcyclesParams): Promise<{ items: MotorcycleRecord[]; total: number }>;
  /** Ids de todas as motos ativas (para filtros calculados, como manutenção). */
  allIds(status?: MotorcycleStatus): Promise<string[]>;
  findById(id: string): Promise<MotorcycleRecord | null>;
  findByPlate(plate: string): Promise<MotorcycleRecord | null>;
  create(data: MotorcycleWriteData & { brandCode: string; modelCode: string; plate: string; currentKm: number }, plans: { typeId: string; intervalKm: number | null; intervalDays: number | null; nextDueKm: number | null; nextDueDate: Ymd | null; lastDoneKm: number; lastDoneAt: Ymd }[], userId: string): Promise<MotorcycleRecord>;
  update(id: string, data: MotorcycleWriteData): Promise<MotorcycleRecord>;
  setStatus(id: string, status: MotorcycleStatus, reason: string | null): Promise<MotorcycleRecord>;
  archive(id: string): Promise<void>;

  plansForDue(ids: string[]): Promise<PlanForDue[]>;
  currentRentals(ids: string[]): Promise<Map<string, CurrentRental>>;
  hasOpenContract(id: string): Promise<boolean>;

  odometer(id: string, take: number): Promise<OdometerRecord[]>;
  addOdometer(id: string, km: number, source: OdometerSource, notes: string | null, actor: { userId?: string; customerId?: string; contractId?: string }): Promise<void>;
  lastOdometerAt(id: string): Promise<Date | null>;

  history(id: string): Promise<MotorcycleHistoryRecord[]>;
  maintenanceTypes(): Promise<{ id: string; defaultIntervalKm: number | null; defaultIntervalDays: number | null; active: boolean }[]>;
}
