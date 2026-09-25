import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AppConfig } from '../config/configuration';
import type { JwtPayload, Principal } from './principal';
import { SessionResolverService } from './session-resolver.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly sessions: SessionResolverService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).secret,
    });
  }

  /** O retorno vira `req.user`. */
  async validate(payload: JwtPayload): Promise<Principal> {
    const principal = await this.sessions.resolve(payload);
    if (!principal) throw new UnauthorizedException('Sua sessão expirou. Entre novamente.');
    return principal;
  }
}
