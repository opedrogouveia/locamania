import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  Permission,
  STAFF_ROLES,
  type CreateUserRequest,
  type PermissionMeta,
  type RolePermissionsDto,
  type SetUserPasswordRequest,
  type StaffRole,
  type UpdateProfileRequest,
  type UpdateRolePermissionsRequest,
  type UpdateUserRequest,
  type UserDto,
} from '@locamania/shared';

import { CurrentStaff, RequirePermissions } from '../../../shared/auth/decorators';
import type { StaffPrincipal } from '../../../shared/auth/principal';
import { UsersService } from '../application/users.service';

class CreateUserDto implements CreateUserRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe o nome.' }) @MaxLength(120) name!: string;
  @ApiProperty() @IsEmail({}, { message: 'E-mail inválido.' }) email!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @ApiProperty({ enum: STAFF_ROLES }) @IsIn(STAFF_ROLES, { message: 'Perfil inválido.' }) role!: StaffRole;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe a senha inicial.' }) password!: string;
}

class UpdateUserDto implements UpdateUserRequest {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail({}, { message: 'E-mail inválido.' }) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @ApiPropertyOptional({ enum: STAFF_ROLES }) @IsOptional() @IsIn(STAFF_ROLES) role?: StaffRole;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

class SetPasswordDto implements SetUserPasswordRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe a nova senha.' }) password!: string;
}

class RolePermissionsBody implements UpdateRolePermissionsRequest {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayUnique() @IsString({ each: true }) permissions!: Permission[];
}

class UpdateProfileDto implements UpdateProfileRequest {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Usuários da equipe.' })
  list(): Promise<UserDto[]> {
    return this.users.list();
  }

  /** Lista enxuta para escolher responsável (qualquer pessoa da equipe). */
  @Get('users/options')
  @RequirePermissions(Permission.DASHBOARD_VIEW)
  async options(): Promise<{ id: string; name: string }[]> {
    return (await this.users.list()).filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }));
  }

  @Post('users')
  @RequirePermissions(Permission.USERS_MANAGE)
  create(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.users.create(dto);
  }

  @Patch('users/:id')
  @RequirePermissions(Permission.USERS_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentStaff() actor: StaffPrincipal): Promise<UserDto> {
    return this.users.update(id, dto, actor);
  }

  @Post('users/:id/password')
  @HttpCode(204)
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Define uma nova senha para o usuário (e encerra as sessões dele).' })
  async setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto): Promise<void> {
    await this.users.setPassword(id, dto.password);
  }

  @Post('users/:id/end-sessions')
  @HttpCode(204)
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Encerra todas as sessões abertas do usuário.' })
  async endSessions(@Param('id') id: string): Promise<void> {
    await this.users.endSessions(id);
  }

  @Delete('users/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.USERS_MANAGE)
  async archive(@Param('id') id: string, @CurrentStaff() actor: StaffPrincipal): Promise<void> {
    await this.users.archive(id, actor);
  }

  @Get('permissions/catalog')
  @RequirePermissions(Permission.USERS_MANAGE)
  catalog(): PermissionMeta[] {
    return this.users.catalog();
  }

  @Get('permissions')
  @RequirePermissions(Permission.USERS_MANAGE)
  matrix(): Promise<RolePermissionsDto[]> {
    return this.users.matrix();
  }

  @Put('permissions/:role')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Define as permissões de um perfil (o Proprietário é travado).' })
  setRole(@Param('role') role: StaffRole, @Body() dto: RolePermissionsBody): Promise<RolePermissionsDto> {
    return this.users.setRolePermissions(role, dto.permissions);
  }

  /** O próprio usuário edita nome e telefone. */
  @Patch('me')
  updateProfile(@CurrentStaff() actor: StaffPrincipal, @Body() dto: UpdateProfileDto): Promise<UserDto> {
    return this.users.updateProfile(actor, dto);
  }

  /** Sair de todos os aparelhos. */
  @Post('me/end-sessions')
  @HttpCode(204)
  async endMySessions(@CurrentStaff() actor: StaffPrincipal): Promise<void> {
    await this.users.endSessions(actor.id);
  }
}
