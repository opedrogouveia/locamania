import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { todayYmd, type Ymd } from '@locamania/shared';

import type { AppConfig } from '../config/configuration';

/**
 * "Hoje" no fuso da empresa. Injetável para os testes controlarem o tempo e
 * para ninguém usar `new Date()` solto num cálculo de vencimento.
 */
@Injectable()
export class ClockService {
  readonly timezone: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.timezone = config.get('timezone', { infer: true });
  }

  now(): Date {
    return new Date();
  }

  today(): Ymd {
    return todayYmd(this.timezone, this.now());
  }
}

@Global()
@Module({ providers: [ClockService], exports: [ClockService] })
export class ClockModule {}
