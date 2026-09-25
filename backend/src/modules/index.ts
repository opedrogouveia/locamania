/**
 * Módulos de negócio, registrados no AppModule. Módulo novo entra aqui
 * (ver docs/templates/new-module.md).
 */
import type { Type } from '@nestjs/common';

import { CatalogLabelsModule } from '../shared/catalog/catalog-labels.service';
import { ChargesModule } from './charges/charges.module';
import { ContractsModule } from './contracts/contracts.module';
import { CustomerStatusModule } from './customers/customer-status.module';
import { CustomersModule } from './customers/customers.module';
import { MotorcyclesModule } from './motorcycles/motorcycles.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';

export const FEATURE_MODULES: Type<unknown>[] = [
  CatalogLabelsModule,
  NotificationsModule,
  SettingsModule,
  UsersModule,
  CustomerStatusModule,
  CustomersModule,
  MotorcyclesModule,
  ContractsModule,
  ChargesModule,
  SearchModule,
];
