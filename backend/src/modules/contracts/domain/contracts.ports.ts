import type {
  ChargeKind,
  ContractStatus,
  DepositOutcome,
  FuelLevel,
  MotorcycleStatus,
  PaymentPeriodicity,
  ReturnCondition,
  SignatureMethod,
  SignatureStatus,
  Ymd,
} from '@locamania/shared';

export const CONTRACTS_REPOSITORY = Symbol('ContractsRepository');

export interface ContractRecord {
  id: string;
  number: string;
  status: ContractStatus;
  customer: {
    id: string;
    name: string;
    cpf: string;
    rg: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    street: string | null;
    streetNumber: string | null;
    complement: string | null;
    district: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    cnhNumber: string | null;
    cnhCategory: string | null;
    cnhExpiresAt: Ymd | null;
    portalEnabled: boolean;
  };
  motorcycle: {
    id: string;
    plate: string;
    brandCode: string;
    modelCode: string;
    manufactureYear: number | null;
    modelYear: number | null;
    color: string | null;
    renavam: string | null;
    chassis: string | null;
    currentKm: number;
    status: MotorcycleStatus;
  };
  startDate: Ymd;
  endDate: Ymd;
  firstDueDate: Ymd;
  periodicity: PaymentPeriodicity;
  rentAmount: string;
  depositAmount: string | null;
  initialKm: number | null;
  rules: string | null;
  notes: string | null;
  renderedText: string | null;
  documentHash: string | null;
  signatureStatus: SignatureStatus;
  signatureMethod: SignatureMethod | null;
  signedAt: Date | null;
  signatureIp: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  endedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdByName: string | null;
  returnInspection: ReturnRecord | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReturnRecord {
  id: string;
  returnedAt: Ymd;
  finalKm: number;
  condition: ReturnCondition;
  fuelLevel: FuelLevel | null;
  damages: string | null;
  pendingItems: string | null;
  nextMotorcycleStatus: MotorcycleStatus;
  depositOutcome: DepositOutcome;
  depositRetainedAmount: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: Date;
}

export interface ListContractsParams {
  skip: number;
  take: number;
  search?: string;
  status?: ContractStatus;
  customerId?: string;
  motorcycleId?: string;
  endingBefore?: Ymd;
}

export interface NewChargeData {
  kind: ChargeKind;
  sequence: number | null;
  description: string;
  periodStart: Ymd | null;
  periodEnd: Ymd | null;
  dueDate: Ymd;
  amount: string;
}

export interface ContractChargeStats {
  nextDueDate: Ymd | null;
  overdueCount: number;
  paidCents: number;
  pendingCents: number;
  overdueCents: number;
}

export interface ContractsRepository {
  list(params: ListContractsParams): Promise<{ items: ContractRecord[]; total: number }>;
  findById(id: string): Promise<ContractRecord | null>;
  chargeStats(contractIds: string[], today: Ymd, graceDays: number): Promise<Map<string, ContractChargeStats>>;

  /** Cria o rascunho e reserva a moto, na mesma transação. */
  createDraft(data: {
    customerId: string;
    motorcycleId: string;
    startDate: Ymd;
    endDate: Ymd;
    firstDueDate: Ymd;
    periodicity: PaymentPeriodicity;
    rentAmount: string;
    depositAmount: string | null;
    rules: string | null;
    notes: string | null;
    createdById: string;
  }): Promise<ContractRecord>;
  updateDraft(id: string, data: Partial<{ motorcycleId: string; startDate: Ymd; endDate: Ymd; firstDueDate: Ymd; periodicity: PaymentPeriodicity; rentAmount: string; depositAmount: string | null; rules: string | null; notes: string | null }>, previousMotorcycleId: string): Promise<ContractRecord>;
  cancelDraft(id: string, reason: string, motorcycleId: string): Promise<void>;

  saveRendered(id: string, text: string, hash: string): Promise<void>;
  registerSignature(id: string, data: { method: SignatureMethod; ip: string | null; userAgent: string | null; documentId: string | null }): Promise<void>;
  markSent(id: string): Promise<void>;

  /** Entrega da moto: ativa o contrato, aluga a moto, registra o km e cria as cobranças. */
  deliver(id: string, data: { initialKm: number; notes: string | null; userId: string; charges: NewChargeData[] }): Promise<void>;
  /** Reajuste: novo valor no contrato e nas parcelas em aberto a partir da data. */
  adjustRent(id: string, rentAmount: string, effectiveFrom: Ymd, previousRent: string): Promise<number>;
  /** Prorrogação: novo término; ajusta a última parcela e cria as novas. */
  extend(id: string, endDate: Ymd, updates: { sequence: number; amount: string; periodEnd: Ymd }[], charges: NewChargeData[]): Promise<void>;
  /** Devolução (§23): vistoria, encerramento, cancelamento das parcelas futuras, cobranças extras, destino da moto. */
  endWithReturn(id: string, data: {
    returnedAt: Ymd;
    finalKm: number;
    condition: ReturnCondition;
    fuelLevel: FuelLevel | null;
    damages: string | null;
    pendingItems: string | null;
    notes: string | null;
    nextMotorcycleStatus: 'AVAILABLE' | 'MAINTENANCE';
    depositOutcome: DepositOutcome;
    depositRetainedAmount: string | null;
    extraCharges: NewChargeData[];
    userId: string;
  }): Promise<void>;

  customerOpenContract(customerId: string, exceptId?: string): Promise<boolean>;
  motorcycleOpenContract(motorcycleId: string, exceptId?: string): Promise<boolean>;
  existingRentCharges(contractId: string): Promise<{ id: string; sequence: number; status: string; amount: string; periodEnd: Ymd | null }[]>;
}
