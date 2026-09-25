import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  AUDIT_ACTIONS,
  Permission,
  type AuditAction,
  type AuditLogDto,
  type ListAuditQuery,
  type PaginatedResponse,
} from '@locamania/shared';

import { RequirePermissions } from '../../../shared/auth/decorators';
import { ValidationError } from '../../../shared/errors/domain-errors';
import { PaginationQueryDto } from '../../../shared/http/pagination';
import { IsYmd } from '../../../shared/http/validators';
import { AuditHistoryService } from '../application/audit-history.service';

class ListAuditQueryDto extends PaginationQueryDto implements ListAuditQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() actorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityId?: string;
  @ApiPropertyOptional({ enum: AUDIT_ACTIONS }) @IsOptional() @IsIn(AUDIT_ACTIONS) action?: AuditAction;
  @ApiPropertyOptional() @IsOptional() @IsYmd() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsYmd() to?: string;
}

/** Entidades com linha do tempo na ficha. */
const TIMELINE_TYPES = ['Customer', 'Motorcycle', 'Contract', 'User', 'Occurrence'];

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly history: AuditHistoryService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_VIEW)
  @ApiOperation({ summary: 'Histórico de alterações (§30), em linguagem natural.' })
  list(@Query() query: ListAuditQueryDto): Promise<PaginatedResponse<AuditLogDto>> {
    return this.history.list(query);
  }

  /**
   * Linha do tempo de uma ficha. Quem vê a ficha vê o histórico dela, mesmo sem
   * `audit.view` — a permissão da ficha é conferida pela tela que a abre.
   */
  @Get('timeline/:entityType/:entityId')
  @RequirePermissions(Permission.DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Linha do tempo de um cliente, moto, contrato, usuário ou ocorrência.' })
  timeline(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<AuditLogDto>> {
    if (!TIMELINE_TYPES.includes(entityType)) throw new ValidationError('Tipo de ficha inválido.');
    return this.history.timeline(entityType, entityId, query.page, query.pageSize);
  }
}
