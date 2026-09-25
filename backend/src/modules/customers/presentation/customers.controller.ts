import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Permission,
  type CustomerDto,
  type CustomerListItemDto,
  type PaginatedResponse,
  type PortalInviteResponse,
} from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { CustomersService } from '../application/customers.service';
import {
  CreateCustomerDto,
  ListCustomersQueryDto,
  SetCollectionDto,
  SetCustomerStatusDto,
  UpdateCustomerDto,
} from './customers.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions(Permission.CUSTOMERS_VIEW)
  @ApiOperation({ summary: 'Lista clientes (busca por nome, CPF, telefone ou nº; filtro por situação).' })
  list(@Query() query: ListCustomersQueryDto, @CurrentStaff() actor: StaffPrincipal): Promise<PaginatedResponse<CustomerListItemDto>> {
    return this.customers.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(Permission.CUSTOMERS_VIEW)
  @ApiOperation({ summary: 'Ficha completa do cliente (§4).' })
  get(@Param('id') id: string, @CurrentStaff() actor: StaffPrincipal): Promise<CustomerDto> {
    return this.customers.get(id, actor);
  }

  @Post()
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  create(@Body() dto: CreateCustomerDto, @CurrentStaff() actor: StaffPrincipal): Promise<CustomerDto> {
    return this.customers.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentStaff() actor: StaffPrincipal): Promise<CustomerDto> {
    return this.customers.update(id, dto, actor);
  }

  @Post(':id/status')
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiOperation({ summary: 'Bloquear, inativar ou voltar à situação calculada.' })
  setStatus(@Param('id') id: string, @Body() dto: SetCustomerStatusDto, @CurrentStaff() actor: StaffPrincipal): Promise<CustomerDto> {
    return this.customers.setStatus(id, dto, actor);
  }

  @Post(':id/collection')
  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @ApiOperation({ summary: 'Marca/desmarca o cliente como encaminhado para cobrança.' })
  setCollection(@Param('id') id: string, @Body() dto: SetCollectionDto, @CurrentStaff() actor: StaffPrincipal): Promise<CustomerDto> {
    return this.customers.setCollection(id, dto.inCollection, actor);
  }

  @Post(':id/portal-invite')
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiOperation({ summary: 'Gera o link de primeiro acesso ao app (e envia por e-mail, se houver).' })
  invite(@Param('id') id: string): Promise<PortalInviteResponse> {
    return this.customers.invite(id);
  }

  @Post(':id/portal-disable')
  @HttpCode(204)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiOperation({ summary: 'Corta o acesso do cliente ao app (encerra as sessões).' })
  async disablePortal(@Param('id') id: string): Promise<void> {
    await this.customers.disablePortal(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiOperation({ summary: 'Arquiva o cliente (não apaga — fica no histórico).' })
  async archive(@Param('id') id: string): Promise<void> {
    await this.customers.archive(id);
  }
}
