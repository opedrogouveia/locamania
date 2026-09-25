import { Global, Module } from '@nestjs/common';

import { MotorcyclesService } from './application/motorcycles.service';
import { MOTORCYCLES_REPOSITORY } from './domain/motorcycles.ports';
import { PrismaMotorcyclesRepository } from './infrastructure/prisma-motorcycles.repository';
import { MotorcyclesController } from './presentation/motorcycles.controller';

/** Global: contratos (entrega/devolução) e manutenção registram quilometragem pelo repositório. */
@Global()
@Module({
  controllers: [MotorcyclesController],
  providers: [MotorcyclesService, { provide: MOTORCYCLES_REPOSITORY, useClass: PrismaMotorcyclesRepository }],
  exports: [MotorcyclesService, MOTORCYCLES_REPOSITORY],
})
export class MotorcyclesModule {}
