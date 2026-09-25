import { Module } from '@nestjs/common';

import { DASHBOARD_QUERY, DashboardService } from './application/dashboard.service';
import { PrismaDashboardQuery } from './infrastructure/prisma-dashboard.query';
import { DashboardController } from './presentation/dashboard.controller';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, { provide: DASHBOARD_QUERY, useClass: PrismaDashboardQuery }],
})
export class DashboardModule {}
