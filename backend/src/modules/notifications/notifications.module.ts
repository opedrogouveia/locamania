import { Global, Module } from '@nestjs/common';

import { NotificationsService } from './application/notifications.service';
import { NOTIFICATIONS_REPOSITORY, WHATSAPP_CHANNEL } from './domain/notifications.ports';
import { DisabledWhatsAppChannel, PrismaNotificationsRepository } from './infrastructure/prisma-notifications.repository';
import { NotificationsController, PortalNotificationsController } from './presentation/notifications.controller';

/** Global: contratos, cobranças, manutenção, suporte e jobs notificam por aqui. */
@Global()
@Module({
  controllers: [NotificationsController, PortalNotificationsController],
  providers: [
    NotificationsService,
    { provide: NOTIFICATIONS_REPOSITORY, useClass: PrismaNotificationsRepository },
    { provide: WHATSAPP_CHANNEL, useClass: DisabledWhatsAppChannel },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
