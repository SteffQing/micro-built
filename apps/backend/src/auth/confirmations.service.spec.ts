jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
// better-auth is ESM-only; Jest can't load it (D14).
jest.mock('better-auth/crypto', () => ({ generateRandomString: () => 'T'.repeat(32) }));
jest.mock('@simplewebauthn/server', () => ({
  generateAuthenticationOptions: jest.fn().mockResolvedValue({ challenge: 'CHALLENGE', allowCredentials: [] }),
  verifyAuthenticationResponse: jest.fn(),
}));

import { BadRequestException, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthUser } from 'src/common/types';
import { ConfirmationGuard } from './confirmation.guard';
import {
  CONFIRMATION_REQUIRED,
  CONFIRMATION_SETUP_REQUIRED,
  ConfirmationsService,
  WINDOW_MS,
} from './confirmations.service';
import { Confirm } from './decorators';

const USER: AuthUser = {
  userId: 'AD-1',
  type: 'ADMIN',
  role: 'SUPER_ADMIN',
  email: 'ada@example.com',
  status: 'ACTIVE',
  twoFactorEnabled: true,
  hasPasskey: false,
};

function setup({ totp = true, passkeys = 0 } = {}) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ twoFactorEnabled: totp, _count: { passkeys } }) },
    confirmation: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    passkey: {
      findMany: jest.fn().mockResolvedValue([{ credentialID: 'CRED', transports: 'internal,hybrid' }]),
      findFirst: jest.fn().mockResolvedValue({ id: 'PK-1', credentialID: 'CRED', publicKey: 'AQID', counter: 3, transports: '' }),
      update: jest.fn(),
    },
  };
  const accounts = { assertTwoFactorCode: jest.fn().mockResolvedValue(undefined) };
  const service = new ConfirmationsService(prisma as never, accounts as never, {
    rpID: 'microbuiltprime.com',
    origin: ['https://microbuiltprime.com'],
  });
  return { service, prisma, accounts };
}

const refusal = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: ForbiddenException) => error.getResponse() as Record<string, unknown>,
  );

describe('ConfirmationsService', () => {
  it('asks a user with neither 2FA nor a passkey to set one up', async () => {
    const { service } = setup({ totp: false });
    await expect(refusal(service.assert(USER, 'S-1', undefined, 'window'))).resolves.toMatchObject({
      code: CONFIRMATION_SETUP_REQUIRED,
    });
  });

  it('a window gate passes on any confirmation of this session from the last ten minutes', async () => {
    const { service, prisma } = setup();
    prisma.confirmation.findFirst.mockResolvedValue({ id: 'C-1' });
    const before = Date.now();
    await expect(service.assert(USER, 'S-1', undefined, 'window')).resolves.toBeUndefined();
    const where = prisma.confirmation.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: 'AD-1', sessionId: 'S-1' });
    expect(where.confirmedAt.gte.getTime()).toBeGreaterThanOrEqual(before - WINDOW_MS - 5);
  });

  it('a window gate without a recent confirmation answers CONFIRMATION_REQUIRED with the methods', async () => {
    const { service } = setup({ passkeys: 1 });
    await expect(refusal(service.assert(USER, 'S-1', undefined, 'window'))).resolves.toMatchObject({
      code: CONFIRMATION_REQUIRED,
      mode: 'window',
      methods: { totp: true, passkey: true },
    });
  });

  it('an action gate needs a token and spends it once, bound to the session', async () => {
    const { service, prisma } = setup();
    await expect(refusal(service.assert(USER, 'S-1', undefined, 'action'))).resolves.toMatchObject({
      code: CONFIRMATION_REQUIRED,
      mode: 'action',
    });
    await expect(service.assert(USER, 'S-1', 'TOKEN', 'action')).resolves.toBeUndefined();
    const call = prisma.confirmation.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ id: 'TOKEN', userId: 'AD-1', sessionId: 'S-1', usedAt: null });
    expect(call.data.usedAt).toBeInstanceOf(Date);

    prisma.confirmation.updateMany.mockResolvedValue({ count: 0 }); // spent, expired or another session's
    await expect(refusal(service.assert(USER, 'S-1', 'TOKEN', 'action'))).resolves.toMatchObject({
      code: CONFIRMATION_REQUIRED,
    });
  });

  it('confirms with the authenticator code only when 2FA is on', async () => {
    const off = setup({ totp: false, passkeys: 1 });
    await expect(off.service.confirmWithCode('AD-1', 'S-1', '123456')).rejects.toThrow(ForbiddenException);

    const { service, accounts, prisma } = setup();
    const grant = await service.confirmWithCode('AD-1', 'S-1', '123456');
    expect(accounts.assertTwoFactorCode).toHaveBeenCalledWith('AD-1', '123456');
    expect(grant.token).toHaveLength(32);
    expect(prisma.confirmation.create.mock.calls[0][0].data).toMatchObject({
      userId: 'AD-1',
      sessionId: 'S-1',
      method: 'TOTP',
      confirmedAt: expect.any(Date),
    });
  });

  it('starts a passkey prompt for the user’s own passkeys, user verification required', async () => {
    const { service, prisma } = setup({ passkeys: 1 });
    const { id } = await service.passkeyOptions('AD-1', 'S-1');
    expect(generateAuthenticationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        userVerification: 'required',
        allowCredentials: [{ id: 'CRED', transports: ['internal', 'hybrid'] }],
      }),
    );
    expect(prisma.confirmation.create.mock.calls[0][0].data).toMatchObject({ id, challenge: 'CHALLENGE', sessionId: 'S-1' });
  });

  it('confirms with a verified passkey and moves its counter on; refuses one that fails', async () => {
    const { service, prisma } = setup({ passkeys: 1 });
    prisma.confirmation.findFirst.mockResolvedValue({ challenge: 'CHALLENGE' });
    (verifyAuthenticationResponse as jest.Mock).mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { newCounter: 4 },
    });
    const response = { id: 'CRED' } as never;
    await expect(service.confirmWithPasskey('AD-1', 'S-1', 'C'.repeat(32), response)).resolves.toMatchObject({
      token: 'C'.repeat(32),
    });
    expect(verifyAuthenticationResponse).toHaveBeenCalledWith(
      expect.objectContaining({ expectedChallenge: 'CHALLENGE', requireUserVerification: true }),
    );
    expect(prisma.passkey.update).toHaveBeenCalledWith({ where: { id: 'PK-1' }, data: { counter: 4 } });

    (verifyAuthenticationResponse as jest.Mock).mockRejectedValueOnce(new Error('bad signature'));
    await expect(service.confirmWithPasskey('AD-1', 'S-1', 'C'.repeat(32), response)).rejects.toThrow(ForbiddenException);
  });

  it('refuses an expired or unknown passkey prompt', async () => {
    const { service } = setup({ passkeys: 1 });
    await expect(service.confirmWithPasskey('AD-1', 'S-1', 'X'.repeat(32), { id: 'CRED' } as never)).rejects.toThrow(
      BadRequestException,
    );
  });
});

