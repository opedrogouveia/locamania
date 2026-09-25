import { timingSafeEqual } from 'node:crypto';

import { Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission, type JobRunDto } from '@locamania/shared';

import { Public, RateLimit, RequirePermissions } from '../../../shared/auth/decorators';
import type { AppConfig } from '../../../shared/config/configuration';
import { UnauthorizedError } from '../../../shared/errors/domain-errors';
import { JobsService } from '../application/jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Chamado pelo GitHub Actions (o Render free hiberna e o cron interno não roda dormindo). */
  @Public()
  @RateLimit({ bucket: 'jobs', max: 10, windowMs: 60 * 60_000 })
  @Post('run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Roda a rotina diária (exige o cabeçalho x-jobs-secret).' })
  async run(@Headers('x-jobs-secret') secret: string | undefined) {
    const expected = this.config.get('jobs', { infer: true }).secret;
    if (!expected || !secret || !safeEqual(secret, expected)) throw new UnauthorizedError('Segredo inválido.');
    return this.jobs.runDaily('scheduler');
  }

  @Post('run-now')
  @ApiBearerAuth()
  @HttpCode(200)
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Roda a rotina diária agora (Configurações › Sistema).' })
  runNow() {
    return this.jobs.runDaily('manual');
  }

  @Get('runs')
  @ApiBearerAuth()
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  runs(): Promise<JobRunDto[]> {
    return this.jobs.recent();
  }
}

/** Comparação em tempo constante (não vaza o segredo pelo tempo de resposta). */
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
