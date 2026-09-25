import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import type { Request } from 'express';
import { ClsModule } from 'nestjs-cls';

import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthCoreModule } from './shared/auth/auth-core.module';
import { ActorGuard, JwtAuthGuard, RateLimitGuard } from './shared/auth/guards';
import type { Principal } from './shared/auth/principal';
import { CLS_KEYS } from './shared/cls/cls-store';
import { configuration } from './shared/config/configuration';
import { validateEnv } from './shared/config/env.validation';
import { AllExceptionsFilter } from './shared/errors/all-exceptions.filter';
import { HealthModule } from './shared/health/health.module';
import { AuditContextInterceptor } from './shared/http/audit-context.interceptor';
import { MailModule } from './shared/mail/mail.service';
import { ParametersModule } from './shared/parameters/parameters.service';
import { PdfModule } from './shared/pdf/pdf.service';
import { PrismaModule } from './shared/prisma/prisma.module';
import { SecurityModule } from './shared/security/security.module';
import { ClockModule } from './shared/time/clock.service';
import { FEATURE_MODULES } from './modules';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, load: [configuration] }),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req: Request) => {
          const headerId = req.headers['x-correlation-id'];
          cls.set(CLS_KEYS.correlationId, (Array.isArray(headerId) ? headerId[0] : headerId) ?? randomUUID());
          cls.set(CLS_KEYS.ip, req.ip);
          cls.set(CLS_KEYS.userAgent, req.headers['user-agent']);
        },
      },
    }),
    ScheduleModule.forRoot(),
    // Transversais
    PrismaModule,
    ClockModule,
    SecurityModule,
    ParametersModule,
    MailModule,
    PdfModule,
    AuthCoreModule,
    AuditModule,
    HealthModule,
    AuthModule,
    // Negócio
    ...FEATURE_MODULES,
  ],
  providers: [
    // Ordem importa: autenticação → equipe/cliente + permissões → freio.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ActorGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

// req.user no Express: o mínimo comum aos dois tipos de Principal (equipe e cliente).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      kind: Principal['kind'];
      id: string;
      name: string;
    }
  }
}
