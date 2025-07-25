import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

type Payload = {
  sub: string;
  role: UserRole;
  email?: string;
  contact?: string;
  iat: number;
  exp: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: Payload) {
    const currentRole = await this.auth.isValidUser(payload.sub);
    return {
      userId: payload.sub,
      email: payload.email,
      role: currentRole,
      contact: payload.contact,
    };
  }
}
