import { Global, Module } from '@nestjs/common';

import { CustomerStatusService } from './application/customer-status.service';
import { CUSTOMERS_REPOSITORY } from './domain/customers.ports';
import { PrismaCustomersRepository } from './infrastructure/prisma-customers.repository';

/** Global: contratos, cobranças e jobs recalculam a situação do cliente. */
@Global()
@Module({
  providers: [CustomerStatusService, { provide: CUSTOMERS_REPOSITORY, useClass: PrismaCustomersRepository }],
  exports: [CustomerStatusService, CUSTOMERS_REPOSITORY],
})
export class CustomerStatusModule {}
