import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission, type DashboardDto } from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { DashboardService } from '../application/dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermissions(Permission.DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Indicadores e alertas da tela inicial (§2.1).' })
  get(@CurrentStaff() actor: StaffPrincipal): Promise<DashboardDto> {
    return this.dashboard.get(actor);
  }
}
