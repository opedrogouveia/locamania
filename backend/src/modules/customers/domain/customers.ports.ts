import type { CnhCategory, CustomerManualStatus, CustomerStatus, Ymd } from '@locamania/shared';

export const CUSTOMERS_REPOSITORY = Symbol('CustomersRepository');

/** Cliente como vem do banco (datas só-dia já em YYYY-MM-DD). */
export interface CustomerRecord {
  id: string;
  number: number;
  name: string;
  cpf: string;
  rg: string | null;
  birthDate: Ymd | null;
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
  cnhNumber: string | null;
  cnhCategory: CnhCategory | null;
  cnhExpiresAt: Ymd | null;
  status: CustomerStatus;
  manualStatus: CustomerManualStatus | null;
  blockedReason: string | null;
  inCollection: boolean;
  collectionSince: Ymd | null;
  notes: string | null;
  portalEnabled: boolean;
  portalLastLoginAt: Date | null;
  privacyAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CustomerWriteData = Partial<
  Omit<CustomerRecord, 'id' | 'number' | 'status' | 'createdAt' | 'updatedAt' | 'portalLastLoginAt' | 'privacyAcceptedAt'>
> & { name?: string; cpf?: string };

export interface ListCustomersParams {
  skip: number;
  take: number;
  search?: string;
  status?: CustomerStatus;
  inCollection?: boolean;
}

export interface ActiveRental {
  contractId: string;
  motorcycle: { id: string; plate: string; brandCode: string; modelCode: string };
}

export interface MoneySummary {
  count: number;
  cents: number;
}

export interface CustomersRepository {
  list(params: ListCustomersParams): Promise<{ items: CustomerRecord[]; total: number }>;
  findById(id: string): Promise<CustomerRecord | null>;
  findByCpf(cpf: string): Promise<CustomerRecord | null>;
  create(data: CustomerWriteData & { name: string; cpf: string }): Promise<CustomerRecord>;
  update(id: string, data: CustomerWriteData): Promise<CustomerRecord>;
  archive(id: string): Promise<void>;
  setPortal(id: string, enabled: boolean): Promise<void>;

  activeRentals(customerIds: string[]): Promise<Map<string, ActiveRental>>;
  overdueSummary(customerIds: string[], today: Ymd, graceDays: number): Promise<Map<string, MoneySummary>>;
  totals(customerId: string, today: Ymd, graceDays: number): Promise<{ paidCents: number; pendingCents: number; overdueCents: number }>;
  nextCharge(customerId: string): Promise<{ id: string; dueDate: Ymd; amountCents: number } | null>;
  documents(customerId: string): Promise<{ id: string; typeCode: string; expiresAt: Ymd | null }[]>;
  hasActiveContract(customerId: string): Promise<boolean>;

  /** Fatos que definem a situação calculada (§3, §14). */
  statusFacts(customerId: string, today: Ymd, graceDays: number): Promise<{ hasActiveContract: boolean; hasOverdue: boolean; hadContract: boolean }>;
  setStatus(id: string, status: CustomerStatus): Promise<void>;
}
