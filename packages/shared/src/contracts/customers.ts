import type { CnhCategory, CustomerManualStatus, CustomerStatus } from '../enums';
import type { ExpiryState } from '../rules/customers';
import type { Ymd } from '../utils/dates';
import type { MoneyString } from '../utils/money';
import type { PaginationQuery } from './common';

export interface CustomerListItemDto {
  id: string;
  number: number;
  name: string;
  /** Só dígitos; a tela formata. */
  cpf: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  status: CustomerStatus;
  inCollection: boolean;
  cnhExpiresAt: Ymd | null;
  cnhState: ExpiryState;
  currentMotorcycle: { id: string; plate: string; label: string } | null;
  activeContractId: string | null;
  overdueCount: number;
  /** Nulo para quem não tem `payments.view`. */
  overdueAmount: MoneyString | null;
  portalEnabled: boolean;
  createdAt: string;
}

export interface CustomerDocumentChecklistItem {
  typeCode: string;
  label: string;
  delivered: boolean;
  documentId: string | null;
  expiresAt: Ymd | null;
}

export interface CustomerDto extends CustomerListItemDto {
  rg: string | null;
  birthDate: Ymd | null;
  postalCode: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  district: string | null;
  cnhNumber: string | null;
  cnhCategory: CnhCategory | null;
  manualStatus: CustomerManualStatus | null;
  blockedReason: string | null;
  collectionSince: Ymd | null;
  notes: string | null;
  portalLastLoginAt: string | null;
  privacyAcceptedAt: string | null;
  documentsChecklist: CustomerDocumentChecklistItem[];
  /** Resumo financeiro da ficha (nulo sem `payments.view`). */
  totals: { paid: MoneyString; pending: MoneyString; overdue: MoneyString } | null;
  nextCharge: { id: string; dueDate: Ymd; amount: MoneyString | null } | null;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  name: string;
  cpf: string;
  rg?: string | null;
  birthDate?: Ymd | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  postalCode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  cnhNumber?: string | null;
  cnhCategory?: CnhCategory | null;
  cnhExpiresAt?: Ymd | null;
  notes?: string | null;
}

export type UpdateCustomerRequest = Partial<CreateCustomerRequest>;

export interface ListCustomersQuery extends PaginationQuery {
  status?: CustomerStatus;
  inCollection?: boolean;
}

/** Bloquear / inativar / reativar (nulo = volta a ser calculada). */
export interface SetCustomerStatusRequest {
  manualStatus: CustomerManualStatus | null;
  reason?: string | null;
}

export interface SetCollectionRequest {
  inCollection: boolean;
}

/** Link de primeiro acesso ao app (convite). */
export interface PortalInviteResponse {
  link: string;
  whatsappLink: string | null;
  emailSent: boolean;
  expiresAt: string;
}
