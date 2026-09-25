import { Global, Module } from '@nestjs/common';

import { AUDIT_QUERY, AuditHistoryService } from './application/audit-history.service';
import { AuditService } from './application/audit.service';
import { PrismaAuditQuery } from './infrastructure/prisma-audit-query';
import { AuditController } from './presentation/audit.controller';

/**
 * Auditoria (transversal). A captura automática de escrita vive na extensão do
 * Prisma (shared/prisma); aqui ficam os eventos explícitos e a leitura.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditHistoryService, { provide: AUDIT_QUERY, useClass: PrismaAuditQuery }],
  exports: [AuditService, AuditHistoryService],
})
export class AuditModule {}
