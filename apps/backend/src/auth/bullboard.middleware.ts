import { ForbiddenException, Injectable, UnauthorizedException, type NestMiddleware } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';
import { AuthAccountsService } from './auth-accounts.service';
import type { Auth } from './auth.config';

// /queues (BullBoard) is plain Express, outside the Nest guards: check the session here. The
// session cookie is shared with the API's domain (D8), so a super admin signed in on the
// dashboard can open it directly.
@Injectable()
export class BullBoardMiddleware implements NestMiddleware {
  constructor(
    private readonly auth: AuthService<Auth>,
    private readonly accounts: AuthAccountsService,
  ) {}

  async use(request: Request, _response: Response, next: NextFunction): Promise<void> {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    const user = session ? await this.accounts.accessUser(session.user.id) : null;
    if (!user) throw new UnauthorizedException('Sign in to the admin dashboard first');
    if (user.role !== 'SUPER_ADMIN' || user.status === 'INACTIVE' || (!user.twoFactorEnabled && !user.hasPasskey)) {
      throw new ForbiddenException('Only super admins can open the queues');
    }
    next();
  }
}
