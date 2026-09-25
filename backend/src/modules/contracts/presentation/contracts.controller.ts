import { Body, Controller, Get, Param, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import type { Response } from 'express';
import {
  CONTRACT_STATUSES,
  DEPOSIT_OUTCOMES,
  FUEL_LEVELS,
  PAYMENT_PERIODICITIES,
  Permission,
  RETURN_CONDITIONS,
  type AdjustRentRequest,
  type CancelContractRequest,
  type ContractDto,
  type ContractListItemDto,
  type ContractStatus,
  type CreateContractRequest,
  type DeliverContractRequest,
  type DepositOutcome,
  type ExtendContractRequest,
  type FuelLevel,
  type ListContractsQuery,
  type PaginatedResponse,
  type PaymentPeriodicity,
  type RegisterSignatureRequest,
  type ReturnCondition,
  type ReturnContractRequest,
  type ReturnExtraCharge,
  type SendContractResponse,
  type UpdateContractRequest,
} from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { PaginationQueryDto } from '../../../shared/http/pagination';
import { IsMoney, IsYmd } from '../../../shared/http/validators';
import { ContractsService } from '../application/contracts.service';

class CreateContractDto implements CreateContractRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Escolha o cliente.' }) customerId!: string;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Escolha a moto.' }) motorcycleId!: string;
  @ApiProperty() @IsYmd() startDate!: string;
  @ApiProperty() @IsYmd() endDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() firstDueDate?: string | null;
  @ApiProperty({ enum: PAYMENT_PERIODICITIES }) @IsIn(PAYMENT_PERIODICITIES, { message: 'Periodicidade inválida.' }) periodicity!: PaymentPeriodicity;
  @ApiProperty() @IsMoney() rentAmount!: string | number;
  @ApiPropertyOptional() @IsOptional() @IsMoney() depositAmount?: string | number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) rules?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
}

class UpdateContractDto implements UpdateContractRequest {
  @ApiPropertyOptional() @IsOptional() @IsString() motorcycleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() firstDueDate?: string | null;
  @ApiPropertyOptional({ enum: PAYMENT_PERIODICITIES }) @IsOptional() @IsIn(PAYMENT_PERIODICITIES) periodicity?: PaymentPeriodicity;
  @ApiPropertyOptional() @IsOptional() @IsMoney() rentAmount?: string | number;
  @ApiPropertyOptional() @IsOptional() @IsMoney() depositAmount?: string | number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) rules?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
}

class ListContractsQueryDto extends PaginationQueryDto implements ListContractsQuery {
  @ApiPropertyOptional({ enum: CONTRACT_STATUSES }) @IsOptional() @IsIn(CONTRACT_STATUSES) status?: ContractStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() motorcycleId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) endingWithinDays?: number;
}

class SignatureDto implements RegisterSignatureRequest {
  @ApiProperty({ enum: ['IN_PERSON'] }) @IsIn(['IN_PERSON']) method!: 'IN_PERSON';
  @ApiPropertyOptional() @IsOptional() @IsString() documentId?: string | null;
}

class DeliverDto implements DeliverContractRequest {
  @ApiProperty() @Type(() => Number) @IsInt({ message: 'Quilometragem inválida.' }) @Min(0) initialKm!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

class AdjustDto implements AdjustRentRequest {
  @ApiProperty() @IsMoney() rentAmount!: string | number;
  @ApiProperty() @IsYmd() effectiveFrom!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string | null;
}

class ExtendDto implements ExtendContractRequest {
  @ApiProperty() @IsYmd() endDate!: string;
}

class CancelDto implements CancelContractRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe o motivo.' }) @MaxLength(500) reason!: string;
}

class ExtraChargeDto implements ReturnExtraCharge {
  @ApiProperty({ enum: ['DAMAGE', 'FINE', 'OTHER'] }) @IsIn(['DAMAGE', 'FINE', 'OTHER']) kind!: 'DAMAGE' | 'FINE' | 'OTHER';
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Descreva a pendência.' }) @MaxLength(200) description!: string;
  @ApiProperty() @IsMoney() amount!: string | number;
  @ApiPropertyOptional() @IsOptional() @IsYmd() dueDate?: string | null;
}

