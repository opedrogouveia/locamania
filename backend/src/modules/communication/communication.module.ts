import { Global, Module } from '@nestjs/common';

import { COMMUNICATION_REPOSITORY, CommunicationService } from './application/communication.service';
import { PrismaCommunicationRepository } from './infrastructure/prisma-communication.repository';
import { CommunicationController } from './presentation/communication.controller';

/** Global: o portal envia mensagens de suporte pelo mesmo serviço. */
@Global()
@Module({
  controllers: [CommunicationController],
  providers: [CommunicationService, { provide: COMMUNICATION_REPOSITORY, useClass: PrismaCommunicationRepository }],
  exports: [CommunicationService],
})
export class CommunicationModule {}
