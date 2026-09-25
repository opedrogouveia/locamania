import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import {
  MAINTENANCE_STATUSES,
  Permission,
  type CompleteMaintenanceRequest,
  type CreateMaintenanceRecordRequest,
  type ListMaintenanceQuery,
  type MaintenanceOverviewDto,
  type MaintenancePlanDto,
  type MaintenanceRecordDto,
  type MaintenanceStatus,
  type PaginatedResponse,
  type UpdateMaintenanceRecordRequest,
  type UpsertMaintenancePlanRequest,
} from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { ValidationError } from '../../../shared/errors/domain-errors';
import { PaginationQueryDto } from '../../../shared/http/pagination';
import { IsMoney, IsYmd } from '../../../shared/http/validators';
import { MaintenanceService } from '../application/maintenance.service';

class ListQuery extends PaginationQueryDto implements ListMaintenanceQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() motorcycleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() to?: string;
}

class RecordFields {
  @ApiPropertyOptional() @IsOptional() @IsYmd() scheduledFor?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsYmd() startedAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsYmd() completedAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt({ message: 'Quilometragem inválida.' }) @Min(0) km?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) workshop?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) parts?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsMoney() cost?: string | number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() setMotorcycleInMaintenance?: boolean;
}

class CreateRecordDto extends RecordFields implements CreateMaintenanceRecordRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Escolha a moto.' }) motorcycleId!: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1, { message: 'Escolha pelo menos um serviço.' }) @IsString({ each: true }) typeIds!: string[];
  @ApiProperty({ enum: MAINTENANCE_STATUSES }) @IsIn(MAINTENANCE_STATUSES) status!: MaintenanceStatus;
}

class UpdateRecordDto extends RecordFields implements UpdateMaintenanceRecordRequest {
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) typeIds?: string[];
  @ApiPropertyOptional({ enum: MAINTENANCE_STATUSES }) @IsOptional() @IsIn(MAINTENANCE_STATUSES) status?: MaintenanceStatus;
}

class CompleteDto implements CompleteMaintenanceRequest {
  @ApiProperty() @IsYmd() completedAt!: string;
  @ApiProperty() @Type(() => Number) @IsInt({ message: 'Quilometragem inválida.' }) @Min(0) km!: number;
  @ApiPropertyOptional() @IsOptional() @IsMoney() cost?: string | number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) workshop?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) parts?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @ApiPropertyOptional({ enum: ['AVAILABLE', 'RENTED'] }) @IsOptional() @IsIn(['AVAILABLE', 'RENTED', null]) nextMotorcycleStatus?: 'AVAILABLE' | 'RENTED' | null;
}

class PlanDto implements UpsertMaintenancePlanRequest {
  @ApiProperty() @IsString() @IsNotEmpty() typeId!: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) intervalKm?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) intervalDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) lastDoneKm?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsYmd() lastDoneAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) nextDueKm?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsYmd() nextDueDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

@ApiTags('maintenance')
@ApiBearerAuth()
@Controller()
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get('maintenance/overview')
  @RequirePermissions(Permission.MAINTENANCE_VIEW)
  overview(@CurrentStaff() actor: StaffPrincipal): Promise<MaintenanceOverviewDto> {
    return this.maintenance.overview(actor);
  }

  @Get('maintenance/due/:tab')
  @RequirePermissions(Permission.MAINTENANCE_VIEW)
  @ApiOperation({ summary: 'Planos próximos (upcoming) ou vencidos (overdue) da frota (§8).' })
  due(@Param('tab') tab: string, @Query() query: ListQuery): Promise<PaginatedResponse<MaintenancePlanDto>> {
    if (tab !== 'upcoming' && tab !== 'overdue') throw new ValidationError('Aba inválida.');
    return this.maintenance.due(tab, query);
  }

  @Get('maintenance/records/:status')
  @RequirePermissions(Permission.MAINTENANCE_VIEW)
  @ApiOperation({ summary: 'Registros agendados (scheduled), em andamento (in_progress) ou realizados (done).' })
  records(@Param('status') status: string, @Query() query: ListQuery, @CurrentStaff() actor: StaffPrincipal): Promise<PaginatedResponse<MaintenanceRecordDto>> {
    if (!['in_progress', 'done', 'scheduled'].includes(status)) throw new ValidationError('Situação inválida.');
    return this.maintenance.records(status as 'in_progress' | 'done' | 'scheduled', query, actor);
  }

  @Get('maintenance/record/:id')
  @RequirePermissions(Permission.MAINTENANCE_VIEW)
  record(@Param('id') id: string, @CurrentStaff() actor: StaffPrincipal): Promise<MaintenanceRecordDto> {
    return this.maintenance.record(id, actor);
  }

  @Post('maintenance/records')
  @RequirePermissions(Permission.MAINTENANCE_MANAGE)
  create(@Body() dto: CreateRecordDto, @CurrentStaff() actor: StaffPrincipal): Promise<MaintenanceRecordDto> {
    return this.maintenance.create(dto, actor);
  }

  @Patch('maintenance/record/:id')
  @RequirePermissions(Permission.MAINTENANCE_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateRecordDto, @CurrentStaff() actor: StaffPrincipal): Promise<MaintenanceRecordDto> {
    return this.maintenance.update(id, dto, actor);
  }

  @Post('maintenance/record/:id/complete')
  @RequirePermissions(Permission.MAINTENANCE_MANAGE)
  @ApiOperation({ summary: 'Conclui a manutenção e recalcula o próximo intervalo (§41).' })
  complete(@Param('id') id: string, @Body() dto: CompleteDto, @CurrentStaff() actor: StaffPrincipal): Promise<MaintenanceRecordDto> {
    return this.maintenance.complete(id, dto, actor);
  }

  @Get('motorcycles/:id/maintenance-plans')
  @RequirePermissions(Permission.MAINTENANCE_VIEW)
  plans(@Param('id') id: string): Promise<MaintenancePlanDto[]> {
    return this.maintenance.plansOf(id);
  }

  @Put('motorcycles/:id/maintenance-plans')
  @RequirePermissions(Permission.MAINTENANCE_MANAGE)
  @ApiOperation({ summary: 'Cria/ajusta o plano de um tipo para a moto (km, data ou intervalo).' })
  upsertPlan(@Param('id') id: string, @Body() dto: PlanDto): Promise<MaintenancePlanDto[]> {
    return this.maintenance.upsertPlan(id, dto);
  }
}
