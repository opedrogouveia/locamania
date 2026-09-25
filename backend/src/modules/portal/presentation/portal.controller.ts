import { Body, Controller, Get, Param, Post, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Equals, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import type { Request, Response } from 'express';
import type {
  AcceptContractRequest,
  CreateSupportMessageRequest,
  PaginatedResponse,
  PixPaymentDto,
  PortalChargeDto,
  PortalContractDto,
  PortalDocumentDto,
  PortalHomeDto,
  PortalMotorcycleDto,
  PortalProfileDto,
  PortalSupportInfoDto,
  ReportOdometerRequest,
  SupportMessageDto,
} from '@locamania/shared';

import { CurrentCustomer, CustomerRoute } from '../../../shared/auth/decorators';
import type { CustomerPrincipal } from '../../../shared/auth/principal';
import { PortalService } from '../application/portal.service';

class OdometerBody implements ReportOdometerRequest {
  @ApiProperty() @Type(() => Number) @IsInt({ message: 'Quilometragem inválida.' }) @Min(0) km!: number;
}

class AcceptBody implements AcceptContractRequest {
  @ApiProperty() @Equals(true, { message: 'Marque "Li e aceito" para continuar.' }) accepted!: true;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Digite sua senha para confirmar.' }) password!: string;
}

class SupportBody implements CreateSupportMessageRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe o assunto.' }) @MaxLength(120) subject!: string;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Escreva a mensagem.' }) @MaxLength(2000) body!: string;
}

function pdf(res: Response, buffer: Buffer, fileName: string): StreamableFile {
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${fileName}"` });
  return new StreamableFile(buffer);
}

/**
 * App do cliente. **Toda rota é @CustomerRoute e usa @CurrentCustomer** — o id
 * vem do token; nenhuma rota recebe id de cliente (§46).
 */
@ApiTags('portal')
@ApiBearerAuth()
@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('home')
  @CustomerRoute()
  @ApiOperation({ summary: 'Tela inicial do cliente (§16).' })
  home(@CurrentCustomer() me: CustomerPrincipal): Promise<PortalHomeDto> {
    return this.portal.home(me);
  }

  @Get('charges')
  @CustomerRoute()
  charges(@CurrentCustomer() me: CustomerPrincipal): Promise<PortalChargeDto[]> {
    return this.portal.chargesList(me);
  }

  @Get('charges/:id')
  @CustomerRoute()
  charge(@CurrentCustomer() me: CustomerPrincipal, @Param('id') id: string): Promise<PortalChargeDto> {
    return this.portal.charge(me, id);
  }

  @Post('charges/:id/pix')
  @CustomerRoute()
  @ApiOperation({ summary: 'Gera o PIX da cobrança (§13). A confirmação vem do gateway.' })
  pix(@CurrentCustomer() me: CustomerPrincipal, @Param('id') id: string): Promise<PixPaymentDto> {
    return this.portal.pix(me, id);
  }

  @Post('charges/:id/pix/simulate')
  @CustomerRoute()
  @ApiOperation({ summary: 'SANDBOX: simula o pagamento do PIX (dispara o webhook assinado).' })
  simulate(@CurrentCustomer() me: CustomerPrincipal, @Param('id') id: string): Promise<PortalChargeDto> {
    return this.portal.simulatePix(me, id);
  }

  @Get('charges/:id/receipt')
  @CustomerRoute()
  async receipt(@CurrentCustomer() me: CustomerPrincipal, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const r = await this.portal.receipt(me, id);
    return pdf(res, r.buffer, r.fileName);
  }

  @Get('motorcycle')
  @CustomerRoute()
  motorcycle(@CurrentCustomer() me: CustomerPrincipal) {
    return this.portal.motorcycle(me);
  }

  @Post('motorcycle/odometer')
  @CustomerRoute()
  @ApiOperation({ summary: 'O cliente informa a quilometragem atual.' })
  odometer(@CurrentCustomer() me: CustomerPrincipal, @Body() dto: OdometerBody): Promise<PortalMotorcycleDto> {
    return this.portal.reportOdometer(me, dto.km);
  }

  @Get('maintenance')
  @CustomerRoute()
  maintenance(@CurrentCustomer() me: CustomerPrincipal) {
    return this.portal.maintenanceView(me);
  }

  @Get('contract')
  @CustomerRoute()
  contract(@CurrentCustomer() me: CustomerPrincipal): Promise<PortalContractDto | null> {
    return this.portal.contract(me);
  }

  @Get('contract/text')
  @CustomerRoute()
  contractText(@CurrentCustomer() me: CustomerPrincipal) {
    return this.portal.contractText(me);
  }

  @Get('contract/pdf')
  @CustomerRoute()
  async contractPdf(@CurrentCustomer() me: CustomerPrincipal, @Res({ passthrough: true }) res: Response) {
    const r = await this.portal.contractPdf(me);
    return pdf(res, r.buffer, r.fileName);
  }

  @Post('contract/accept')
  @CustomerRoute()
  @ApiOperation({ summary: 'Aceite eletrônico do contrato (senha + data, IP e dispositivo registrados).' })
  accept(@CurrentCustomer() me: CustomerPrincipal, @Body() dto: AcceptBody, @Req() req: Request): Promise<PortalContractDto | null> {
    return this.portal.acceptContract(me, dto.password, req.ip ?? null, (req.headers['user-agent'] as string | undefined) ?? null);
  }

  @Get('profile')
  @CustomerRoute()
  profile(@CurrentCustomer() me: CustomerPrincipal): Promise<PortalProfileDto> {
    return this.portal.profile(me);
  }

  @Get('support/info')
  @CustomerRoute()
  supportInfo(@CurrentCustomer() me: CustomerPrincipal): Promise<PortalSupportInfoDto> {
    return this.portal.supportInfo(me);
  }

  @Get('support')
  @CustomerRoute()
  support(@CurrentCustomer() me: CustomerPrincipal): Promise<PaginatedResponse<SupportMessageDto>> {
    return this.portal.supportMessages(me);
  }

  @Post('support')
  @CustomerRoute()
  sendSupport(@CurrentCustomer() me: CustomerPrincipal, @Body() dto: SupportBody): Promise<SupportMessageDto> {
    return this.portal.sendSupport(me, dto);
  }

  @Get('documents')
  @CustomerRoute()
  documents(@CurrentCustomer() me: CustomerPrincipal): Promise<PortalDocumentDto[]> {
    return this.portal.documentsList(me);
  }

  @Get('documents/:id/file')
  @CustomerRoute()
  async documentFile(@CurrentCustomer() me: CustomerPrincipal, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const f = await this.portal.documentFile(me, id);
    res.set({ 'Content-Type': f.mimeType, 'Content-Disposition': `inline; filename="${encodeURIComponent(f.fileName)}"` });
    return new StreamableFile(f.data);
  }
}
