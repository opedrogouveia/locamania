import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Módulo global do Prisma. Exporta o PrismaService para os repositórios
 * de qualquer módulo sem reimportar. Depende do ClsModule (configurado
 * globalmente no AppModule) para injetar o ClsService.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
