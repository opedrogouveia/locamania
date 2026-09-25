import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  PAYMENT_METHODS,
  Permission,
  type CreateFinancialEntryRequest,
  type FinanceSummaryDto,
  type FinancialEntryDto,
  type FinancialEntryType,
  type ListFinancialEntriesQuery,
  type PaginatedResponse,
  type PaymentMethod,
  type UpdateFinancialEntryRequest,
} from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { PaginationQueryDto } from '../../../shared/http/pagination';
import { IsMoney, IsYmd } from '../../../shared/http/validators';
import { FinanceService } from '../application/finance.service';

const TYPES = ['INCOME', 'EXPENSE'] as const;

class EntryFields {
  @ApiPropertyOptional() @IsOptional() @IsString() motorcycleId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) supplier?: string | null;
  @ApiPropertyOptional({ enum: PAYMENT_METHODS }) @IsOptional() @IsIn([...PAYMENT_METHODS, null]) method?: PaymentMethod | null;
}

class CreateEntryDto extends EntryFields implements CreateFinancialEntryRequest {
  @ApiProperty({ enum: TYPES }) @IsIn(TYPES) type!: FinancialEntryType;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Escolha a categoria.' }) categoryCode!: string;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Descreva o lançamento.' }) @MaxLength(200) description!: string;
  @ApiProperty() @IsMoney() amount!: string | number;
  @ApiProperty() @IsYmd() date!: string;
}

class UpdateEntryDto extends EntryFields implements UpdateFinancialEntryRequest {
  @ApiPropertyOptional({ enum: TYPES }) @IsOptional() @IsIn(TYPES) type?: FinancialEntryType;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsMoney() amount?: string | number;
  @ApiPropertyOptional() @IsOptional() @IsYmd() date?: string;
}

class ListEntriesDto extends PaginationQueryDto implements ListFinancialEntriesQuery {
  @ApiPropertyOptional({ enum: TYPES }) @IsOptional() @IsIn(TYPES) type?: FinancialEntryType;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() motorcycleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() to?: string;
}

class PeriodDto {
  @ApiProperty() @IsYmd() from!: string;
  @ApiProperty() @IsYmd() to!: string;
}

@ApiTags('finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  @RequirePermissions(Permission.FINANCE_VIEW)
  @ApiOperation({ summary: 'Painel financeiro do período (§25).' })
  summary(@Query() q: PeriodDto): Promise<FinanceSummaryDto> {
    return this.finance.summary(q.from, q.to);
  }

  @Get('entries')
  @RequirePermissions(Permission.FINANCE_VIEW)
  list(@Query() q: ListEntriesDto): Promise<PaginatedResponse<FinancialEntryDto>> {
    return this.finance.list(q);
  }

  @Post('entries')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  create(@Body() dto: CreateEntryDto, @CurrentStaff() actor: StaffPrincipal): Promise<FinancialEntryDto> {
    return this.finance.create(dto, actor);
  }

  @Patch('entries/:id')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateEntryDto): Promise<FinancialEntryDto> {
    return this.finance.update(id, dto);
  }

  @Delete('entries/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.FINANCE_MANAGE)
  async archive(@Param('id') id: string): Promise<void> {
    await this.finance.archive(id);
  }
}
