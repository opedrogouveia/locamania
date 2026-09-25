import {
  expiryState,
  fromCents,
  Permission,
  type CustomerDocumentChecklistItem,
  type CustomerDto,
  type CustomerListItemDto,
  type CustomerStatus,
  type Ymd,
} from '@locamania/shared';

import { hasPermission, type Principal } from '../../../shared/auth/principal';
import { iso } from '../../../shared/http/mappers';
import type { ActiveRental, CustomerRecord, MoneySummary } from '../domain/customers.ports';

export interface ListContext {
  today: Ymd;
  cnhWarnDays: number;
  rental: ActiveRental | undefined;
  overdue: MoneySummary | undefined;
  motorcycleLabel: (brand: string, model: string) => string;
}

/**
 * Situação exibida: a gravada, corrigida na leitura se houver atraso que o job
 * ainda não marcou (servidor gratuito dormindo) — a tela não mente.
 */
function effectiveStatus(c: CustomerRecord, overdueCount: number): CustomerStatus {
  if (c.manualStatus === 'BLOCKED') return 'BLOCKED';
  if (overdueCount > 0) return 'OVERDUE';
  if (c.status === 'OVERDUE') return c.manualStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  return c.status;
}

export function toCustomerListItem(c: CustomerRecord, ctx: ListContext, actor: Principal): CustomerListItemDto {
  const overdueCount = ctx.overdue?.count ?? 0;
  return {
    id: c.id,
    number: c.number,
    name: c.name,
    cpf: c.cpf,
    phone: c.phone,
    whatsapp: c.whatsapp,
    email: c.email,
    city: c.city,
    state: c.state,
    status: effectiveStatus(c, overdueCount),
    inCollection: c.inCollection,
    cnhExpiresAt: c.cnhExpiresAt,
    cnhState: expiryState(c.cnhExpiresAt, ctx.today, ctx.cnhWarnDays),
    currentMotorcycle: ctx.rental
      ? {
          id: ctx.rental.motorcycle.id,
          plate: ctx.rental.motorcycle.plate,
          label: ctx.motorcycleLabel(ctx.rental.motorcycle.brandCode, ctx.rental.motorcycle.modelCode),
        }
      : null,
    activeContractId: ctx.rental?.contractId ?? null,
    overdueCount,
    overdueAmount: hasPermission(actor, Permission.PAYMENTS_VIEW) ? fromCents(ctx.overdue?.cents ?? 0) : null,
    portalEnabled: c.portalEnabled,
    createdAt: iso(c.createdAt),
  };
}

export function toCustomerDto(
  c: CustomerRecord,
  ctx: ListContext & {
    checklist: CustomerDocumentChecklistItem[];
    totals: { paidCents: number; pendingCents: number; overdueCents: number };
    nextCharge: { id: string; dueDate: Ymd; amountCents: number } | null;
  },
  actor: Principal,
): CustomerDto {
  const canMoney = hasPermission(actor, Permission.PAYMENTS_VIEW);
  return {
    ...toCustomerListItem(c, ctx, actor),
    rg: c.rg,
    birthDate: c.birthDate,
    postalCode: c.postalCode,
    street: c.street,
    streetNumber: c.streetNumber,
    complement: c.complement,
    district: c.district,
    cnhNumber: c.cnhNumber,
    cnhCategory: c.cnhCategory,
    manualStatus: c.manualStatus,
    blockedReason: c.blockedReason,
    collectionSince: c.collectionSince,
    notes: c.notes,
    portalLastLoginAt: iso(c.portalLastLoginAt),
    privacyAcceptedAt: iso(c.privacyAcceptedAt),
    documentsChecklist: ctx.checklist,
    totals: canMoney
      ? {
          paid: fromCents(ctx.totals.paidCents),
          pending: fromCents(ctx.totals.pendingCents),
          overdue: fromCents(ctx.totals.overdueCents),
        }
      : null,
    nextCharge: ctx.nextCharge
      ? { id: ctx.nextCharge.id, dueDate: ctx.nextCharge.dueDate, amount: canMoney ? fromCents(ctx.nextCharge.amountCents) : null }
      : null,
    updatedAt: iso(c.updatedAt),
  };
}
