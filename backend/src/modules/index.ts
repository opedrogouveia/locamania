/**
 * Módulos de negócio, registrados no AppModule. Módulo novo entra aqui
 * (ver docs/templates/new-module.md).
 */
import type { Type } from '@nestjs/common';

import { CatalogLabelsModule } from '../shared/catalog/catalog-labels.service';
import { ChargesModule } from './charges/charges.module';
import { CommunicationModule } from './communication/communication.module';
import { ContractsModule } from './contracts/contracts.module';
import { CustomerStatusModule } from './customers/customer-status.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DocumentsModule } from './documents/documents.module';
import { CustomersModule } from './customers/customers.module';
import { FinanceModule } from './finance/finance.module';
import { JobsModule } from './jobs/jobs.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MotorcyclesModule } from './motorcycles/motorcycles.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OccurrencesModule } from './occurrences/occurrences.module';
import { PortalModule } from './portal/portal.module';
import { ReportsModule } from './reports/reports.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { TrackingModule } from './tracking/tracking.module';
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
  MaintenanceModule,
  DocumentsModule,
  OccurrencesModule,
  FinanceModule,
  DashboardModule,
  JobsModule,
  CommunicationModule,
  PortalModule,
  ReportsModule,
  TrackingModule,
  SearchModule,
];
