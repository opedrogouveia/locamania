import type { StaffRole } from '@locamania/shared';

export const AUTH_ACCOUNTS = Symbol('AuthAccounts');
export const AUTH_TOKENS = Symbol('AuthTokens');

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  passwordHash: string;
  active: boolean;
  deleted: boolean;
  sessionVersion: number;
}

export interface CustomerAccount {
  id: string;
  name: string;
  email: string | null;
  cpf: string;
  passwordHash: string | null;
  portalEnabled: boolean;
  deleted: boolean;
  sessionVersion: number;
  privacyAcceptedAt: Date | null;
}

/** Contas que podem entrar no sistema (equipe e clientes). */
export interface AuthAccounts {
  staffByEmail(email: string): Promise<StaffAccount | null>;
  staffById(id: string): Promise<StaffAccount | null>;
  customerByCpf(cpf: string): Promise<CustomerAccount | null>;
  customerById(id: string): Promise<CustomerAccount | null>;
  /** Troca a senha e incrementa a versão de sessão (derruba os tokens antigos). */
  setStaffPassword(id: string, passwordHash: string): Promise<number>;
  setCustomerPassword(id: string, passwordHash: string, enablePortal: boolean): Promise<number>;
  touchStaffLogin(id: string): Promise<void>;
  touchCustomerLogin(id: string): Promise<void>;
  acceptPrivacy(customerId: string): Promise<void>;
}

export type TokenPurpose = 'PASSWORD_RESET' | 'CUSTOMER_INVITE';

export interface StoredToken {
  id: string;
  purpose: TokenPurpose;
  userId: string | null;
  customerId: string | null;
  expiresAt: Date;
  usedAt: Date | null;
}

/** Tokens de uso único — só o hash fica gravado. */
export interface AuthTokens {
  create(input: { tokenHash: string; purpose: TokenPurpose; userId?: string; customerId?: string; expiresAt: Date }): Promise<void>;
  findByHash(tokenHash: string): Promise<StoredToken | null>;
  markUsed(id: string): Promise<void>;
  /** Invalida tokens anteriores do mesmo tipo para a mesma conta. */
  revokeFor(purpose: TokenPurpose, subject: { userId?: string; customerId?: string }): Promise<void>;
}
