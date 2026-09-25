import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import {
  CHARGE_DISPLAY_STATUSES,
  CHARGE_KINDS,
  PAYMENT_METHODS,
  Permission,
  type CancelChargeRequest,
  type ChargeDisplayStatus,
  type ChargeDto,
  type ChargeKind,
  type ChargesSummaryDto,
  type CreateChargeRequest,
  type DelinquentCustomerDto,
  type ListChargesQuery,
  type PaginatedResponse,
  type PaymentMethod,
  type RegisterPaymentRequest,
  type ReversePaymentRequest,
} from '@locamania/shared';

import { CurrentStaff, Public, RateLimit, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { PaginationQueryDto } from '../../../shared/http/pagination';
import { IsMoney, IsYmd } from '../../../shared/http/validators';
import { ChargesService } from '../application/charges.service';

class ListChargesQueryDto extends PaginationQueryDto implements ListChargesQuery {
  @ApiPropertyOptional({ enum: CHARGE_DISPLAY_STATUSES }) @IsOptional() @IsIn(CHARGE_DISPLAY_STATUSES) status?: ChargeDisplayStatus;
  @ApiPropertyOptional({ enum: CHARGE_KINDS }) @IsOptional() @IsIn(CHARGE_KINDS) kind?: ChargeKind;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contractId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() motorcycleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() dueFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() dueTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() paidFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() paidTo?: string;
}

class RegisterPaymentDto implements RegisterPaymentRequest {
  @ApiProperty() @IsYmd() paidAt!: string;
  @ApiProperty() @IsMoney() paidAmount!: string | number;
  @ApiProperty({ enum: PAYMENT_METHODS }) @IsIn(PAYMENT_METHODS, { message: 'Forma de pagamento inválida.' }) method!: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsMoney() fineAmount?: string | number | null;
  @ApiPropertyOptional() @IsOptional() @IsMoney() interestAmount?: string | number | null;
  @ApiPropertyOptional() @IsOptional() @IsMoney() discountAmount?: string | number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() receiptDocumentId?: string | null;
}

class ReasonDto implements ReversePaymentRequest, CancelChargeRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe o motivo.' }) @MaxLength(500) reason!: string;
}

class CreateChargeDto implements CreateChargeRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Escolha o cliente.' }) customerId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contractId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() motorcycleId?: string | null;
  @ApiProperty({ enum: CHARGE_KINDS }) @IsIn(CHARGE_KINDS) kind!: ChargeKind;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Descreva a cobrança.' }) @MaxLength(200) description!: string;
  @ApiProperty() @IsYmd() dueDate!: string;
  @ApiProperty() @IsMoney() amount!: string | number;
}

@ApiTags('charges')
@ApiBearerAuth()
@Controller('charges')
export class ChargesController {
  constructor(private readonly charges: ChargesService) {}

  @Get()
  @RequirePermissions(Permission.PAYMENTS_VIEW)
  @ApiOperation({ summary: 'Cobranças com situação (pago, a vencer, próximo, em atraso, cancelado).' })
  list(@Query() query: ListChargesQueryDto): Promise<PaginatedResponse<ChargeDto>> {
    return this.charges.list(query);
  }

  @Get('summary')
  @RequirePermissions(Permission.PAYMENTS_VIEW)
  summary(@Query() query: ListChargesQueryDto): Promise<ChargesSummaryDto> {
    const { status: _status, ...rest } = query;
    return this.charges.summary(rest);
  }

  @Get('delinquents')
  @RequirePermissions(Permission.PAYMENTS_VIEW)
  @ApiOperation({ summary: 'Clientes inadimplentes, com total atualizado e mensagem de cobrança (§14).' })
  delinquents(): Promise<DelinquentCustomerDto[]> {
    return this.charges.delinquents();
  }

  @Get(':id')
  @RequirePermissions(Permission.PAYMENTS_VIEW)
  get(@Param('id') id: string): Promise<ChargeDto> {
    return this.charges.get(id);
  }

  @Get(':id/receipt')
  @RequirePermissions(Permission.PAYMENTS_VIEW)
  async receipt(@Param('id') id: string, @CurrentStaff() actor: StaffPrincipal, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { buffer, fileName } = await this.charges.receiptPdf(id, actor);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${fileName}"` });
    return new StreamableFile(buffer);
  }

  @Post()
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({ summary: 'Cobrança avulsa.' })
  create(@Body() dto: CreateChargeDto): Promise<ChargeDto> {
    return this.charges.create(dto);
  }

  @Post(':id/pay')
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({ summary: 'Registra o pagamento (encargos sugeridos pela data).' })
  pay(@Param('id') id: string, @Body() dto: RegisterPaymentDto, @CurrentStaff() actor: StaffPrincipal): Promise<ChargeDto> {
    return this.charges.registerPayment(id, dto, actor);
  }

  @Post(':id/reverse')
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({ summary: 'Estorna o pagamento: a cobrança volta a ficar em aberto.' })
  reverse(@Param('id') id: string, @Body() dto: ReasonDto): Promise<ChargeDto> {
    return this.charges.reversePayment(id, dto.reason);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  cancel(@Param('id') id: string, @Body() dto: ReasonDto): Promise<ChargeDto> {
    return this.charges.cancel(id, dto.reason);
  }

  @Post(':id/pix/simulate')
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({ summary: 'SANDBOX: simula o pagamento PIX (dispara o webhook assinado).' })
  simulate(@Param('id') id: string): Promise<ChargeDto> {
    return this.charges.simulatePixPayment(id);
  }
}

/** Webhook público do gateway. Assinatura conferida; evento idempotente. */
@ApiTags('payments')
@Controller('payments')
export class PaymentsWebhookController {
  constructor(private readonly charges: ChargesService) {}

  @Public()
  @RateLimit({ bucket: 'webhook', max: 120, windowMs: 60_000 })
  @Post('webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  webhook(@Headers('x-locamania-signature') signature: string | undefined, @Body() body: unknown): Promise<{ ok: boolean }> {
    return this.charges.handleWebhook(signature, body);
  }
}
