import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { AccessRole, AuthUser } from 'src/common/types';
import { AuthAccountsService } from './auth-accounts.service';
import type { Auth } from './auth.config';
import { PUBLIC_KEY, ROLES_KEY, WITHOUT_2FA_KEY } from './decorators';

export const TWO_FACTOR_SETUP_REQUIRED = 'TWO_FACTOR_SETUP_REQUIRED';

// The one guard every route passes (registered globally in auth.module.ts, in place of the
// adapter's own): a route is private unless @AllowAnonymous(), so a controller that forgets a
// decorator still can't skip a check. It reads the better-auth session (cookie, or bearer via the
// bearer plugin), then enforces, in order: deactivated accounts, the super admin rule (2FA or a
// passkey before anything else), and @Roles/@Access. Gated actions are ConfirmationGuard's (@Confirm).
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService<Auth>,
    private readonly accounts: AuthAccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser; session?: unknown }>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets) ?? false;

    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    const user = session ? await this.accounts.accessUser(session.user.id) : null;
    if (!session || !user) {
      if (isPublic) return true;
      throw new UnauthorizedException('Sign in to continue');
    }
    request.session = session;
    request.user = user;
    Sentry.setUser({ id: user.userId });
    if (isPublic) return true;

    if (user.status === 'INACTIVE') {
      throw new ForbiddenException('This account is deactivated. Contact support.');
    }
    if (
      user.role === 'SUPER_ADMIN' &&
      !user.twoFactorEnabled &&
      !user.hasPasskey &&
      !this.reflector.getAllAndOverride<boolean>(WITHOUT_2FA_KEY, targets)
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        code: TWO_FACTOR_SETUP_REQUIRED,
        message: 'Turn on two-factor authentication or add a passkey to continue',
      });
    }
    const roles = this.reflector.getAllAndOverride<AccessRole[] | undefined>(ROLES_KEY, targets);
    if (roles?.length && !roles.includes(user.role)) {
      throw new ForbiddenException('You do not have access to this');
    }
    return true;
  }
}
