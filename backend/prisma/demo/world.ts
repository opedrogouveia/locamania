import type {
  ChargeKind,
  ChargeStatus,
  CnhCategory,
  ContractStatus,
  CustomerManualStatus,
  CustomerStatus,
  DepositOutcome,
  FuelLevel,
  MotorcycleStatus,
  OdometerSource,
  PaymentMethod,
  PaymentPeriodicity,
  Prisma,
  ReturnCondition,
  SignatureMethod,
  StaffRole,
} from '@prisma/client';
import { formatBRL, fromCents, type Ymd } from '@locamania/shared';

import { IP_PREFIXES } from './catalog';
import { DemoClock } from './clock';
import { IdFactory, Rng } from './random';

/**
 * Estruturas da simulação. A seed monta tudo em memória (motos, contratos,
 * clientes, cobranças, manutenção...) e só no fim grava com `createMany` — o
 * que deixa a carga rápida também contra um banco remoto.
 */

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  phone: string;
  /** IP e navegador "de sempre" (auditoria). */
  ip: string;
  userAgent: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export type MotoRole =
  | 'JOAO'
  | 'ENDING_SOON'
  | 'OIL_DUE_SOON'
  | 'OIL_OVERDUE'
  | 'BRAKE_OVERDUE'
  | 'BATTERY_DUE_SOON'
  | 'SHOP_SERVICE'
  | 'SHOP_CRASH'
  | 'SHOP_ENGINE'
  | 'BLOCK_HISTORY';

export interface ModelSpec {
  brand: string;
  model: string;
  label: string;
  count: number;
  price: [number, number];
  weeklyRent: [number, number];
  /** Freio a disco na dianteira (pastilhas) ou tambor (lonas). */
  disc: boolean;
  /** Scooter com CVT: correia no lugar do kit relação. */
  belt: boolean;
  wmi: string;
  vds: string;
  oilLiters: string;
  tire: string;
}

export interface ReadingSim {
  motorcycleId: string;
  idx: number;
  km: number;
  readAt: Date;
  source: OdometerSource;
  userId: string | null;
  customerId: string | null;
  contractId: string | null;
  notes: string | null;
}

export interface MotoSim {
  id: string;
  index: number;
  spec: ModelSpec;
  plate: string;
  renavam: string;
  chassis: string;
  manufactureYear: number;
  modelYear: number;
  color: string;
  acquiredAt: Ymd;
  isNew: boolean;
  acqKm: number;
  purchaseCents: number;
  hasTracker: boolean;
  trackerDeviceId: string | null;
  final: MotorcycleStatus;
  roles: Set<MotoRole>;
  /** Dias parada (motos disponíveis). */
  idleDays: number;
  /** Índice do 1º dia em que a moto existe na janela. */
  startIdx: number;
  contracts: ContractSim[];
  /** km no início de cada dia da janela (0..hoje). */
  cum: number[];
  readings: ReadingSim[];
  currentKm: number;
  lastReadingIdx: number;
  statusReason: string | null;
  availableSince: Date | null;
  theftIdx: number | null;
  soldIdx: number | null;
  salePriceCents: number | null;
  insurance: { start: Ymd; insurer: string; premiumCents: number } | null;
  notes: string | null;
  createdAt: Date;
}

export interface InspectionSim {
  id: string;
  returnedAt: Ymd;
  finalKm: number;
  condition: ReturnCondition;
  fuelLevel: FuelLevel | null;
  damages: string | null;
  pendingItems: string | null;
  nextMotorcycleStatus: MotorcycleStatus;
  depositOutcome: DepositOutcome;
  depositRetainedCents: number | null;
  notes: string | null;
  createdBy: StaffUser;
  createdAt: Date;
  /** Avaria que vira ocorrência (e cobrança, se não houver caução). */
  damage: { description: string; amountCents: number; chargeStatus: 'PAID' | 'OVERDUE' | null } | null;
}

export type ContractRole = 'JOAO' | 'ENDING_SOON' | 'THEFT' | 'CANCEL_NO_DELIVERY' | 'CANCEL_AFTER_DELIVERY' | null;

export interface ContractSim {
  id: string;
  moto: MotoSim;
  customer: CustomerSim | null;
  status: ContractStatus;
  role: ContractRole;
  startIdx: number;
  startDate: Ymd;
  endDate: Ymd;
  months: number;
  /** Dia da devolução (encerrado ou cancelado após a entrega). */
  returnIdx: number | null;
  fullTerm: boolean;
  delivered: boolean;
  renewalOf: ContractSim | null;
  createdIdx: number;
  dailyKm: number;
  periodicity: PaymentPeriodicity;
  rentCents: number;
  depositCents: number | null;
  number: string;
  seq: number;
  createdAt: Date;
  deliveredAt: Date | null;
  endedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdBy: StaffUser;
  signatureMethod: SignatureMethod | null;
  signedAt: Date | null;
  signatureIp: string | null;
  signatureUserAgent: string | null;
  sentAt: Date | null;
  renderedText: string | null;
  documentHash: string | null;
  signedDocumentId: string | null;
  notes: string | null;
  reajuste: { idx: number; oldCents: number; newCents: number; at: Date; by: StaffUser } | null;
  inspection: InspectionSim | null;
  charges: ChargeSim[];
}