class ReturnDto implements ReturnContractRequest {
  @ApiProperty() @IsYmd() returnedAt!: string;
  @ApiProperty() @Type(() => Number) @IsInt({ message: 'Quilometragem inválida.' }) @Min(0) finalKm!: number;
  @ApiProperty({ enum: RETURN_CONDITIONS }) @IsIn(RETURN_CONDITIONS) condition!: ReturnCondition;
  @ApiPropertyOptional({ enum: FUEL_LEVELS }) @IsOptional() @IsIn([...FUEL_LEVELS, null]) fuelLevel?: FuelLevel | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) damages?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) pendingItems?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @ApiProperty({ enum: ['AVAILABLE', 'MAINTENANCE'] }) @IsIn(['AVAILABLE', 'MAINTENANCE']) nextMotorcycleStatus!: 'AVAILABLE' | 'MAINTENANCE';
  @ApiProperty({ enum: DEPOSIT_OUTCOMES }) @IsIn(DEPOSIT_OUTCOMES) depositOutcome!: DepositOutcome;
  @ApiPropertyOptional() @IsOptional() @IsMoney() depositRetainedAmount?: string | number | null;
  @ApiPropertyOptional({ type: [ExtraChargeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExtraChargeDto)
  extraCharges?: ExtraChargeDto[];
}

@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @RequirePermissions(Permission.CONTRACTS_VIEW)
  list(@Query() query: ListContractsQueryDto, @CurrentStaff() actor: StaffPrincipal): Promise<PaginatedResponse<ContractListItemDto>> {
    return this.contracts.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(Permission.CONTRACTS_VIEW)
  get(@Param('id') id: string, @CurrentStaff() actor: StaffPrincipal): Promise<ContractDto> {
    return this.contracts.get(id, actor);
  }

  @Get(':id/text')
  // O documento traz aluguel e caução: exige ver valores também (regra 4).
  @RequirePermissions(Permission.CONTRACTS_VIEW, Permission.PAYMENTS_VIEW)
  @ApiOperation({ summary: 'Texto do contrato (congelado se já assinado).' })
  text(@Param('id') id: string) {
    return this.contracts.text(id);
  }

  @Get(':id/pdf')
  // O documento traz aluguel e caução: exige ver valores também (regra 4).
  @RequirePermissions(Permission.CONTRACTS_VIEW, Permission.PAYMENTS_VIEW)
  @ApiOperation({ summary: 'PDF do contrato (visualizar, baixar, imprimir).' })
  async pdf(@Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { buffer, fileName } = await this.contracts.pdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${fileName}"` });
    return new StreamableFile(buffer);
  }

  @Post()
  @RequirePermissions(Permission.CONTRACTS_MANAGE)
  @ApiOperation({ summary: 'Novo aluguel: cria o rascunho e reserva a moto.' })
  create(@Body() dto: CreateContractDto, @CurrentStaff() actor: StaffPrincipal): Promise<ContractDto> {
    return this.contracts.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONTRACTS_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateContractDto, @CurrentStaff() actor: StaffPrincipal): Promise<ContractDto> {
    return this.contracts.update(id, dto, actor);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.CONTRACTS_MANAGE)
  cancel(@Param('id') id: string, @Body() dto: CancelDto, @CurrentStaff() actor: StaffPrincipal): Promise<ContractDto> {
    return this.contracts.cancel(id, dto.reason, actor);
  }

  @Post(':id/signature')
  @RequirePermissions(Permission.CONTRACTS_MANAGE)
  @ApiOperation({ summary: 'Registra a assinatura presencial (com o escaneado, se enviado).' })
  signature(@Param('id') id: string, @Body() dto: SignatureDto, @CurrentStaff() actor: StaffPrincipal): Promise<ContractDto> {
    return this.contracts.registerSignature(id, dto.documentId ?? null, actor);
  }

  @Post(':id/send')
  @RequirePermissions(Permission.CONTRACTS_MANAGE)
  @ApiOperation({ summary: 'Envia ao cliente: e-mail com PDF, aviso no app e link do WhatsApp.' })
  send(@Param('id') id: string): Promise<SendContractResponse> {
    return this.contracts.send(id);
  }

  @Post(':id/deliver')
  @RequirePermissions(Permission.CONTRACTS_MANAGE)
  @ApiOperation({ summary: 'Entrega a moto: ativa o contrato e gera as cobranças.' })
  deliver(@Param('id') id: string, @Body() dto: DeliverDto, @CurrentStaff() actor: StaffPrincipal): Promise<ContractDto> {
    return this.contracts.deliver(id, dto, actor);
  }

  @Post(':id/adjust')
  @RequirePermissions(Permission.CONTRACTS_MANAGE, Permission.PAYMENTS_VIEW)
  @ApiOperation({ summary: 'Reajuste do aluguel a partir de uma data (parcelas em aberto).' })
  adjust(@Param('id') id: string, @Body() dto: AdjustDto, @CurrentStaff() actor: StaffPrincipal): Promise<ContractDto> {
    return this.contracts.adjustRent(id, dto, actor);
  }

  @Post(':id/extend')
  @RequirePermissions(Permission.CONTRACTS_MANAGE)
  @ApiOperation({ summary: 'Prorroga o contrato e gera as novas parcelas.' })
  extend(@Param('id') id: string, @Body() dto: ExtendDto, @CurrentStaff() actor: StaffPrincipal): Promise<ContractDto> {
    return this.contracts.extend(id, dto.endDate, actor);
  }

  @Post(':id/return')
  @RequirePermissions(Permission.CONTRACTS_MANAGE)
  @ApiOperation({ summary: 'Devolução da moto: vistoria e encerramento do contrato (§23).' })
  returnContract(@Param('id') id: string, @Body() dto: ReturnDto, @CurrentStaff() actor: StaffPrincipal): Promise<ContractDto> {
    return this.contracts.returnContract(id, dto, actor);
  }
}
