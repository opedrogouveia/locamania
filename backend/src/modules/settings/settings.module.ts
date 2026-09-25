import { Global, Module } from '@nestjs/common';

import { SettingsService } from './application/settings.service';
import { SETTINGS_REPOSITORY } from './domain/settings.ports';
import { PrismaSettingsRepository } from './infrastructure/prisma-settings.repository';
import { SettingsController } from './presentation/settings.controller';

/** Global: contratos (modelo), portal (dados de contato) e relatórios leem os dados da empresa. */
@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService, { provide: SETTINGS_REPOSITORY, useClass: PrismaSettingsRepository }],
  exports: [SettingsService],
})
export class SettingsModule {}
