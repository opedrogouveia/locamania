import type { ChargeDisplayStatus, ChargeKind, ChargeStatus, PaymentMethod } from '../enums';
import type { Ymd } from '../utils/dates';
import type { MoneyString } from '../utils/money';
import type { EntityRef, PaginationQuery } from './common';

export interface ChargeDto {
  id: string;
  number: string;
  kind: ChargeKind;
  sequence: number | null;
  description: string;
  customer: EntityRef;
  contract: { id: string; number: string } | null;
  motorcycle: { id: string; plate: string } | null;
  periodStart: Ymd | null;
  periodEnd: Ymd | null;
  dueDate: Ymd;
  amount: MoneyString;
  status: ChargeStatus;
  displayStatus: ChargeDisplayStatus;
  paidAt: string | null;
  paidAmount: MoneyString | null;
  fineAmount: MoneyString | null;
  interestAmount: MoneyString | null;
  discountAmount: MoneyString | null;
  method: PaymentMethod | null;
  notes: string | null;
  /** Encargos se pagasse hoje (só para cobranças em aberto). */
  lateFees: { daysLate: number; fine: MoneyString; interest: MoneyString; total: MoneyString } | null;
  receiptDocumentId: string | null;
  registeredBy: string | null;
  confirmedByGateway: boolean;
  createdAt: string;
}

export interface ListChargesQuery extends PaginationQuery {
  status?: ChargeDisplayStatus;
  kind?: ChargeKind;
  customerId?: string;
  contractId?: string;
  motorcycleId?: string;
  dueFrom?: Ymd;
  dueTo?: Ymd;
  paidFrom?: Ymd;
  paidTo?: Ymd;
}

export interface ChargesSummaryDto {
  byStatus: Record<ChargeDisplayStatus, { count: number; amount: MoneyString }>;
  dueToday: { count: number; amount: MoneyString };
}

export interface RegisterPaymentRequest {
  paidAt: Ymd;
  paidAmount: string | number;
  method: PaymentMethod;
  fineAmount?: string | number | null;
  interestAmount?: string | number | null;
  discountAmount?: string | number | null;
  notes?: string | null;
  receiptDocumentId?: string | null;
}

export interface CreateChargeRequest {
  customerId: string;
  contractId?: string | null;
  motorcycleId?: string | null;
  kind: ChargeKind;
  description: string;
  dueDate: Ymd;
  amount: string | number;
}

export interface CancelChargeRequest {
  reason: string;
}

/** Estorno: a cobrança volta a ficar em aberto. */
export interface ReversePaymentRequest {
  reason: string;
}

export interface DelinquentCustomerDto {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    whatsapp: string | null;
    status: string;
    inCollection: boolean;
  };
  motorcycle: { id: string; plate: string; label: string } | null;
  overdueCount: number;
  overdueAmount: MoneyString;
  totalWithFees: MoneyString;
  oldestDueDate: Ymd;
  daysLate: number;
  /** Mensagem de cobrança pronta no WhatsApp (link oficial wa.me). */
  whatsappLink: string | null;
}

/** PIX gerado pelo gateway para o cliente pagar (§13). */
export interface PixPaymentDto {
  chargeId: string;
  provider: string;
  amount: MoneyString;
  pixCode: string;
  qrCodeDataUrl: string;
  expiresAt: string;
  /** Ambiente de testes: nenhum valor é cobrado. */
  sandbox: boolean;
}
