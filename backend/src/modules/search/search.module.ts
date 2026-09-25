import { Module } from '@nestjs/common';

import { SEARCH_QUERY, SearchService } from './application/search.service';
import { PrismaSearchQuery } from './infrastructure/prisma-search.query';
import { SearchController } from './presentation/search.controller';

@Module({
  controllers: [SearchController],
  providers: [SearchService, { provide: SEARCH_QUERY, useClass: PrismaSearchQuery }],
})
export class SearchModule {}
