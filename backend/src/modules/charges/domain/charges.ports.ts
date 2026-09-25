import type { ChargeDisplayStatus, ChargeKind, ChargeRules, ChargeStatus, PaymentMethod, Ymd } from '@locamania/shared';

export const CHARGES_REPOSITORY = Symbol('ChargesRepository');
export const PAYMENT_GATEWAY = Symbol('PaymentGateway');

export interface ChargeRecord {
  id: string;
  number: string;
  kind: ChargeKind;
  sequence: number | null;
  description: string;
  customer: { id: string; name: string; email: string | null; phone: string | null; whatsapp: string | null; cpf: string };
  contract: { id: string; number: string } | null;
  motorcycle: { id: string; plate: string } | null;
  occurrenceId: string | null;
  periodStart: Ymd | null;
  periodEnd: Ymd | null;
  dueDate: Ymd;
  amount: string;
  status: ChargeStatus;
  paidAt: Date | null;
  paidAmount: string | null;
  fineAmount: string | null;
  interestAmount: string | null;
  discountAmount: string | null;
  method: PaymentMethod | null;
  notes: string | null;
  receiptDocumentId: string | null;
  registeredByName: string | null;
  cancelReason: string | null;
  gatewayProvider: string | null;
  gatewayChargeId: string | null;
  gatewayPixCode: string | null;
  gatewayExpiresAt: Date | null;
  gatewayPaidAt: Date | null;
  createdAt: Date;
}

export interface ChargeFilters {
  status?: ChargeDisplayStatus;
  kind?: ChargeKind;
  customerId?: string;
  contractId?: string;
  motorcycleId?: string;
  dueFrom?: Ymd;
  dueTo?: Ymd;
  paidFrom?: Ymd;
  paidTo?: Ymd;
  search?: string;
}

export interface DelinquentRow {
  customerId: string;
  charges: { amount: string; dueDate: Ymd }[];
}

export interface ChargesRepository {
  list(filters: ChargeFilters, today: Ymd, rules: ChargeRules, page: { skip: number; take: number }): Promise<{ items: ChargeRecord[]; total: number }>;
  summary(filters: Omit<ChargeFilters, 'status'>, today: Ymd, rules: ChargeRules): Promise<Record<ChargeDisplayStatus, { count: number; cents: number }>>;
  findById(id: string): Promise<ChargeRecord | null>;
  findByGatewayId(gatewayChargeId: string): Promise<ChargeRecord | null>;
  create(data: { customerId: string; contractId: string | null; motorcycleId: string | null; occurrenceId?: string | null; kind: ChargeKind; description: string; dueDate: Ymd; amount: string }): Promise<ChargeRecord>;
  markPaid(id: string, data: { paidAt: Date; paidAmount: string; fineAmount: string | null; interestAmount: string | null; discountAmount: string | null; method: PaymentMethod; notes: string | null; receiptDocumentId: string | null; registeredById: string | null; gatewayPaidAt?: Date | null }): Promise<void>;
  reverse(id: string, status: ChargeStatus, note: string): Promise<void>;
  cancel(id: string, reason: string): Promise<void>;
  setGateway(id: string, data: { provider: string; gatewayChargeId: string; pixCode: string; expiresAt: Date }): Promise<void>;

  /** Clientes com cobrança em atraso (tolerância já considerada). */
  delinquents(today: Ymd, graceDays: number): Promise<DelinquentRow[]>;
  customersInfo(ids: string[]): Promise<Map<string, { name: string; phone: string | null; whatsapp: string | null; status: string; inCollection: boolean; motorcycle: { id: string; plate: string; brandCode: string; modelCode: string } | null }>>;

  /** Idempotência do webhook: grava o evento; devolve false se já existia. */
  recordGatewayEvent(e: { provider: string; eventId: string; type: string; payload: unknown; signatureValid: boolean; chargeId: string | null }): Promise<{ id: string; isNew: boolean }>;
  finishGatewayEvent(id: string, error: string | null): Promise<void>;

  /** Pendentes que já passaram da tolerância → OVERDUE (job). */
  markOverdue(today: Ymd, graceDays: number): Promise<{ id: string; customerId: string; number: string; amount: string; dueDate: Ymd; description: string }[]>;
  /** Pendentes para lembrete: vencimento dentro da janela. */
  openForReminders(from: Ymd, to: Ymd): Promise<{ id: string; customerId: string; number: string; amount: string; dueDate: Ymd; status: ChargeStatus; description: string }[]>;
}

export interface PixCharge {
  gatewayChargeId: string;
  pixCode: string;
  expiresAt: Date;
}

export interface GatewayWebhookEvent {
  eventId: string;
  type: 'PAYMENT_CONFIRMED' | 'PAYMENT_EXPIRED';
  gatewayChargeId: string;
  paidAmount: string | null;
  paidAt: string | null;
}

/**
 * Porta do gateway de pagamento. A confirmação vem pelo webhook assinado do
 * gateway — **nunca** porque o cliente clicou em "paguei" (§13).
 */
export interface PaymentGateway {
  readonly provider: string;
  readonly sandbox: boolean;
  readonly enabled: boolean;
  createPix(input: { chargeNumber: string; amount: string; description: string; payer: { name: string; cpf: string; email: string | null } }): Promise<PixCharge>;
  /** Confere a assinatura e interpreta o evento. */
  parseWebhook(signature: string | undefined, body: unknown): { valid: boolean; event: GatewayWebhookEvent | null };
  /** Só sandbox: monta um evento assinado como o gateway mandaria. */
  simulatePayment?(gatewayChargeId: string, amount: string): { signature: string; body: unknown };
}
