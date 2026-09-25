import { Global, Module } from '@nestjs/common';

import { FinanceService } from './application/finance.service';
import { FINANCE_REPOSITORY } from './domain/finance.ports';
import { PrismaFinanceRepository } from './infrastructure/prisma-finance.repository';
import { FinanceController } from './presentation/finance.controller';

/** Global: relatórios e dashboard usam o resumo financeiro. */
@Global()
@Module({
  controllers: [FinanceController],
  providers: [FinanceService, { provide: FINANCE_REPOSITORY, useClass: PrismaFinanceRepository }],
  exports: [FinanceService],
})
export class FinanceModule {}
