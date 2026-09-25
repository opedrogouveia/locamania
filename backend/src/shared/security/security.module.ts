import { Global, Module } from '@nestjs/common';

import { Argon2PasswordHasher } from './argon2-password-hasher';
import { PASSWORD_HASHER } from './password-hasher.port';

/**
 * Global porque hashing de senha não pertence a um módulo só: o Auth verifica
 * no login e o Users gera ao cadastrar. Deixar a porta no Auth obrigaria o
 * Users a importá-lo, e o Auth já importa o Users — ciclo.
 */
@Global()
@Module({
  providers: [{ provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher }],
  exports: [PASSWORD_HASHER],
})
export class SecurityModule {}