export interface CustomerSim {
  id: string;
  number: number;
  name: string;
  female: boolean;
  cpf: string;
  rg: string;
  birthDate: Ymd;
  phone: string;
  whatsapp: string;
  email: string | null;
  postalCode: string;
  street: string;
  streetNumber: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  cnhNumber: string;
  cnhCategory: CnhCategory;
  cnhExpiresAt: Ymd;
  createdAt: Date;
  contracts: ContractSim[];
  /** Livre para novo contrato a partir deste dia (Infinity = contrato em curso). */
  busyUntil: number;
  manualStatus: CustomerManualStatus | null;
  blockedReason: string | null;
  inCollection: boolean;
  collectionSince: Ymd | null;
  notes: string | null;
  portalEnabled: boolean;
  privacyAcceptedAt: Date | null;
  portalLastLoginAt: Date | null;
  status: CustomerStatus;
  /** Quantas parcelas ficam em aberto (inadimplente designado). */
  overdueTarget: number;
  preferredMethod: PaymentMethod;
  ip: string;
  userAgent: string;
}

export interface ChargeSim {
  id: string;
  seq: number;
  number: string;
  customer: CustomerSim;
  contract: ContractSim | null;
  motorcycleId: string | null;
  occurrenceId: string | null;
  kind: ChargeKind;
  sequence: number | null;
  description: string;
  periodStart: Ymd | null;
  periodEnd: Ymd | null;
  dueDate: Ymd;
  amountCents: number;
  status: ChargeStatus;
  paidAt: Date | null;
  paidCents: number | null;
  fineCents: number | null;
  interestCents: number | null;
  method: PaymentMethod | null;
  registeredBy: StaffUser | null;
  gatewayChargeId: string | null;
  cancelReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Desempate estável na numeração (PAG-NNNNNN segue a ordem de criação). */
  order: number;
}

export interface MaintenanceSim {
  id: string;
  moto: MotoSim;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  idx: number | null;
  scheduledFor: Ymd | null;
  startedAt: Ymd | null;
  completedAt: Ymd | null;
  km: number | null;
  workshop: string;
  parts: string | null;
  costCents: number | null;
  notes: string | null;
  types: string[];
  createdBy: StaffUser;
  createdAt: Date;
  updatedAt: Date;
}

export interface OccurrenceSim {
  row: Prisma.OccurrenceCreateManyInput;
  moto: MotoSim | null;
  customer: CustomerSim | null;
  createdAt: Date;
}

export class World {
  readonly rng: Rng;
  readonly ids: IdFactory;
  readonly clock: DemoClock;
  users: StaffUser[] = [];
  motos: MotoSim[] = [];
  contracts: ContractSim[] = [];
  customers: CustomerSim[] = [];
  charges: ChargeSim[] = [];
  maintenance: MaintenanceSim[] = [];
  occurrences: OccurrenceSim[] = [];
  maintenanceTypeIds = new Map<string, string>();
  passwordHash = '';
  chargeOrder = 0;
  /** Moto bloqueada e desbloqueada no passado por atraso (histórico do rastreador). */
  blockHistory: { moto: MotoSim; blockIdx: number; unblockIdx: number; reason: string } | null = null;
  /** Contratos ativos com parcelas em atraso (inadimplentes designados). */
  debtors: ContractSim[] = [];

  readonly rows = {
    plans: [] as Prisma.MaintenancePlanCreateManyInput[],
    documents: [] as Prisma.DocumentCreateManyInput[],
    financial: [] as Prisma.FinancialEntryCreateManyInput[],
    positions: [] as Prisma.TrackerPositionCreateManyInput[],
    commands: [] as Prisma.TrackerCommandCreateManyInput[],
    gatewayEvents: [] as Prisma.GatewayEventCreateManyInput[],
    notifications: [] as Prisma.NotificationCreateManyInput[],
    deliveries: [] as Prisma.NotificationDeliveryCreateManyInput[],
    announcements: [] as Prisma.AnnouncementCreateManyInput[],
    support: [] as Prisma.SupportMessageCreateManyInput[],
    audit: [] as Prisma.AuditLogCreateManyInput[],
    jobRuns: [] as Prisma.JobRunCreateManyInput[],
  };

  constructor(seed: number, now: Date = new Date()) {
    this.rng = new Rng(seed);
    this.ids = new IdFactory(seed ^ 0x5eed1d);
    this.clock = new DemoClock(now);
  }

  user(role: StaffRole, index = 0): StaffUser {
    const found = this.users.filter((u) => u.role === role)[index];
    if (!found) throw new Error(`Usuário ${role} #${index} não encontrado`);
    return found;
  }

  /** Quem registra pagamento: financeiro, administrador ou proprietária. */
  cashier(): StaffUser {
    return this.rng.weighted([
      [this.user('FINANCE'), 50],
      [this.user('ADMIN'), 30],
      [this.user('OWNER'), 20],
    ]);
  }

  /** Quem atende no balcão/oficina: funcionários e administrador. */
  clerk(): StaffUser {
    return this.rng.weighted([
      [this.user('STAFF', 0), 40],
      [this.user('STAFF', 1), 35],
      [this.user('ADMIN'), 25],
    ]);
  }

  /** Motos em que o cliente ainda roda (para quilometragem e ocorrências). */
  deliveredContracts(): ContractSim[] {
    return this.contracts.filter((c) => c.delivered);
  }
}

export const money = (cents: number): string => fromCents(cents);
export const brl = (cents: number): string => formatBRL(fromCents(cents));
export const round10 = (value: number): number => Math.round(value / 10) * 10;

/** "joão pedro da silva" → "joao-pedro-da-silva" (nomes de arquivo, e-mails). */
export function slug(text: string, sep = '-'): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}|\\${sep}$`, 'g'), '');
}

export function randomIp(w: World): string {
  return `${w.rng.pick(IP_PREFIXES)}.${w.rng.int(1, 254)}.${w.rng.int(1, 254)}`;
}
