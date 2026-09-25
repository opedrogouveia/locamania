import { Global, Module } from '@nestjs/common';

import { ContractDocumentService } from './application/contract-document.service';
import { ContractsService } from './application/contracts.service';
import { CONTRACTS_REPOSITORY } from './domain/contracts.ports';
import { PrismaContractsRepository } from './infrastructure/prisma-contracts.repository';
import { ContractsController } from './presentation/contracts.controller';

/** Global: o portal do cliente lê e aceita o contrato por este serviço. */
@Global()
@Module({
  controllers: [ContractsController],
  providers: [ContractsService, ContractDocumentService, { provide: CONTRACTS_REPOSITORY, useClass: PrismaContractsRepository }],
  exports: [ContractsService, ContractDocumentService, CONTRACTS_REPOSITORY],
})
export class ContractsModule {}
