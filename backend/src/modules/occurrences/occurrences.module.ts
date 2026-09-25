import { Module } from '@nestjs/common';

import { OccurrencesService } from './application/occurrences.service';
import { OCCURRENCES_REPOSITORY } from './domain/occurrences.ports';
import { PrismaOccurrencesRepository } from './infrastructure/prisma-occurrences.repository';
import { OccurrencesController } from './presentation/occurrences.controller';

@Module({
  controllers: [OccurrencesController],
  providers: [OccurrencesService, { provide: OCCURRENCES_REPOSITORY, useClass: PrismaOccurrencesRepository }],
})
export class OccurrencesModule {}
