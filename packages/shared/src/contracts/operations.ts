import type {
  DocumentOwnerType,
  FinancialEntryType,
  OccurrenceStatus,
  OccurrenceType,
  PaymentMethod,
} from '../enums';
import type { ExpiryState } from '../rules/customers';
import type { Ymd } from '../utils/dates';
import type { MoneyString } from '../utils/money';
import type { EntityRef, PaginationQuery } from './common';

// ───────────────────────────── Ocorrências e multas (§22) ─────────────────────────────

export interface OccurrenceDto {
  id: string;
  type: OccurrenceType;
  status: OccurrenceStatus;
  occurredAt: Ymd;
  motorcycle: { id: string; plate: string; label: string } | null;
  customer: EntityRef | null;
  contract: { id: string; number: string } | null;
  description: string;
  /** Nulo sem `payments.view`. */
  amount: MoneyString | null;
  fineNumber: string | null;
  fineDueDate: Ymd | null;
  charge: { id: string; status: string } | null;
  notes: string | null;
  documentsCount: number;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateOccurrenceRequest {
  type: OccurrenceType;
  occurredAt: Ymd;
  motorcycleId?: string | null;
  customerId?: string | null;
  contractId?: string | null;
  description: string;
  amount?: string | number | null;
  fineNumber?: string | null;
  fineDueDate?: Ymd | null;
  status?: OccurrenceStatus;
  notes?: string | null;
}

export type UpdateOccurrenceRequest = Partial<CreateOccurrenceRequest>;

export interface ListOccurrencesQuery extends PaginationQuery {
  type?: OccurrenceType;
  status?: OccurrenceStatus;
  motorcycleId?: string;
  customerId?: string;
}

/** Repassar ao cliente: cria uma cobrança avulsa ligada à ocorrência. */
export interface ChargeOccurrenceRequest {
  amount: string | number;
  dueDate: Ymd;
  description?: string | null;
}

// ───────────────────────────── Documentos e fotos (§20, §21, §24) ─────────────────────────────

export interface DocumentDto {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  ownerLabel: string | null;
  typeCode: string;
  typeLabel: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isImage: boolean;
  expiresAt: Ymd | null;
  expiryState: ExpiryState;
  visibleToCustomer: boolean;
  notes: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

/** Upload em base64 no JSON (arquivos pequenos; a imagem já chega reduzida). */
export interface UploadDocumentRequest {
  ownerType: DocumentOwnerType;
  ownerId: string;
  typeCode: string;
  title?: string | null;
  fileName: string;
  mimeType: string;
  dataBase64: string;
  expiresAt?: Ymd | null;
  visibleToCustomer?: boolean;
  notes?: string | null;
}

export interface UpdateDocumentRequest {
  typeCode?: string;
  title?: string;
  expiresAt?: Ymd | null;
  visibleToCustomer?: boolean;
  notes?: string | null;
}

export interface ListDocumentsQuery extends PaginationQuery {
  ownerType?: DocumentOwnerType;
  ownerId?: string;
  typeCode?: string;
  expiry?: 'EXPIRING' | 'EXPIRED';
}

/** Vencimentos acompanhados: documentos com validade + CNH dos clientes. */
export interface ExpiringItemDto {
  kind: 'DOCUMENT' | 'CNH';
  id: string;
  title: string;
  owner: { type: DocumentOwnerType; id: string; label: string };
  expiresAt: Ymd;
  daysRemaining: number;
  state: ExpiryState;
}

// ───────────────────────────── Financeiro (§25) ─────────────────────────────

export interface FinancialEntryDto {
  id: string;
  type: FinancialEntryType;
  categoryCode: string;
  categoryLabel: string;
  description: string;
  amount: MoneyString;
  date: Ymd;
  motorcycle: { id: string; plate: string } | null;
  customer: EntityRef | null;
  supplier: string | null;
  method: PaymentMethod | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateFinancialEntryRequest {
  type: FinancialEntryType;
  categoryCode: string;
  description: string;
  amount: string | number;
  date: Ymd;
  motorcycleId?: string | null;
  customerId?: string | null;
  supplier?: string | null;
  method?: PaymentMethod | null;
}

export type UpdateFinancialEntryRequest = Partial<CreateFinancialEntryRequest>;

export interface ListFinancialEntriesQuery extends PaginationQuery {
  type?: FinancialEntryType;
  categoryCode?: string;
  motorcycleId?: string;
  from?: Ymd;
  to?: Ymd;
}

export interface FinanceQuery {
  from: Ymd;
  to: Ymd;
}

export interface FinanceSummaryDto {
  period: { from: Ymd; to: Ymd };
  received: MoneyString;
  receivedCount: number;
  pending: MoneyString;
  pendingCount: number;
  overdue: MoneyString;
  overdueCount: number;
  maintenanceExpenses: MoneyString;
  otherExpenses: MoneyString;
  otherIncome: MoneyString;
  result: MoneyString;
  /** Série para o gráfico: dia (períodos curtos), semana ou mês. */
  series: { label: string; start: Ymd; income: MoneyString; expense: MoneyString }[];
  byMotorcycle: { id: string; plate: string; label: string; income: MoneyString; expense: MoneyString; result: MoneyString }[];
  byCustomer: { id: string; name: string; paid: MoneyString; overdue: MoneyString }[];
  expensesByCategory: { code: string; label: string; amount: MoneyString }[];
}
