import {
  applyDecorators,
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiHeader } from '@nestjs/swagger';
import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import type { AccessRole, AuthUser } from 'src/common/types';

// Read by the global AccessGuard (access.guard.ts). Every route needs a signed-in user unless it
// is marked @AllowAnonymous(). Nothing here imports better-auth, so controllers stay loadable in
// Jest (D14).

export const PUBLIC_KEY = 'PUBLIC';
export const ROLES_KEY = 'roles';
export const WITHOUT_2FA_KEY = 'allowWithoutTwoFactor';
export const BYPASS_MAINTENANCE_KEY = 'bypassMaintenance';
export const CONFIRM_KEY = 'confirm';

/** No session needed; if there is one, the user is still put on the request. */
export const AllowAnonymous = () => SetMetadata(PUBLIC_KEY, true);

/** Signed-in users with one of these roles (CUSTOMER or an admin role); none = any signed-in user. */
export const Roles = (...roles: AccessRole[]) => SetMetadata(ROLES_KEY, roles);

/** @Roles plus the Swagger auth schemes (bearer token or session cookie). */
export const Access = (...roles: AccessRole[]) =>
  applyDecorators(SetMetadata(ROLES_KEY, roles), ApiBearerAuth(), ApiCookieAuth());

/**
 * Open to a super admin who has neither 2FA nor a passkey yet. Only what the setup screen needs (GET /user): every
 * other route answers them 403 TWO_FACTOR_SETUP_REQUIRED until one is set up.
 */
export const AllowWithoutTwoFactor = () => SetMetadata(WITHOUT_2FA_KEY, true);

/**
 * Re-prove it's you (authenticator code or passkey) before this route runs (ConfirmationGuard). `action`: each call
 * spends one confirmation, sent as the X-Confirmation header (or `?confirmation=` on uploads). `window`: any
 * confirmation of this session from the last ten minutes will do. Otherwise 403 CONFIRMATION_REQUIRED.
 */
export const Confirm = (mode: 'action' | 'window', options: Pick<ConfirmRule, 'when'> = {}) =>
  applyDecorators(
    SetMetadata(CONFIRM_KEY, { mode, ...options } satisfies ConfirmRule),
    ApiHeader({
      name: 'X-Confirmation',
      required: false,
      description:
        mode === 'action'
          ? 'Token from POST /confirmations (spent by this call). Without it: 403 CONFIRMATION_REQUIRED'
          : 'Not needed when this session confirmed in the last 10 minutes; otherwise 403 CONFIRMATION_REQUIRED',
    }),
  );

export interface ConfirmRule {
  mode: 'action' | 'window';
  /** Only some calls need it (e.g. approving a bank-details change but not an address one). */
  when?: (request: Request, prisma: PrismaClient) => Promise<boolean>;
}

/** Still accepts writes while the platform is in maintenance mode. */
export const BypassMaintenance = () => SetMetadata(BYPASS_MAINTENANCE_KEY, true);

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthUser => {
  const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
  if (!user) throw new UnauthorizedException('Sign in to continue');
  return user;
});
