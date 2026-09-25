import { Global, Module } from '@nestjs/common';

import { AuthTokensService } from './application/auth-tokens.service';
import { AuthService } from './application/auth.service';
import { AUTH_ACCOUNTS, AUTH_TOKENS } from './domain/auth.ports';
import { PrismaAuthAccounts, PrismaAuthTokens } from './infrastructure/prisma-auth.repositories';
import { AuthController } from './presentation/auth.controller';

/** Global porque o convite do cliente (módulo customers) usa o AuthTokensService. */
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokensService,
    { provide: AUTH_ACCOUNTS, useClass: PrismaAuthAccounts },
    { provide: AUTH_TOKENS, useClass: PrismaAuthTokens },
  ],
  exports: [AuthTokensService],
})
export class AuthModule {}
