import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import {
  BRAZILIAN_STATES,
  CATALOG_GROUPS,
  Permission,
  type CatalogGroup,
  type CatalogItemDto,
  type CompanySettingsDto,
  type CreateCatalogItemRequest,
  type IntegrationStatusDto,
  type MaintenanceTypeDto,
  type ParameterDto,
  type UpdateCatalogItemRequest,
  type UpdateCompanySettingsRequest,
  type UpdateParameterRequest,
  type UpsertMaintenanceTypeRequest,
} from '@locamania/shared';

import { RequireAnyPermission, RequirePermissions } from '../../../shared/auth/decorators';
import { ValidationError } from '../../../shared/errors/domain-errors';
import { SettingsService } from '../application/settings.service';

class UpdateCompanyDto implements UpdateCompanySettingsRequest {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) tradeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) legalName?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) cnpj?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) whatsapp?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) email?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) postalCode?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) street?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) streetNumber?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) complement?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) district?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) city?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsIn([...BRAZILIAN_STATES, null]) state?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) pixKey?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) supportHours?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60000) contractTemplate?: string;
}

class UpdateParameterDto implements UpdateParameterRequest {
  @ApiProperty() @IsString() @MaxLength(200) value!: string;
}

class CreateCatalogDto implements CreateCatalogItemRequest {
  @ApiProperty({ enum: CATALOG_GROUPS }) @IsIn(CATALOG_GROUPS) group!: CatalogGroup;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe o nome.' }) @MaxLength(80) label!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) code?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

class UpdateCatalogDto implements UpdateCatalogItemRequest {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) label?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

class MaintenanceTypeBody implements UpsertMaintenanceTypeRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe o nome.' }) @MaxLength(80) name!: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) defaultIntervalKm?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) defaultIntervalDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

class MaintenanceTypePatch implements Partial<UpsertMaintenanceTypeRequest> {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) defaultIntervalKm?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) defaultIntervalDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

function assertGroup(group: string): CatalogGroup {
  if (!(CATALOG_GROUPS as string[]).includes(group)) throw new ValidationError('Lista inválida.');
  return group as CatalogGroup;
}

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // Leitura de referência: qualquer pessoa da equipe (formulários dependem disso,
  // mesmo num perfil sem o painel inicial).
  @Get('company')
  company(): Promise<CompanySettingsDto> {
    return this.settings.company();
  }

  @Patch('company')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  updateCompany(@Body() dto: UpdateCompanyDto): Promise<CompanySettingsDto> {
    return this.settings.updateCompany(dto);
  }

  @Get('contract-template/placeholders')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  placeholders() {
    return this.settings.contractPlaceholders();
  }

  @Post('contract-template/restore')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Volta o modelo do contrato ao texto padrão.' })
  restoreTemplate(): Promise<CompanySettingsDto> {
    return this.settings.restoreContractTemplate();
  }

  @Get('parameters')
  parameters(): Promise<ParameterDto[]> {
    return this.settings.parametersList();
  }

  @Put('parameters/:key')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  updateParameter(@Param('key') key: string, @Body() dto: UpdateParameterDto): Promise<ParameterDto> {
    return this.settings.updateParameter(key, dto.value);
  }

  @Get('catalog/:group')
  catalog(@Param('group') group: string, @Query('all') all?: string): Promise<CatalogItemDto[]> {
    return this.settings.catalog(assertGroup(group), all === 'true');
  }

  /** De Configurações (lista) ou de dentro de um formulário ("Cadastrar 'X'"). */
  @Post('catalog')
  @RequireAnyPermission(Permission.SETTINGS_MANAGE, Permission.MOTORCYCLES_MANAGE, Permission.DOCUMENTS_MANAGE, Permission.FINANCE_MANAGE)
  createCatalog(@Body() dto: CreateCatalogDto, @Query('from') from?: string): Promise<CatalogItemDto> {
    return this.settings.createCatalogItem(dto, from === 'form');
  }

  @Patch('catalog/:id')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  updateCatalog(@Param('id') id: string, @Body() dto: UpdateCatalogDto): Promise<CatalogItemDto> {
    return this.settings.updateCatalogItem(id, dto);
  }

  @Get('maintenance-types')
  maintenanceTypes(@Query('all') all?: string): Promise<MaintenanceTypeDto[]> {
    return this.settings.maintenanceTypes(all === 'true');
  }

  @Post('maintenance-types')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  createMaintenanceType(@Body() dto: MaintenanceTypeBody): Promise<MaintenanceTypeDto> {
    return this.settings.createMaintenanceType(dto);
  }

  @Patch('maintenance-types/:id')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  updateMaintenanceType(@Param('id') id: string, @Body() dto: MaintenanceTypePatch): Promise<MaintenanceTypeDto> {
    return this.settings.updateMaintenanceType(id, dto);
  }

  @Get('integrations')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  integrations(): IntegrationStatusDto[] {
    return this.settings.integrations();
  }
}
