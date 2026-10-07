import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from 'src/common/types';
import { AccessGuard, TWO_FACTOR_SETUP_REQUIRED, ROLE_FORBIDDEN } from './access.guard';
import type { AuthAccountsService } from './auth-accounts.service';
import { Access, AllowAnonymous, AllowWithoutTwoFactor } from './decorators';

// better-auth and its Nest adapter are ESM-only; Jest can't load them (D14).
jest.mock('@thallesp/nestjs-better-auth', () => ({ AuthService: class AuthService {} }));
jest.mock('better-auth/node', () => ({ fromNodeHeaders: (headers: unknown) => headers }));
jest.mock('./auth-accounts.service', () => ({ AuthAccountsService: class AuthAccountsService {} }));

class Routes {
  @AllowAnonymous()
  open() {}

  @Access()
  anySignedIn() {}

  @Access('SUPER_ADMIN')
  superAdmins() {}

  @AllowWithoutTwoFactor()
  @Access()
  profile() {}
}

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  userId: 'MB-1',
  type: 'CUSTOMER',
  role: 'CUSTOMER',
  email: 'ada@example.com',
  status: 'ACTIVE',
  twoFactorEnabled: false,
  hasPasskey: false,
  ...overrides,
});

function setup(signedIn: AuthUser | null) {
  const auth = { api: { getSession: jest.fn().mockResolvedValue(signedIn ? { user: { id: signedIn.userId } } : null) } };
  const accounts = { accessUser: jest.fn().mockResolvedValue(signedIn) };
  const guard = new AccessGuard(new Reflector(), auth as never, accounts as unknown as AuthAccountsService);
  const request: { headers: object; user?: AuthUser } = { headers: {} };
  const context = (handler: keyof Routes) =>
    ({
      getType: () => 'http',
      getHandler: () => Routes.prototype[handler],
      getClass: () => Routes,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;
  return { guard, context, request };
}

const admin = (overrides: Partial<AuthUser> = {}) =>
  user({ userId: 'AD-1', type: 'ADMIN', role: 'ADMIN', twoFactorEnabled: true, ...overrides });

describe('AccessGuard', () => {
  it('lets anyone through an @AllowAnonymous route, and still attaches a signed-in user', async () => {
    const anonymous = setup(null);
    await expect(anonymous.guard.canActivate(anonymous.context('open'))).resolves.toBe(true);

    const signedIn = setup(user());
    await expect(signedIn.guard.canActivate(signedIn.context('open'))).resolves.toBe(true);
    expect(signedIn.request.user?.userId).toBe('MB-1');
  });

  it('treats every other route as private', async () => {
    const { guard, context } = setup(null);
    await expect(guard.canActivate(context('anySignedIn'))).rejects.toThrow(UnauthorizedException);
  });

  it('refuses a deactivated account', async () => {
    const { guard, context } = setup(user({ status: 'INACTIVE' }));
    await expect(guard.canActivate(context('anySignedIn'))).rejects.toThrow(ForbiddenException);
  });

  it('keeps a super admin with neither 2FA nor a passkey out of everything but the profile', async () => {
    const { guard, context } = setup(admin({ role: 'SUPER_ADMIN', twoFactorEnabled: false }));
    const refusal = await guard.canActivate(context('anySignedIn')).catch((error: ForbiddenException) => error);
    expect(refusal).toBeInstanceOf(ForbiddenException);
    expect((refusal as ForbiddenException).getResponse()).toMatchObject({ code: TWO_FACTOR_SETUP_REQUIRED });
    await expect(guard.canActivate(context('profile'))).resolves.toBe(true);
  });

  it('lets a super admin in with 2FA or with a passkey', async () => {
    const withCode = setup(admin({ role: 'SUPER_ADMIN' }));
    await expect(withCode.guard.canActivate(withCode.context('anySignedIn'))).resolves.toBe(true);
    const withPasskey = setup(admin({ role: 'SUPER_ADMIN', twoFactorEnabled: false, hasPasskey: true }));
    await expect(withPasskey.guard.canActivate(withPasskey.context('anySignedIn'))).resolves.toBe(true);
  });

  it('never makes admins, marketers or customers set up 2FA to get in', async () => {
    for (const role of ['ADMIN', 'MARKETER'] as const) {
      const signedIn = setup(admin({ role, twoFactorEnabled: false }));
      await expect(signedIn.guard.canActivate(signedIn.context('anySignedIn'))).resolves.toBe(true);
    }
    const customer = setup(user());
    await expect(customer.guard.canActivate(customer.context('anySignedIn'))).resolves.toBe(true);
  });

  it('enforces @Access roles', async () => {
    const plainAdmin = setup(admin({ role: 'ADMIN' }));
    const refusal = await plainAdmin.guard
      .canActivate(plainAdmin.context('superAdmins'))
      .catch((error: ForbiddenException) => error);
    expect(refusal).toBeInstanceOf(ForbiddenException);
    // Coded, so an app holding a stale role refetches it.
    expect((refusal as ForbiddenException).getResponse()).toMatchObject({ code: ROLE_FORBIDDEN });
    const superAdmin = setup(admin({ role: 'SUPER_ADMIN' }));
    await expect(superAdmin.guard.canActivate(superAdmin.context('superAdmins'))).resolves.toBe(true);
  });
});
