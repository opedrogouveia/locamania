import { Global, Module } from '@nestjs/common';

import { DocumentsService } from './application/documents.service';
import { DOCUMENTS_REPOSITORY } from './domain/documents.ports';
import { PrismaDocumentsRepository } from './infrastructure/prisma-documents.repository';
import { DocumentsController } from './presentation/documents.controller';

/** Global: portal (documentos liberados ao cliente) e jobs (vencimentos) usam o serviço. */
@Global()
@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, { provide: DOCUMENTS_REPOSITORY, useClass: PrismaDocumentsRepository }],
  exports: [DocumentsService],
})
export class DocumentsModule {}
