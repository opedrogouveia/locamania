import { Module } from '@nestjs/common';

import { PORTAL_QUERY, PortalService } from './application/portal.service';
import { PrismaPortalQuery } from './infrastructure/prisma-portal.query';
import { PortalController } from './presentation/portal.controller';

@Module({
  controllers: [PortalController],
  providers: [PortalService, { provide: PORTAL_QUERY, useClass: PrismaPortalQuery }],
})
export class PortalModule {}
