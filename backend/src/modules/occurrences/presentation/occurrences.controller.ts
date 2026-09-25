import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  OCCURRENCE_STATUSES,
  OCCURRENCE_TYPES,
  Permission,
  type ChargeOccurrenceRequest,
  type CreateOccurrenceRequest,
  type ListOccurrencesQuery,
  type OccurrenceDto,
  type OccurrenceStatus,
  type OccurrenceType,
  type PaginatedResponse,
  type UpdateOccurrenceRequest,
} from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { PaginationQueryDto } from '../../../shared/http/pagination';
import { IsMoney, IsYmd } from '../../../shared/http/validators';
import { OccurrencesService } from '../application/occurrences.service';

class Fields {
  @ApiPropertyOptional() @IsOptional() @IsString() motorcycleId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() contractId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsMoney() amount?: string | number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) fineNumber?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsYmd() fineDueDate?: string | null;
  @ApiPropertyOptional({ enum: OCCURRENCE_STATUSES }) @IsOptional() @IsIn(OCCURRENCE_STATUSES) status?: OccurrenceStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

class CreateDto extends Fields implements CreateOccurrenceRequest {
  @ApiProperty({ enum: OCCURRENCE_TYPES }) @IsIn(OCCURRENCE_TYPES) type!: OccurrenceType;
  @ApiProperty() @IsYmd() occurredAt!: string;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Descreva a ocorrência.' }) @MaxLength(2000) description!: string;
}

class UpdateDto extends Fields implements UpdateOccurrenceRequest {
  @ApiPropertyOptional({ enum: OCCURRENCE_TYPES }) @IsOptional() @IsIn(OCCURRENCE_TYPES) type?: OccurrenceType;
  @ApiPropertyOptional() @IsOptional() @IsYmd() occurredAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(2000) description?: string;
}

class ListDto extends PaginationQueryDto implements ListOccurrencesQuery {
  @ApiPropertyOptional({ enum: OCCURRENCE_TYPES }) @IsOptional() @IsIn(OCCURRENCE_TYPES) type?: OccurrenceType;
  @ApiPropertyOptional({ enum: OCCURRENCE_STATUSES }) @IsOptional() @IsIn(OCCURRENCE_STATUSES) status?: OccurrenceStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() motorcycleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string;
}

class ChargeDto implements ChargeOccurrenceRequest {
  @ApiProperty() @IsMoney() amount!: string | number;
  @ApiProperty() @IsYmd() dueDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) description?: string | null;
}

@ApiTags('occurrences')
@ApiBearerAuth()
@Controller('occurrences')
export class OccurrencesController {
  constructor(private readonly occurrences: OccurrencesService) {}

  @Get()
  @RequirePermissions(Permission.OCCURRENCES_VIEW)
  list(@Query() query: ListDto, @CurrentStaff() actor: StaffPrincipal): Promise<PaginatedResponse<OccurrenceDto>> {
    return this.occurrences.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(Permission.OCCURRENCES_VIEW)
  get(@Param('id') id: string, @CurrentStaff() actor: StaffPrincipal): Promise<OccurrenceDto> {
    return this.occurrences.get(id, actor);
  }

  @Post()
  @RequirePermissions(Permission.OCCURRENCES_MANAGE)
  @ApiOperation({ summary: 'Registra multa, acidente, avaria, furto/roubo ou problema mecânico.' })
  create(@Body() dto: CreateDto, @CurrentStaff() actor: StaffPrincipal): Promise<OccurrenceDto> {
    return this.occurrences.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(Permission.OCCURRENCES_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateDto, @CurrentStaff() actor: StaffPrincipal): Promise<OccurrenceDto> {
    return this.occurrences.update(id, dto, actor);
  }

  @Post(':id/charge')
  @RequirePermissions(Permission.OCCURRENCES_MANAGE, Permission.PAYMENTS_MANAGE)
  @ApiOperation({ summary: 'Repassa o valor ao cliente como cobrança avulsa.' })
  charge(@Param('id') id: string, @Body() dto: ChargeDto, @CurrentStaff() actor: StaffPrincipal): Promise<OccurrenceDto> {
    return this.occurrences.chargeCustomer(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.OCCURRENCES_MANAGE)
  async archive(@Param('id') id: string): Promise<void> {
    await this.occurrences.archive(id);
  }
}
