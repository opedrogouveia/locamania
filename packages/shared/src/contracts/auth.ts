import type { StaffRole } from '../enums';
import type { Permission } from '../permissions';

/** Quem está logado: alguém da equipe (painel) ou um cliente (app). */
export type ActorKind = 'staff' | 'customer';

export interface StaffActor {
  kind: 'staff';
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  permissions: Permission[];
}

export interface CustomerActor {
  kind: 'customer';
  id: string;
  name: string;
  email: string | null;
  /** Precisa aceitar o aviso de privacidade (LGPD) no primeiro acesso. */
  privacyAccepted: boolean;
}

export type SessionActor = StaffActor | CustomerActor;

/**
 * POST /auth/login — login único: e-mail entra no painel, CPF entra no app do
 * cliente. Uma URL só para mandar a todo mundo.
 */
export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  actor: SessionActor;
}

/** POST /auth/forgot-password — e-mail (equipe) ou CPF (cliente). */
export interface ForgotPasswordRequest {
  identifier: string;
}

export interface ForgotPasswordResponse {
  /** Sempre a mesma mensagem, exista ou não a conta (não vazar cadastro). */
  message: string;
}

/** GET /auth/tokens/:token — confere o link antes de mostrar o formulário. */
export interface AuthTokenInfo {
  valid: boolean;
  purpose: 'PASSWORD_RESET' | 'CUSTOMER_INVITE' | null;
  name: string | null;
}

/** POST /auth/reset-password — vale para redefinição e para o primeiro acesso. */
export interface ResetPasswordRequest {
  token: string;
  password: string;
}

/** POST /auth/change-password — com a sessão aberta. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
