import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import type { AppConfig } from '../config/configuration';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsService } from './permissions.service';
import { SessionResolverService } from './session-resolver.service';

/**
 * Núcleo de autenticação (global): estratégia JWT, resolução de sessão e
 * matriz de permissões. Os casos de uso de login ficam no módulo `auth`.
 */
@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        ({ secret: config.get('jwt', { infer: true }).secret }) as JwtModuleOptions,
    }),
  ],
  providers: [JwtStrategy, SessionResolverService, PermissionsService],
  exports: [SessionResolverService, PermissionsService, JwtModule],
})
export class AuthCoreModule {}
