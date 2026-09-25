import { Module } from '@nestjs/common';

import { CustomersService } from './application/customers.service';
import { CustomersController } from './presentation/customers.controller';

/**
 * Clientes — módulo de referência do projeto. O repositório e o recálculo de
 * situação vêm do CustomerStatusModule (global), que outros módulos também usam.
 */
@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
