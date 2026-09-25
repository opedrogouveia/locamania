import type { FinancialEntryType, PaymentMethod, Ymd } from '@locamania/shared';

export const FINANCE_REPOSITORY = Symbol('FinanceRepository');

export interface EntryRecord {
  id: string;
  type: FinancialEntryType;
  categoryCode: string;
  description: string;
  amount: string;
  date: Ymd;
  motorcycle: { id: string; plate: string } | null;
  customer: { id: string; name: string } | null;
  supplier: string | null;
  method: PaymentMethod | null;
  createdByName: string | null;
  createdAt: Date;
}

export interface EntryWrite {
  type?: FinancialEntryType;
  categoryCode?: string;
  description?: string;
  amount?: string;
  date?: Ymd;
  motorcycleId?: string | null;
  customerId?: string | null;
  supplier?: string | null;
  method?: PaymentMethod | null;
}

/** Fatos brutos do período; a agregação (série, rankings) é feita na application. */
export interface PeriodFacts {
  payments: { paidAt: Date; cents: number; motorcycleId: string | null; customerId: string; customerName: string; kind: string }[];
  maintenance: { date: Ymd; cents: number; motorcycleId: string }[];
  entries: { date: Ymd; cents: number; type: FinancialEntryType; categoryCode: string; motorcycleId: string | null }[];
  pending: { count: number; cents: number };
  overdue: { count: number; cents: number; byCustomer: { customerId: string; cents: number }[] };
  motorcycles: Map<string, { plate: string; brandCode: string; modelCode: string }>;
}

export interface FinanceRepository {
  list(f: { type?: FinancialEntryType; categoryCode?: string; motorcycleId?: string; from?: Ymd; to?: Ymd; search?: string; skip: number; take: number }): Promise<{ items: EntryRecord[]; total: number }>;
  findById(id: string): Promise<EntryRecord | null>;
  create(data: Required<Pick<EntryWrite, 'type' | 'categoryCode' | 'description' | 'amount' | 'date'>> & EntryWrite, userId: string): Promise<string>;
  update(id: string, data: EntryWrite): Promise<void>;
  archive(id: string): Promise<void>;
  periodFacts(from: Ymd, to: Ymd, today: Ymd, graceDays: number): Promise<PeriodFacts>;
}