class Routes {
  @Confirm('action')
  gated() {}

  @Confirm('window', { when: async (request) => request.params.kind === 'bank' })
  sometimes() {}

  open() {}
}

describe('ConfirmationGuard', () => {
  function guardFor(handler: keyof Routes, request: Record<string, unknown>) {
    const confirmations = { assert: jest.fn().mockResolvedValue(undefined) };
    const guard = new ConfirmationGuard(new Reflector(), confirmations as never, {} as never);
    const context = {
      getType: () => 'http',
      getHandler: () => Routes.prototype[handler],
      getClass: () => Routes,
      switchToHttp: () => ({ getRequest: () => ({ headers: {}, query: {}, params: {}, ...request }) }),
    } as unknown as ExecutionContext;
    return { run: () => guard.canActivate(context), confirmations };
  }
  const signedIn = { user: USER, session: { session: { id: 'S-1' } } };

  it('leaves unmarked routes alone', async () => {
    const { run, confirmations } = guardFor('open', signedIn);
    await expect(run()).resolves.toBe(true);
    expect(confirmations.assert).not.toHaveBeenCalled();
  });

  it('checks the header token, or the query one uploads use', async () => {
    const header = guardFor('gated', { ...signedIn, headers: { 'x-confirmation': 'H' } });
    await header.run();
    expect(header.confirmations.assert).toHaveBeenCalledWith(USER, 'S-1', 'H', 'action');

    const query = guardFor('gated', { ...signedIn, query: { confirmation: 'Q' } });
    await query.run();
    expect(query.confirmations.assert).toHaveBeenCalledWith(USER, 'S-1', 'Q', 'action');
  });

  it('applies a conditional rule only when it holds', async () => {
    const skipped = guardFor('sometimes', { ...signedIn, params: { kind: 'address' } });
    await skipped.run();
    expect(skipped.confirmations.assert).not.toHaveBeenCalled();

    const applied = guardFor('sometimes', { ...signedIn, params: { kind: 'bank' } });
    await applied.run();
    expect(applied.confirmations.assert).toHaveBeenCalledWith(USER, 'S-1', undefined, 'window');
  });
});
