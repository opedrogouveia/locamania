import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission, type SearchResultDto } from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { SearchService } from '../application/search.service';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @RequirePermissions(Permission.DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Pesquisa global: nome, CPF, telefone, placa, modelo, nº do contrato.' })
  find(@Query('q') q: string = '', @CurrentStaff() actor: StaffPrincipal): Promise<SearchResultDto[]> {
    return this.search.search(String(q).slice(0, 80), actor);
  }
}
