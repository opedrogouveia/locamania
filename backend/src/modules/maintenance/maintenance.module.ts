import { Global, Module } from '@nestjs/common';

import { MaintenanceService } from './application/maintenance.service';
import { MAINTENANCE_REPOSITORY } from './domain/maintenance.ports';
import { PrismaMaintenanceRepository } from './infrastructure/prisma-maintenance.repository';
import { MaintenanceController } from './presentation/maintenance.controller';

/** Global: jobs de alerta, dashboard e portal leem a situação dos planos. */
@Global()
@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService, { provide: MAINTENANCE_REPOSITORY, useClass: PrismaMaintenanceRepository }],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
