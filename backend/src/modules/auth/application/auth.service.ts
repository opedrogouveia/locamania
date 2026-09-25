import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  firstName,
  isValidCpf,
  onlyDigits,
  type AuthTokenInfo,
  type CustomerActor,
  type LoginResponse,
  type SessionActor,
  type StaffActor,
} from '@locamania/shared';

import type { Principal } from '../../../shared/auth/principal';
import { PermissionsService } from '../../../shared/auth/permissions.service';
import { SessionResolverService } from '../../../shared/auth/session-resolver.service';
import type { AppConfig } from '../../../shared/config/configuration';
import { UnauthorizedError, ValidationError } from '../../../shared/errors/domain-errors';
import { MailService } from '../../../shared/mail/mail.service';
import { PASSWORD_HASHER, type PasswordHasher } from '../../../shared/security/password-hasher.port';
import { AuditService } from '../../audit/application/audit.service';
import { AUTH_ACCOUNTS, type AuthAccounts, type CustomerAccount, type StaffAccount } from '../domain/auth.ports';
import { assertPasswordIsNew, assertPasswordStrong } from '../domain/password-rules';
import { AuthTokensService } from './auth-tokens.service';

const INVALID = 'E-mail/CPF ou senha incorretos.';
const FORGOT_MESSAGE =
  'Se existir uma conta com esses dados, enviamos um link para criar uma nova senha. Confira seu e-mail.';

/** Diferencia login da equipe (e-mail) do cliente (CPF). */
function classify(identifier: string): { kind: 'staff'; email: string } | { kind: 'customer'; cpf: string } | null {
  const value = identifier.trim();
  if (value.includes('@')) return { kind: 'staff', email: value.toLowerCase() };
  const digits = onlyDigits(value);
  if (digits.length === 11) return { kind: 'customer', cpf: digits };
  return null;
}

@Injectable()
export class AuthService {
  private readonly jwtCfg: AppConfig['jwt'];

  constructor(
    @Inject(AUTH_ACCOUNTS) private readonly accounts: AuthAccounts,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
    private readonly permissions: PermissionsService,
    private readonly sessions: SessionResolverService,
    private readonly tokens: AuthTokensService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.jwtCfg = config.get('jwt', { infer: true });
  }

  async login(identifier: string, password: string): Promise<LoginResponse> {
    const who = classify(identifier);
    if (!who) throw new UnauthorizedError(INVALID);

    if (who.kind === 'staff') {
      const user = await this.accounts.staffByEmail(who.email);
      // Mensagem genérica em qualquer falha: não vazar se o e-mail existe.
      if (!user || !user.active || user.deleted) throw new UnauthorizedError(INVALID);
      if (!(await this.hasher.verify(user.passwordHash, password))) throw new UnauthorizedError(INVALID);
      await this.accounts.touchStaffLogin(user.id);
      await this.audit.record({ action: 'LOGIN', entityType: 'User', entityId: user.id, actor: { type: 'USER', id: user.id, name: user.name } });
      return { accessToken: await this.signStaff(user), actor: await this.staffActor(user) };
    }

    const customer = await this.accounts.customerByCpf(who.cpf);
    if (!customer || customer.deleted || !customer.passwordHash) throw new UnauthorizedError(INVALID);
    if (!customer.portalEnabled) {
      throw new UnauthorizedError('Seu acesso ao aplicativo ainda não foi liberado. Fale com a Locamania.', 'PORTAL_DISABLED');
    }
    if (!(await this.hasher.verify(customer.passwordHash, password))) throw new UnauthorizedError(INVALID);
    await this.accounts.touchCustomerLogin(customer.id);
    await this.audit.record({
      action: 'LOGIN',
      entityType: 'Customer',
      entityId: customer.id,
      actor: { type: 'CUSTOMER', id: customer.id, name: customer.name },
    });
    return { accessToken: await this.signCustomer(customer), actor: this.customerActor(customer) };
  }

  async me(principal: Principal): Promise<SessionActor> {
    if (principal.kind === 'staff') {
      const user = await this.accounts.staffById(principal.id);
      if (!user) throw new UnauthorizedError('Sua sessão expirou. Entre novamente.');
      return this.staffActor(user);
    }
    const customer = await this.accounts.customerById(principal.id);
    if (!customer) throw new UnauthorizedError('Sua sessão expirou. Entre novamente.');
    return this.customerActor(customer);
  }

  async logout(principal: Principal): Promise<void> {
    await this.audit.record({
      action: 'LOGOUT',
      entityType: principal.kind === 'staff' ? 'User' : 'Customer',
      entityId: principal.id,
    });
  }

