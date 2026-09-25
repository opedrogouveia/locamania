import type {
  ChargeKind,
  ContractStatus,
  DepositOutcome,
  FuelLevel,
  PaymentPeriodicity,
  ReturnCondition,
  SignatureMethod,
  SignatureStatus,
} from '../enums';
import type { Ymd } from '../utils/dates';
import type { MoneyString } from '../utils/money';
import type { EntityRef, PaginationQuery } from './common';

export interface ContractListItemDto {
  id: string;
  number: string;
  status: ContractStatus;
  signatureStatus: SignatureStatus;
  customer: EntityRef;
  motorcycle: { id: string; plate: string; label: string };
  startDate: Ymd;
  endDate: Ymd;
  periodicity: PaymentPeriodicity;
  /** Nulo sem `payments.view`. */
  rentAmount: MoneyString | null;
  nextDueDate: Ymd | null;
  overdueCount: number;
  daysToEnd: number | null;
  createdAt: string;
}

export interface ReturnInspectionDto {
  id: string;
  returnedAt: Ymd;
  finalKm: number;
  kmDriven: number;
  condition: ReturnCondition;
  fuelLevel: FuelLevel | null;
  damages: string | null;
  pendingItems: string | null;
  nextMotorcycleStatus: 'AVAILABLE' | 'MAINTENANCE';
  depositOutcome: DepositOutcome;
  depositRetainedAmount: MoneyString | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ContractDto extends ContractListItemDto {
  firstDueDate: Ymd;
  depositAmount: MoneyString | null;
  initialKm: number | null;
  rules: string | null;
  notes: string | null;
  signatureMethod: SignatureMethod | null;
  signedAt: string | null;
  signatureIp: string | null;
  /** Navegador/aparelho do aceite eletrônico (prova do aceite). */
  signatureUserAgent: string | null;
  documentHash: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  returnInspection: ReturnInspectionDto | null;
  totals: { paid: MoneyString; pending: MoneyString; overdue: MoneyString } | null;
  createdBy: string | null;
  customerPhone: string | null;
  customerWhatsapp: string | null;
  customerEmail: string | null;
  /** Cliente já tem acesso ao app (senão, oferecer o convite após a entrega). */
  customerPortalEnabled: boolean;
  /** Link wa.me para mandar o contrato ao cliente. */
  whatsappLink: string | null;
  updatedAt: string;
}

export interface CreateContractRequest {
  customerId: string;
  motorcycleId: string;
  startDate: Ymd;
  endDate: Ymd;
  firstDueDate?: Ymd | null;
  periodicity: PaymentPeriodicity;
  rentAmount: string | number;
  depositAmount?: string | number | null;
  rules?: string | null;
  notes?: string | null;
}

/** Só enquanto rascunho. */
export type UpdateContractRequest = Partial<Omit<CreateContractRequest, 'customerId'>>;

export interface ListContractsQuery extends PaginationQuery {
  status?: ContractStatus;
  customerId?: string;
  motorcycleId?: string;
  /** Contratos que terminam nos próximos N dias. */
  endingWithinDays?: number;
}

export interface RegisterSignatureRequest {
  method: 'IN_PERSON';
  /** Documento (contrato assinado escaneado), se enviado. */
  documentId?: string | null;
}

/** Entrega da moto: ativa o contrato e gera as cobranças (§39 etapas 9–13). */
export interface DeliverContractRequest {
  initialKm: number;
  notes?: string | null;
}

/** Reajuste: muda o valor das parcelas pendentes a partir de uma data. */
export interface AdjustRentRequest {
  rentAmount: string | number;
  effectiveFrom: Ymd;
  reason?: string | null;
}

export interface ExtendContractRequest {
  endDate: Ymd;
}

export interface CancelContractRequest {
  reason: string;
}

export interface ReturnExtraCharge {
  kind: Extract<ChargeKind, 'DAMAGE' | 'FINE' | 'OTHER'>;
  description: string;
  amount: string | number;
  dueDate?: Ymd | null;
}

/** Devolução (§23): vistoria + encerramento do contrato. */
export interface ReturnContractRequest {
  returnedAt: Ymd;
  finalKm: number;
  condition: ReturnCondition;
  fuelLevel?: FuelLevel | null;
  damages?: string | null;
  pendingItems?: string | null;
  notes?: string | null;
  nextMotorcycleStatus: 'AVAILABLE' | 'MAINTENANCE';
  depositOutcome: DepositOutcome;
  depositRetainedAmount?: string | number | null;
  extraCharges?: ReturnExtraCharge[];
}

export interface SendContractResponse {
  emailSent: boolean;
  whatsappLink: string | null;
}
