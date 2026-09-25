import type {
  ChargeDisplayStatus,
  ChargeKind,
  ContractStatus,
  CustomerStatus,
  MaintenanceDueStatus,
  PaymentMethod,
  PaymentPeriodicity,
  SignatureStatus,
} from '../enums';
import type { Ymd } from '../utils/dates';
import type { MoneyString } from '../utils/money';

/**
 * Contratos do app do cliente (`/portal/*`). São projeções **estreitas**: nada
 * de custo interno, dado de outro cliente, nota da equipe ou id de usuário
 * (§9, §38, §46). Tudo é lido pelo id que vem do token, nunca da URL.
 */

export interface PortalMotorcycleDto {
  label: string;
  brand: string;
  model: string;
  plate: string;
  color: string | null;
  year: number | null;
  lastKm: number;
  lastKmAt: string | null;
}

export interface PortalChargeDto {
  id: string;
  number: string;
  kind: ChargeKind;
  description: string;
  dueDate: Ymd;
  amount: MoneyString;
  /** Valor a pagar hoje, já com multa e juros se estiver em atraso. */
  amountDue: MoneyString;
  displayStatus: ChargeDisplayStatus;
  paidAt: string | null;
  paidAmount: MoneyString | null;
  method: PaymentMethod | null;
  hasReceipt: boolean;
  canPayOnline: boolean;
}

export interface PortalMaintenanceDto {
  status: MaintenanceDueStatus;
  message: string;
  nextDate: Ymd | null;
  kmRemaining: number | null;
  typeName: string | null;
}

export interface PortalHomeDto {
  firstName: string;
  status: CustomerStatus;
  /** "Aluguel em dia" / "Pagamento em atraso" / "Sem aluguel ativo". */
  situationLabel: string;
  situationTone: 'success' | 'warning' | 'danger' | 'muted';
  motorcycle: PortalMotorcycleDto | null;
  rent: { amount: MoneyString; periodicity: PaymentPeriodicity; unit: string; endDate: Ymd } | null;
  nextCharge: PortalChargeDto | null;
  overdue: { count: number; amount: MoneyString } | null;
  maintenance: PortalMaintenanceDto | null;
  unreadNotifications: number;
  pendingSignature: boolean;
}

export interface PortalContractDto {
  id: string;
  number: string;
  status: ContractStatus;
  signatureStatus: SignatureStatus;
  signedAt: string | null;
  startDate: Ymd;
  endDate: Ymd;
  periodicity: PaymentPeriodicity;
  rentAmount: MoneyString;
  depositAmount: MoneyString | null;
  motorcycle: PortalMotorcycleDto;
  canAccept: boolean;
}

export interface AcceptContractRequest {
  /** Confirmação explícita ("Li e aceito"). */
  accepted: true;
  password: string;
}

export interface PortalProfileDto {
  name: string;
  cpfMasked: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  cnhExpiresAt: Ymd | null;
}

export interface PortalSupportInfoDto {
  companyName: string;
  phone: string | null;
  whatsapp: string | null;
  whatsappLink: string | null;
  email: string | null;
  supportHours: string | null;
  address: string | null;
}

export interface PortalDocumentDto {
  id: string;
  title: string;
  typeLabel: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}

export interface ReportOdometerRequest {
  km: number;
}