  /** Esqueci minha senha — resposta sempre igual, exista ou não a conta. */
  async forgotPassword(identifier: string): Promise<{ message: string }> {
    const who = classify(identifier);
    if (who?.kind === 'staff') {
      const user = await this.accounts.staffByEmail(who.email);
      if (user && user.active && !user.deleted) {
        const { link } = await this.tokens.issue('PASSWORD_RESET', { userId: user.id });
        await this.mail.send({
          to: user.email,
          subject: 'Redefinição de senha — Locamania',
          title: 'Crie uma nova senha',
          greeting: `Olá, ${firstName(user.name)}.`,
          paragraphs: ['Recebemos um pedido para redefinir a senha do painel da Locamania.', 'O link vale por 2 horas.'],
          button: { label: 'Criar nova senha', url: link },
          footnote: 'Se não foi você, ignore este e-mail — sua senha continua a mesma.',
        });
      }
    } else if (who?.kind === 'customer' && isValidCpf(who.cpf)) {
      const customer = await this.accounts.customerByCpf(who.cpf);
      if (customer && !customer.deleted && customer.email && customer.portalEnabled) {
        const { link } = await this.tokens.issue('PASSWORD_RESET', { customerId: customer.id });
        await this.mail.send({
          to: customer.email,
          subject: 'Redefinição de senha — Locamania',
          title: 'Crie uma nova senha',
          greeting: `Olá, ${firstName(customer.name)}.`,
          paragraphs: ['Recebemos um pedido para redefinir a senha do seu aplicativo Locamania.', 'O link vale por 2 horas.'],
          button: { label: 'Criar nova senha', url: link },
          footnote: 'Se não foi você, ignore este e-mail.',
        });
      }
    }
    return { message: FORGOT_MESSAGE };
  }

  async tokenInfo(token: string): Promise<AuthTokenInfo> {
    const stored = await this.tokens.find(token);
    if (!stored) return { valid: false, purpose: null, name: null };
    const name = stored.userId
      ? (await this.accounts.staffById(stored.userId))?.name
      : stored.customerId
        ? (await this.accounts.customerById(stored.customerId))?.name
        : null;
    return { valid: true, purpose: stored.purpose, name: name ? firstName(name) : null };
  }

  /** Define a senha pelo link (redefinição ou primeiro acesso) e já entra. */
  async resetPassword(token: string, password: string): Promise<LoginResponse> {
    assertPasswordStrong(password);
    const stored = await this.tokens.find(token);
    if (!stored) throw new ValidationError('Este link expirou ou já foi usado. Peça um novo.', 'TOKEN_INVALID');
    const hash = await this.hasher.hash(password);
    await this.tokens.consume(stored.id);

    if (stored.userId) {
      await this.accounts.setStaffPassword(stored.userId, hash);
      this.sessions.forget('staff', stored.userId);
      const user = (await this.accounts.staffById(stored.userId))!;
      return { accessToken: await this.signStaff(user), actor: await this.staffActor(user) };
    }
    await this.accounts.setCustomerPassword(stored.customerId!, hash, true);
    this.sessions.forget('customer', stored.customerId!);
    const customer = (await this.accounts.customerById(stored.customerId!))!;
    return { accessToken: await this.signCustomer(customer), actor: this.customerActor(customer) };
  }

  /** Troca com a sessão aberta: confere a atual e devolve um token novo (os outros caem). */
  async changePassword(principal: Principal, current: string, next: string): Promise<LoginResponse> {
    assertPasswordStrong(next);
    assertPasswordIsNew(current, next);
    if (principal.kind === 'staff') {
      const user = await this.accounts.staffById(principal.id);
      if (!user || !(await this.hasher.verify(user.passwordHash, current))) {
        throw new ValidationError('A senha atual não confere.');
      }
      await this.accounts.setStaffPassword(user.id, await this.hasher.hash(next));
      this.sessions.forget('staff', user.id);
      const fresh = (await this.accounts.staffById(user.id))!;
      return { accessToken: await this.signStaff(fresh), actor: await this.staffActor(fresh) };
    }
    const customer = await this.accounts.customerById(principal.id);
    if (!customer?.passwordHash || !(await this.hasher.verify(customer.passwordHash, current))) {
      throw new ValidationError('A senha atual não confere.');
    }
    await this.accounts.setCustomerPassword(customer.id, await this.hasher.hash(next), true);
    this.sessions.forget('customer', customer.id);
    const fresh = (await this.accounts.customerById(customer.id))!;
    return { accessToken: await this.signCustomer(fresh), actor: this.customerActor(fresh) };
  }

  async acceptPrivacy(customerId: string): Promise<void> {
    await this.accounts.acceptPrivacy(customerId);
  }

  private signStaff(user: StaffAccount): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, typ: 'staff', ver: user.sessionVersion },
      { expiresIn: this.jwtCfg.staffExpiresIn as never },
    );
  }

  private signCustomer(customer: CustomerAccount): Promise<string> {
    return this.jwt.signAsync(
      { sub: customer.id, typ: 'customer', ver: customer.sessionVersion },
      { expiresIn: this.jwtCfg.customerExpiresIn as never },
    );
  }

  private async staffActor(user: StaffAccount): Promise<StaffActor> {
    return {
      kind: 'staff',
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: [...(await this.permissions.forRole(user.role))],
    };
  }

  private customerActor(customer: CustomerAccount): CustomerActor {
    return {
      kind: 'customer',
      id: customer.id,
      name: customer.name,
      email: customer.email,
      privacyAccepted: !!customer.privacyAcceptedAt,
    };
  }
}
