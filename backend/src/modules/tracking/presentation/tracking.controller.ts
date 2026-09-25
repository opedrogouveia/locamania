import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Permission, type TrackerCommandDto, type TrackerCommandRequest, type TrackerCommandType, type TrackerStatusDto } from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { TrackingService } from '../application/tracking.service';

class CommandBody implements TrackerCommandRequest {
  @ApiProperty({ enum: ['BLOCK', 'UNBLOCK'] }) @IsIn(['BLOCK', 'UNBLOCK']) type!: TrackerCommandType;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe o motivo.' }) @MaxLength(500) reason!: string;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Digite a placa para confirmar.' }) confirmPlate!: string;
}

@ApiTags('tracking')
@ApiBearerAuth()
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get()
  @RequirePermissions(Permission.TRACKING_VIEW)
  @ApiOperation({ summary: 'Motos com rastreador: última comunicação e posição (§31).' })
  list(): Promise<TrackerStatusDto[]> {
    return this.tracking.list();
  }

  @Get(':motorcycleId')
  @RequirePermissions(Permission.TRACKING_VIEW)
  get(@Param('motorcycleId') id: string) {
    return this.tracking.get(id);
  }

  @Post(':motorcycleId/commands')
  @RequirePermissions(Permission.TRACKING_COMMAND)
  @ApiOperation({ summary: 'Bloqueio/desbloqueio seguro: placa digitada + motivo, registrado e auditado (§32).' })
  command(@Param('motorcycleId') id: string, @Body() dto: CommandBody, @CurrentStaff() actor: StaffPrincipal): Promise<TrackerCommandDto> {
    return this.tracking.command(id, dto, actor);
  }
}
