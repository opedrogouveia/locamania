import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import type { ListNotificationsQuery, NotificationDto, NotificationSeverity, PaginatedResponse, UnreadCountDto } from '@locamania/shared';

import { CurrentCustomer, CurrentStaff, CustomerRoute } from '../../../shared/auth/decorators';
import type { CustomerPrincipal, StaffPrincipal } from '../../../shared/auth/principal';
import { PaginationQueryDto } from '../../../shared/http/pagination';
import { NotificationsService } from '../application/notifications.service';

class ListNotificationsDto extends PaginationQueryDto implements ListNotificationsQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsIn(['INFO', 'SUCCESS', 'WARNING', 'DANGER']) severity?: NotificationSeverity;
}

class MarkReadDto {
  @ApiPropertyOptional({ type: [String], description: 'Vazio = todas.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];
}

/** Central de notificações da equipe (cada um vê as suas). */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentStaff() actor: StaffPrincipal, @Query() query: ListNotificationsDto): Promise<PaginatedResponse<NotificationDto>> {
    return this.notifications.list('USER', actor.id, query);
  }

  @Get('unread-count')
  unread(@CurrentStaff() actor: StaffPrincipal): Promise<UnreadCountDto> {
    return this.notifications.unread('USER', actor.id);
  }

  @Post('read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Marca como lidas (todas, se não informar ids).' })
  async read(@CurrentStaff() actor: StaffPrincipal, @Body() dto: MarkReadDto): Promise<void> {
    await this.notifications.markRead('USER', actor.id, dto.ids?.length ? dto.ids : 'all');
  }
}

/** Avisos do cliente no app (§17 "Notificações"). */
@ApiTags('portal')
@ApiBearerAuth()
@Controller('portal/notifications')
export class PortalNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @CustomerRoute()
  list(@CurrentCustomer() c: CustomerPrincipal, @Query() query: ListNotificationsDto): Promise<PaginatedResponse<NotificationDto>> {
    return this.notifications.list('CUSTOMER', c.id, query);
  }

  @Get('unread-count')
  @CustomerRoute()
  unread(@CurrentCustomer() c: CustomerPrincipal): Promise<UnreadCountDto> {
    return this.notifications.unread('CUSTOMER', c.id);
  }

  @Post('read')
  @CustomerRoute()
  @HttpCode(204)
  async read(@CurrentCustomer() c: CustomerPrincipal, @Body() dto: MarkReadDto): Promise<void> {
    await this.notifications.markRead('CUSTOMER', c.id, dto.ids?.length ? dto.ids : 'all');
  }
}
