import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type {
  AuthTokenInfo,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  SessionActor,
} from '@locamania/shared';

import { CurrentActor, CustomerRoute, Public, RateLimit } from '../../../shared/auth/decorators';
import type { Principal } from '../../../shared/auth/principal';
import { AuthService } from '../application/auth.service';

class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'proprietaria@locamania.local', description: 'E-mail (equipe) ou CPF (cliente).' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o e-mail ou CPF.' })
  @MaxLength(120)
  identifier!: string;

  @ApiProperty({ example: 'changeme123' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha.' })
  @MaxLength(200)
  password!: string;
}

class ForgotDto implements ForgotPasswordRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe o e-mail ou CPF.' }) @MaxLength(120) identifier!: string;
}

class ResetDto implements ResetPasswordRequest {
  @ApiProperty() @IsString() @IsNotEmpty() token!: string;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe a nova senha.' }) @MaxLength(200) password!: string;
}

class ChangePasswordDto implements ChangePasswordRequest {
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe a senha atual.' }) currentPassword!: string;
  @ApiProperty() @IsString() @IsNotEmpty({ message: 'Informe a nova senha.' }) @MaxLength(200) newPassword!: string;
}

const LOGIN_LIMIT = { bucket: 'login', max: 10, windowMs: 15 * 60_000 };
const RECOVERY_LIMIT = { bucket: 'recovery', max: 5, windowMs: 15 * 60_000 };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RateLimit(LOGIN_LIMIT)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login único: e-mail entra no painel; CPF entra no app do cliente.' })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.auth.login(dto.identifier, dto.password);
  }

  @Public()
  @RateLimit(RECOVERY_LIMIT)
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Envia o link de redefinição de senha (resposta sempre igual).' })
  forgot(@Body() dto: ForgotDto): Promise<ForgotPasswordResponse> {
    return this.auth.forgotPassword(dto.identifier);
  }

  @Public()
  @RateLimit(RECOVERY_LIMIT)
  @Get('tokens/:token')
  @ApiOperation({ summary: 'Confere um link de redefinição/primeiro acesso.' })
  tokenInfo(@Param('token') token: string): Promise<AuthTokenInfo> {
    return this.auth.tokenInfo(token);
  }

  @Public()
  @RateLimit(RECOVERY_LIMIT)
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Define a senha pelo link e já abre a sessão.' })
  reset(@Body() dto: ResetDto): Promise<LoginResponse> {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quem está logado (equipe).' })
  me(@CurrentActor() actor: Principal): Promise<SessionActor> {
    return this.auth.me(actor);
  }

  @Get('me/customer')
  @CustomerRoute()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quem está logado (cliente).' })
  meCustomer(@CurrentActor() actor: Principal): Promise<SessionActor> {
    return this.auth.me(actor);
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Troca a senha (equipe).' })
  change(@CurrentActor() actor: Principal, @Body() dto: ChangePasswordDto): Promise<LoginResponse> {
    return this.auth.changePassword(actor, dto.currentPassword, dto.newPassword);
  }

  @Post('customer/change-password')
  @CustomerRoute()
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Troca a senha (cliente).' })
  changeCustomer(@CurrentActor() actor: Principal, @Body() dto: ChangePasswordDto): Promise<LoginResponse> {
    return this.auth.changePassword(actor, dto.currentPassword, dto.newPassword);
  }

  @Post('customer/accept-privacy')
  @CustomerRoute()
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registra o aceite do aviso de privacidade (LGPD).' })
  async acceptPrivacy(@CurrentActor() actor: Principal): Promise<void> {
    await this.auth.acceptPrivacy(actor.id);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  async logout(@CurrentActor() actor: Principal): Promise<void> {
    await this.auth.logout(actor);
  }

  @Post('customer/logout')
  @CustomerRoute()
  @HttpCode(204)
  @ApiBearerAuth()
  async logoutCustomer(@CurrentActor() actor: Principal): Promise<void> {
    await this.auth.logout(actor);
  }
}
