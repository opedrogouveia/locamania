import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import type { Response } from 'express';
import { Permission, type ReportKey, type ReportTableDto } from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { ValidationError } from '../../../shared/errors/domain-errors';
import { IsYmd } from '../../../shared/http/validators';
import { ReportsService } from '../application/reports.service';

const KEYS: ReportKey[] = ['fleet', 'customers', 'finance', 'maintenance', 'rentals'];

class PeriodQuery {
  @ApiPropertyOptional() @IsOptional() @IsYmd() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() to?: string;
}

function key(value: string): ReportKey {
  if (!KEYS.includes(value as ReportKey)) throw new ValidationError('Relatório inválido.');
  return value as ReportKey;
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':key')
  @RequirePermissions(Permission.REPORTS_VIEW)
  @ApiOperation({ summary: 'Relatório (frota, clientes, financeiro, manutenção, aluguéis) — §26.' })
  get(@Param('key') k: string, @Query() q: PeriodQuery, @CurrentStaff() actor: StaffPrincipal): Promise<ReportTableDto> {
    return this.reports.build(key(k), actor, q.from, q.to);
  }

  @Get(':key/pdf')
  @RequirePermissions(Permission.REPORTS_EXPORT)
  async pdf(@Param('key') k: string, @Query() q: PeriodQuery, @CurrentStaff() actor: StaffPrincipal, @Res({ passthrough: true }) res: Response) {
    const r = await this.reports.exportPdf(key(k), actor, q.from, q.to);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${r.fileName}"` });
    return new StreamableFile(r.buffer);
  }

  @Get(':key/xlsx')
  @RequirePermissions(Permission.REPORTS_EXPORT)
  async xlsx(@Param('key') k: string, @Query() q: PeriodQuery, @CurrentStaff() actor: StaffPrincipal, @Res({ passthrough: true }) res: Response) {
    const r = await this.reports.exportExcel(key(k), actor, q.from, q.to);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${r.fileName}"`,
    });
    return new StreamableFile(r.buffer);
  }
}
