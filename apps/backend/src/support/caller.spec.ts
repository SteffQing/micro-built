import type { Request, Response } from 'express';
import type { AuthUser } from 'src/common/types';
import { VISITOR_COOKIE, canHandoff, ownerOf, readCookie, resolveCaller } from './caller';

const user = (over: Partial<AuthUser> = {}): AuthUser => ({
  userId: 'u1',
  type: 'CUSTOMER',
  role: 'CUSTOMER',
  email: 'ada@example.com',
  status: 'ACTIVE',
  twoFactorEnabled: false,
  hasPasskey: false,
  ...over,
});

const request = (over: { user?: AuthUser; cookie?: string; ip?: string } = {}) =>
  ({
    user: over.user,
    headers: { ...(over.cookie && { cookie: over.cookie }), ...(over.ip && { 'x-client-ip': over.ip }) },
  }) as unknown as Request & { user?: AuthUser };

const response = () => ({ cookie: jest.fn() }) as unknown as Response & { cookie: jest.Mock };

describe('resolveCaller', () => {
  it('makes a signed-out caller a visitor with a new httpOnly cookie', () => {
    const res = response();
    const caller = resolveCaller(request({ ip: '102.89.1.2' }), res);
    expect(caller).toMatchObject({ audience: 'ANONYMOUS', restricted: false, user: null, ip: '102.89.1.2' });
    expect(caller.visitorId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.cookie).toHaveBeenCalledWith(
      VISITOR_COOKIE,
      caller.visitorId,
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 }),
    );
    expect(ownerOf(caller)).toEqual({ visitorId: caller.visitorId });
  });

  it("keeps a visitor's cookie, and replaces one that isn't ours", () => {
    const id = 'a'.repeat(43);
    const res = response();
    expect(resolveCaller(request({ cookie: `x=1; ${VISITOR_COOKIE}=${id}` }), res).visitorId).toBe(id);
    expect(res.cookie).not.toHaveBeenCalled();

    const forged = resolveCaller(request({ cookie: `${VISITOR_COOKIE}=../../etc` }), res);
    expect(forged.visitorId).not.toBe('../../etc');
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });

  it('gives a signed-in user the audience of their role, and their conversations', () => {
    expect(resolveCaller(request({ user: user() }))).toMatchObject({ audience: 'CUSTOMER', restricted: false, visitorId: null });
    expect(resolveCaller(request({ user: user({ type: 'ADMIN', role: 'MARKETER' }) })).audience).toBe('MARKETER');
    expect(resolveCaller(request({ user: user({ type: 'ADMIN', role: 'ADMIN' }) })).audience).toBe('ADMIN');
    const superAdmin = resolveCaller(request({ user: user({ type: 'ADMIN', role: 'SUPER_ADMIN', hasPasskey: true }) }));
    expect(superAdmin).toMatchObject({ audience: 'SUPER_ADMIN', restricted: false });
    expect(ownerOf(superAdmin)).toEqual({ userId: 'u1' });
  });

  it('restricts a deactivated user, and a super admin without 2FA or a passkey', () => {
    expect(resolveCaller(request({ user: user({ status: 'INACTIVE' }) }))).toMatchObject({ audience: 'CUSTOMER', restricted: true });
    expect(resolveCaller(request({ user: user({ type: 'ADMIN', role: 'SUPER_ADMIN' }) }))).toMatchObject({
      audience: 'SUPER_ADMIN',
      restricted: true,
    });
    expect(
      resolveCaller(request({ user: user({ type: 'ADMIN', role: 'SUPER_ADMIN', twoFactorEnabled: true }) })).restricted,
    ).toBe(false);
    // An admin without 2FA isn't made to set it up (only super admins are).
    expect(resolveCaller(request({ user: user({ type: 'ADMIN', role: 'ADMIN' }) })).restricted).toBe(false);
  });

  it('lets customers, marketers and visitors hand off, not the responders', () => {
    expect(canHandoff({ audience: 'ANONYMOUS' })).toBe(true);
    expect(canHandoff({ audience: 'CUSTOMER' })).toBe(true);
    expect(canHandoff({ audience: 'MARKETER' })).toBe(true);
    expect(canHandoff({ audience: 'ADMIN' })).toBe(false);
    expect(canHandoff({ audience: 'SUPER_ADMIN' })).toBe(false);
  });

  it('reads one cookie out of the header', () => {
    expect(readCookie('a=1; b=two%20words; c=3', 'b')).toBe('two words');
    expect(readCookie(undefined, 'b')).toBeUndefined();
  });
});
