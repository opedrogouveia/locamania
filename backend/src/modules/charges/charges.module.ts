import { Global, Module } from '@nestjs/common';

import { ChargesService } from './application/charges.service';
import { CHARGES_REPOSITORY, PAYMENT_GATEWAY } from './domain/charges.ports';
import { PrismaChargesRepository } from './infrastructure/prisma-charges.repository';
import { SandboxPaymentGateway } from './infrastructure/sandbox-payment.gateway';
import { ChargesController, PaymentsWebhookController } from './presentation/charges.controller';

/** Global: portal (PIX), ocorrências (repasse de multa) e jobs usam o serviço. */
@Global()
@Module({
  controllers: [ChargesController, PaymentsWebhookController],
  providers: [
    ChargesService,
    { provide: CHARGES_REPOSITORY, useClass: PrismaChargesRepository },
    { provide: PAYMENT_GATEWAY, useClass: SandboxPaymentGateway },
  ],
  exports: [ChargesService, CHARGES_REPOSITORY],
})
export class ChargesModule {}
