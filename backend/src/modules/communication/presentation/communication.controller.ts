import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  Permission,
  type AnnouncementAudience,
  type AnnouncementDto,
  type AnswerSupportMessageRequest,
  type CreateAnnouncementRequest,
  type PaginatedResponse,
  type SupportMessageDto,
  type SupportMessageStatus,
} from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { PaginationQueryDto } from '../../../shared/http/pagination';
import { CommunicationService } from '../application/communication.service';

class AnnouncementBody implements CreateAnnouncementRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe o título.' }) @MaxLength(120) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Escreva a mensagem.' }) @MaxLength(2000) body!: string;
  @ApiProperty({ enum: ['ALL_ACTIVE', 'SELECTED'] }) @IsIn(['ALL_ACTIVE', 'SELECTED']) audience!: AnnouncementAudience;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) customerIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() sendEmail?: boolean;
}

class AnswerBody implements AnswerSupportMessageRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Escreva a resposta.' }) @MaxLength(2000) answer!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() close?: boolean;
}

class SupportQuery extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'ANSWERED', 'CLOSED'] }) @IsOptional() @IsIn(['OPEN', 'ANSWERED', 'CLOSED']) status?: SupportMessageStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string;
}

@ApiTags('communication')
@ApiBearerAuth()
@Controller()
export class CommunicationController {
  constructor(private readonly communication: CommunicationService) {}

  @Get('announcements')
  @RequirePermissions(Permission.NOTIFICATIONS_SEND)
  announcements(@Query() q: PaginationQueryDto): Promise<PaginatedResponse<AnnouncementDto>> {
    return this.communication.announcements(q.page, q.pageSize);
  }

  @Post('announcements')
  @RequirePermissions(Permission.NOTIFICATIONS_SEND)
  @ApiOperation({ summary: 'Envia um aviso da Locamania aos clientes (app e, opcionalmente, e-mail).' })
  announce(@Body() dto: AnnouncementBody, @CurrentStaff() actor: StaffPrincipal): Promise<{ recipients: number }> {
    return this.communication.announce(dto, actor);
  }

  @Get('support')
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  support(@Query() q: SupportQuery): Promise<PaginatedResponse<SupportMessageDto>> {
    return this.communication.support(q);
  }

  @Post('support/:id/answer')
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  answer(@Param('id') id: string, @Body() dto: AnswerBody, @CurrentStaff() actor: StaffPrincipal): Promise<SupportMessageDto> {
    return this.communication.answer(id, dto, actor);
  }

  @Post('support/:id/close')
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  close(@Param('id') id: string): Promise<SupportMessageDto> {
    return this.communication.close(id);
  }
}
