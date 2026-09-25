import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { AppConfig } from '../../../shared/config/configuration';
import type { GatewayWebhookEvent, PaymentGateway, PixCharge } from '../domain/charges.ports';
import { buildPixBrCode } from '../domain/pix-brcode';

const PIX_TTL_MINUTES = 30;

/**
 * Gateway de TESTES. Gera um PIX com formato real (BR Code) apontando para uma
 * chave fictícia — nenhum valor é cobrado — e confirma pelo mesmo caminho de
 * produção: webhook assinado (HMAC-SHA256) + idempotência pelo id do evento.
 *
 * Trocar pelo gateway real (Asaas, Mercado Pago, Efí…) = novo adaptador desta
 * porta + PAYMENT_GATEWAY no ambiente. O resto do sistema não muda.
 */
@Injectable()
export class SandboxPaymentGateway implements PaymentGateway {
  readonly provider = 'sandbox';
  readonly sandbox = true;
  readonly enabled: boolean;
  private readonly secret: string;

  constructor(config: ConfigService<AppConfig, true>) {
    const payments = config.get('payments', { infer: true });
    this.enabled = payments.gateway === 'sandbox';
    this.secret = payments.webhookSecret;
  }

  async createPix(input: { chargeNumber: string; amount: string; description: string }): Promise<PixCharge> {
    const gatewayChargeId = `sbx_${randomBytes(9).toString('hex')}`;
    return {
      gatewayChargeId,
      pixCode: buildPixBrCode({
        key: 'sandbox@locamania.com.br',
        merchantName: 'LOCAMANIA SANDBOX',
        merchantCity: 'SAO PAULO',
        amount: input.amount,
        txid: input.chargeNumber,
        description: 'TESTE SEM COBRANCA',
      }),
      expiresAt: new Date(Date.now() + PIX_TTL_MINUTES * 60_000),
    };
  }

  private sign(body: unknown): string {
    return createHmac('sha256', this.secret).update(JSON.stringify(body)).digest('hex');
  }

  parseWebhook(signature: string | undefined, body: unknown): { valid: boolean; event: GatewayWebhookEvent | null } {
    if (!signature) return { valid: false, event: null };
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(signature);
    const valid = expected.length === given.length && timingSafeEqual(expected, given);
    if (!valid) return { valid: false, event: null };
    const b = body as Partial<GatewayWebhookEvent>;
    if (!b.eventId || !b.gatewayChargeId || (b.type !== 'PAYMENT_CONFIRMED' && b.type !== 'PAYMENT_EXPIRED')) {
      return { valid: true, event: null };
    }
    return {
      valid: true,
      event: { eventId: b.eventId, type: b.type, gatewayChargeId: b.gatewayChargeId, paidAmount: b.paidAmount ?? null, paidAt: b.paidAt ?? null },
    };
  }

  simulatePayment(gatewayChargeId: string, amount: string): { signature: string; body: unknown } {
    const body: GatewayWebhookEvent = {
      eventId: `evt_${randomBytes(9).toString('hex')}`,
      type: 'PAYMENT_CONFIRMED',
      gatewayChargeId,
      paidAmount: amount,
      paidAt: new Date().toISOString(),
    };
    return { signature: this.sign(body), body };
  }
}
