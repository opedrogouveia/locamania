import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  MOTORCYCLE_STATUSES,
  Permission,
  type CreateMotorcycleRequest,
  type CreateOdometerReadingRequest,
  type ListMotorcyclesQuery,
  type MaintenanceDueStatus,
  type MotorcycleDto,
  type MotorcycleHistoryItemDto,
  type MotorcycleListItemDto,
  type MotorcycleStatus,
  type OdometerReadingDto,
  type PaginatedResponse,
  type SetMotorcycleStatusRequest,
  type UpdateMotorcycleRequest,
} from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { PaginationQueryDto } from '../../../shared/http/pagination';
import { IsMoney, IsPlate, IsYmd } from '../../../shared/http/validators';
import { MotorcyclesService } from '../application/motorcycles.service';

class MotorcycleFields {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt({ message: 'Ano inválido.' }) manufactureYear?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt({ message: 'Ano inválido.' }) modelYear?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) color?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) renavam?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(25) chassis?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsYmd() acquiredAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsMoney() purchasePrice?: string | number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasTracker?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) trackerProvider?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) trackerDeviceId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
}

class CreateMotorcycleDto extends MotorcycleFields implements CreateMotorcycleRequest {
  @ApiProperty({ example: 'HONDA' }) @IsString() @IsNotEmpty({ message: 'Escolha a marca.' }) brandCode!: string;
  @ApiProperty({ example: 'CG_160_FAN' }) @IsString() @IsNotEmpty({ message: 'Escolha o modelo.' }) modelCode!: string;
  @ApiProperty({ example: 'ABC1D23' }) @IsPlate() plate!: string;
  @ApiProperty({ example: 12500 }) @Type(() => Number) @IsInt({ message: 'Quilometragem inválida.' }) @Min(0) @Max(2_000_000) currentKm!: number;
}

class UpdateMotorcycleDto extends MotorcycleFields implements UpdateMotorcycleRequest {
  @ApiPropertyOptional() @IsOptional() @IsString() brandCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() modelCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsPlate() plate?: string;
}

class ListMotorcyclesQueryDto extends PaginationQueryDto implements ListMotorcyclesQuery {
  @ApiPropertyOptional({ enum: MOTORCYCLE_STATUSES }) @IsOptional() @IsIn(MOTORCYCLE_STATUSES) status?: MotorcycleStatus;
  @ApiPropertyOptional({ enum: ['OK', 'DUE_SOON', 'OVERDUE'] }) @IsOptional() @IsIn(['OK', 'DUE_SOON', 'OVERDUE']) maintenanceDue?: MaintenanceDueStatus;
}

class SetStatusDto implements SetMotorcycleStatusRequest {
  @ApiProperty({ enum: ['AVAILABLE', 'MAINTENANCE', 'BLOCKED', 'INACTIVE'] })
  @IsIn(['AVAILABLE', 'MAINTENANCE', 'BLOCKED', 'INACTIVE'], { message: 'Situação inválida.' })
  status!: 'AVAILABLE' | 'MAINTENANCE' | 'BLOCKED' | 'INACTIVE';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string | null;
}

class OdometerDto implements CreateOdometerReadingRequest {
  @ApiProperty() @Type(() => Number) @IsInt({ message: 'Quilometragem inválida.' }) @Min(0) km!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string | null;
}

@ApiTags('motorcycles')
@ApiBearerAuth()
@Controller('motorcycles')
export class MotorcyclesController {
  constructor(private readonly motorcycles: MotorcyclesService) {}

  @Get()
  @RequirePermissions(Permission.MOTORCYCLES_VIEW)
  @ApiOperation({ summary: 'Frota (busca por placa, modelo, RENAVAM, chassi; filtros por situação e manutenção).' })
  list(@Query() query: ListMotorcyclesQueryDto): Promise<PaginatedResponse<MotorcycleListItemDto>> {
    return this.motorcycles.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.MOTORCYCLES_VIEW)
  get(@Param('id') id: string, @CurrentStaff() actor: StaffPrincipal): Promise<MotorcycleDto> {
    return this.motorcycles.get(id, actor);
  }

  @Post()
  @RequirePermissions(Permission.MOTORCYCLES_MANAGE)
  @ApiOperation({ summary: 'Cadastra a moto e cria os planos de manutenção padrão.' })
  create(@Body() dto: CreateMotorcycleDto, @CurrentStaff() actor: StaffPrincipal): Promise<MotorcycleDto> {
    return this.motorcycles.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MOTORCYCLES_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateMotorcycleDto, @CurrentStaff() actor: StaffPrincipal): Promise<MotorcycleDto> {
    return this.motorcycles.update(id, dto, actor);
  }

  @Post(':id/status')
  @RequirePermissions(Permission.MOTORCYCLES_MANAGE)
  @ApiOperation({ summary: 'Muda a situação manualmente (disponível, manutenção, bloqueada, inativa).' })
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto, @CurrentStaff() actor: StaffPrincipal): Promise<MotorcycleDto> {
    return this.motorcycles.setStatus(id, dto, actor);
  }

  @Get(':id/odometer')
  @RequirePermissions(Permission.MOTORCYCLES_VIEW)
  odometer(@Param('id') id: string): Promise<OdometerReadingDto[]> {
    return this.motorcycles.odometer(id);
  }

  @Post(':id/odometer')
  @RequirePermissions(Permission.MOTORCYCLES_MANAGE)
  @ApiOperation({ summary: 'Registra uma leitura de quilometragem (nunca menor que a atual).' })
  addOdometer(@Param('id') id: string, @Body() dto: OdometerDto, @CurrentStaff() actor: StaffPrincipal): Promise<MotorcycleDto> {
    return this.motorcycles.addOdometer(id, dto, actor);
  }

  @Get(':id/history')
  @RequirePermissions(Permission.MOTORCYCLES_VIEW)
  @ApiOperation({ summary: 'Histórico completo da moto (§6).' })
  history(@Param('id') id: string, @CurrentStaff() actor: StaffPrincipal): Promise<MotorcycleHistoryItemDto[]> {
    return this.motorcycles.history(id, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.MOTORCYCLES_MANAGE)
  async archive(@Param('id') id: string): Promise<void> {
    await this.motorcycles.archive(id);
  }
}
