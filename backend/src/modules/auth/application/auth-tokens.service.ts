import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';

import type { AppConfig } from '../../../shared/config/configuration';
import { AUTH_TOKENS, type AuthTokens, type StoredToken, type TokenPurpose } from '../domain/auth.ports';

const TTL_HOURS: Record<TokenPurpose, number> = {
  PASSWORD_RESET: 2,
  // Convite vai por WhatsApp e o cliente pode abrir dias depois.
  CUSTOMER_INVITE: 24 * 7,
};

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Emissão e conferência dos links de uso único (redefinir senha, primeiro
 * acesso). O token vai no link; no banco só o hash — vazar o banco não vaza
 * links válidos.
 */
@Injectable()
export class AuthTokensService {
  private readonly baseUrl: string;

  constructor(
    @Inject(AUTH_TOKENS) private readonly tokens: AuthTokens,
    config: ConfigService<AppConfig, true>,
  ) {
    this.baseUrl = config.get('appPublicUrl', { infer: true });
  }

  async issue(
    purpose: TokenPurpose,
    subject: { userId?: string; customerId?: string },
  ): Promise<{ token: string; link: string; expiresAt: Date }> {
    await this.tokens.revokeFor(purpose, subject);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + TTL_HOURS[purpose] * 3600_000);
    await this.tokens.create({ tokenHash: hashToken(token), purpose, expiresAt, ...subject });
    const path = purpose === 'CUSTOMER_INVITE' ? 'first-access' : 'reset-password';
    return { token, link: `${this.baseUrl}/${path}?token=${token}`, expiresAt };
  }

  async find(token: string): Promise<StoredToken | null> {
    const stored = await this.tokens.findByHash(hashToken(token));
    if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) return null;
    return stored;
  }

  consume(id: string): Promise<void> {
    return this.tokens.markUsed(id);
  }
}
