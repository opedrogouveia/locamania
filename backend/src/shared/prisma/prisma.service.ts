import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

import type { AppClsStore } from '../cls/cls-store';
import { createAuditExtension } from './prisma.extension';

function buildExtendedClient(base: PrismaClient, cls: ClsService<AppClsStore>) {
  return base.$extends(createAuditExtension(base, cls));
}

/** Client estendido (com auditoria automática) — o que os repositórios usam. */
export type ExtendedPrismaClient = ReturnType<typeof buildExtendedClient>;

/** Transação do client estendido (para receber em repositórios). */
export type PrismaTx = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0];

/**
 * Encapsula o Prisma. NUNCA sobe para application/presentation — só os
 * repositórios (infrastructure) o usam.
 *
 * - `client`: com auditoria automática (use sempre para escrita de negócio).
 * - `raw`: sem interceptação (auditoria explícita, notificações, jobs técnicos).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly base: PrismaClient;
  public readonly client: ExtendedPrismaClient;

  constructor(cls: ClsService<AppClsStore>) {
    this.base = new PrismaClient();
    this.client = buildExtendedClient(this.base, cls);
  }

  async onModuleInit(): Promise<void> {
    await this.base.$connect();
    this.logger.log('Prisma conectado ao banco de dados.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.base.$disconnect();
  }

  get raw(): PrismaClient {
    return this.base;
  }
}
