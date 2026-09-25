import { Module } from '@nestjs/common';

import { CustomersService } from '../customers/application/customers.service';
import { ReportsService } from './application/reports.service';
import { ReportsController } from './presentation/reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, CustomersService],
})
export class ReportsModule {}
