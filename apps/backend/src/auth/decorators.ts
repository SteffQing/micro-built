import {
  applyDecorators,
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import type { AccessRole, AuthUser } from 'src/common/types';

// Read by the global AccessGuard (access.guard.ts). Every route needs a signed-in user unless it
// is marked @AllowAnonymous(). Nothing here imports better-auth, so controllers stay loadable in
// Jest (D14).

export const PUBLIC_KEY = 'PUBLIC';
export const ROLES_KEY = 'roles';
export const WITHOUT_2FA_KEY = 'allowWithoutTwoFactor';
export const BYPASS_MAINTENANCE_KEY = 'bypassMaintenance';

/** No session needed; if there is one, the user is still put on the request. */
export const AllowAnonymous = () => SetMetadata(PUBLIC_KEY, true);

/** Signed-in users with one of these roles (CUSTOMER or an admin role); none = any signed-in user. */
export const Roles = (...roles: AccessRole[]) => SetMetadata(ROLES_KEY, roles);

/** @Roles plus the Swagger auth schemes (bearer token or session cookie). */
export const Access = (...roles: AccessRole[]) =>
  applyDecorators(SetMetadata(ROLES_KEY, roles), ApiBearerAuth(), ApiCookieAuth());

/**
 * Open to an admin who hasn't turned on 2FA yet. Only what the setup screen needs (GET /user):
 * every other route answers 403 TWO_FACTOR_SETUP_REQUIRED until 2FA is on (§0.2 release blocker).
 */
export const AllowWithoutTwoFactor = () => SetMetadata(WITHOUT_2FA_KEY, true);

/** Still accepts writes while the platform is in maintenance mode. */
export const BypassMaintenance = () => SetMetadata(BYPASS_MAINTENANCE_KEY, true);

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthUser => {
  const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
  if (!user) throw new UnauthorizedException('Sign in to continue');
  return user;
});
