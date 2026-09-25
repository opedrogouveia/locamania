import type { OccurrenceStatus, OccurrenceType, Ymd } from '@locamania/shared';

export const OCCURRENCES_REPOSITORY = Symbol('OccurrencesRepository');

export interface OccurrenceRecord {
  id: string;
  type: OccurrenceType;
  status: OccurrenceStatus;
  occurredAt: Ymd;
  motorcycle: { id: string; plate: string; brandCode: string; modelCode: string } | null;
  customer: { id: string; name: string } | null;
  contract: { id: string; number: string } | null;
  description: string;
  amount: string | null;
  fineNumber: string | null;
  fineDueDate: Ymd | null;
  charge: { id: string; status: string } | null;
  notes: string | null;
  documentsCount: number;
  createdByName: string | null;
  createdAt: Date;
}

export interface OccurrenceWrite {
  type?: OccurrenceType;
  status?: OccurrenceStatus;
  occurredAt?: Ymd;
  motorcycleId?: string | null;
  customerId?: string | null;
  contractId?: string | null;
  description?: string;
  amount?: string | null;
  fineNumber?: string | null;
  fineDueDate?: Ymd | null;
  notes?: string | null;
}

export interface OccurrencesRepository {
  list(f: { type?: OccurrenceType; status?: OccurrenceStatus; motorcycleId?: string; customerId?: string; search?: string; skip: number; take: number }): Promise<{ items: OccurrenceRecord[]; total: number }>;
  findById(id: string): Promise<OccurrenceRecord | null>;
  create(data: OccurrenceWrite & { type: OccurrenceType; occurredAt: Ymd; description: string }, userId: string): Promise<string>;
  update(id: string, data: OccurrenceWrite): Promise<void>;
  archive(id: string): Promise<void>;
  /** Contrato ativo na data (para ligar a ocorrência a quem estava com a moto). */
  contractOn(motorcycleId: string, date: Ymd): Promise<{ id: string; customerId: string } | null>;
}
