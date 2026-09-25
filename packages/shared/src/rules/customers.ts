import { CustomerStatus, type CustomerManualStatus } from '../enums';
import { diffDays, type Ymd } from '../utils/dates';

/**
 * Situação efetiva do cliente (§3). Duas são decididas pela administradora
 * (Bloqueado, Inativo); as outras saem dos fatos: atraso > contrato ativo >
 * contrato encerrado. Bloqueio vence tudo; atraso vence "inativo" porque dívida
 * em aberto não pode sumir da lista de inadimplentes só por ter sido inativado.
 *
 * Cliente recém-cadastrado, sem contrato ainda, é "Ativo" (apto a alugar).
 */
export function resolveCustomerStatus(input: {
  manualStatus: CustomerManualStatus | null;
  hasActiveContract: boolean;
  hasOverdue: boolean;
  hadContract: boolean;
}): CustomerStatus {
  if (input.manualStatus === 'BLOCKED') return CustomerStatus.BLOCKED;
  if (input.hasOverdue) return CustomerStatus.OVERDUE;
  if (input.manualStatus === 'INACTIVE') return CustomerStatus.INACTIVE;
  if (input.hasActiveContract) return CustomerStatus.ACTIVE;
  if (input.hadContract) return CustomerStatus.CONTRACT_ENDED;
  return CustomerStatus.ACTIVE;
}

export type ExpiryState = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'UNKNOWN';

/** Validade de CNH/documento: vencido, vencendo (dentro do aviso) ou válido. */
export function expiryState(expiresAt: Ymd | null, today: Ymd, warnDays: number): ExpiryState {
  if (!expiresAt) return 'UNKNOWN';
  const days = diffDays(today, expiresAt);
  if (days < 0) return 'EXPIRED';
  if (days <= warnDays) return 'EXPIRING';
  return 'VALID';
}

/** Motivos que impedem um novo aluguel — mostrados antes de criar o contrato. */
export function rentalBlockers(input: {
  status: CustomerStatus;
  cnhExpiresAt: Ymd | null;
  today: Ymd;
}): string[] {
  const reasons: string[] = [];
  if (input.status === 'BLOCKED') reasons.push('Cliente bloqueado.');
  if (input.status === 'OVERDUE') reasons.push('Cliente com pagamento em atraso.');
  if (!input.cnhExpiresAt) reasons.push('Validade da CNH não informada.');
  else if (expiryState(input.cnhExpiresAt, input.today, 0) === 'EXPIRED') reasons.push('CNH vencida.');
  return reasons;
}
