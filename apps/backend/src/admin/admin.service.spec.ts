jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
jest.mock('src/notifications/mail.service', () => ({ MailService: class {} }));
jest.mock('src/notifications/customer-notifier.service', () => ({ CustomerNotifierService: class {} }));
jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));

import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { captureJobError } from 'src/common/observability';
import { SYSTEM_ACTOR_ID } from 'src/ledger/ledger.constants';
import { AdminService, EMAIL_TAKEN, LAST_SUPER_ADMIN } from './admin.service';

const ACTOR = 'AD-ACTOR';

function setup() {
  const tx = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    admin: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    twoFactor: { deleteMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const ledgerTx = {
    transaction: jest.fn((work: (t: typeof tx) => Promise<unknown>) => work(tx)),
    audit: jest.fn(),
  };
  const accounts = {
    createWithPassword: jest.fn(),
    setPassword: jest.fn(),
    revokeSessions: jest.fn(),
    clearSignInFactors: jest.fn().mockResolvedValue({ twoFactor: true, passkeys: 1 }),
  };
  const mail = { sendAdminInvite: jest.fn() };
  const notifier = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminService({} as never, ledgerTx as never, accounts as never, mail as never, notifier as never);
  return { service, tx, ledgerTx, accounts, mail, notifier };
}

describe('AdminService.inviteAdmin', () => {
  const dto = { email: ' New@Example.com ', name: ' Ada Obi ', role: 'ADMIN' as const };

  it('creates a new admin account, its Admin row and an audit entry, then emails the password', async () => {
    const { service, tx, ledgerTx, accounts, mail } = setup();

    const result = await service.inviteAdmin(dto, ACTOR);

    expect(result).toEqual({ name: 'Ada Obi', reactivated: false, emailSent: true });
    const [, input] = accounts.createWithPassword.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(input).toMatchObject({
      type: 'ADMIN',
      name: 'Ada Obi',
      email: 'new@example.com',
      status: 'ACTIVE',
      emailVerified: true,
    });
    expect(input.id).toMatch(/^AD-/);
    expect(tx.admin.create).toHaveBeenCalledWith({ data: { userId: input.id, role: 'ADMIN' } });
    expect(ledgerTx.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ actorId: ACTOR, action: 'ADMIN_INVITED', entityType: 'USER', entityId: input.id }),
    );
    expect(mail.sendAdminInvite).toHaveBeenCalledWith('new@example.com', 'Ada Obi', input.password, input.id, 'ADMIN');
  });

  it('re-activates a removed (INACTIVE) admin with the new role and a new password', async () => {
    const { service, tx, ledgerTx, accounts, mail } = setup();
    tx.user.findUnique.mockResolvedValue({
      id: 'AD-OLD',
      type: 'ADMIN',
      status: 'INACTIVE',
      admin: { role: 'MARKETER' },
    });

    const result = await service.inviteAdmin({ ...dto, role: 'SUPER_ADMIN' }, ACTOR);

    expect(result).toEqual({ name: 'Ada Obi', reactivated: true, emailSent: true });
    expect(accounts.createWithPassword).not.toHaveBeenCalled();
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'AD-OLD', status: 'INACTIVE' },
      data: expect.objectContaining({ status: 'ACTIVE', twoFactorEnabled: false }),
    });
    expect(tx.admin.update).toHaveBeenCalledWith({ where: { userId: 'AD-OLD' }, data: { role: 'SUPER_ADMIN' } });
    expect(accounts.clearSignInFactors).toHaveBeenCalledWith(tx, 'AD-OLD');
    expect(accounts.setPassword).toHaveBeenCalledWith(tx, 'AD-OLD', expect.any(String));
    expect(ledgerTx.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'ADMIN_INVITED', entityId: 'AD-OLD' }),
    );
    expect(mail.sendAdminInvite).toHaveBeenCalledWith(
      'new@example.com',
      'Ada Obi',
      expect.any(String),
      'AD-OLD',
      'SUPER_ADMIN',
    );
  });

  it.each([
    ['a customer', { id: 'MB-1', type: 'CUSTOMER', status: 'INACTIVE', admin: null }],
    ['an active admin', { id: 'AD-1', type: 'ADMIN', status: 'ACTIVE', admin: { role: 'ADMIN' } }],
    ['the system account', { id: 'system', type: 'ADMIN', status: 'INACTIVE', admin: { role: 'SYSTEM' } }],
  ])('refuses an email that belongs to %s with a 409', async (_, existing) => {
    const { service, tx, accounts, mail } = setup();
    tx.user.findUnique.mockResolvedValue(existing);

    await expect(service.inviteAdmin(dto, ACTOR)).rejects.toThrow(new ConflictException(EMAIL_TAKEN));
    expect(accounts.createWithPassword).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(mail.sendAdminInvite).not.toHaveBeenCalled();
  });

  it('keeps the invite when the email fails, and reports it', async () => {
    const { service, mail } = setup();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    mail.sendAdminInvite.mockRejectedValue(new Error('Resend down'));

    const result = await service.inviteAdmin(dto, ACTOR);

    expect(result.emailSent).toBe(false);
    expect(captureJobError).toHaveBeenCalled();
  });
});

describe('AdminService.removeAdmin', () => {
  it('refuses removing yourself', async () => {
    const { service, ledgerTx } = setup();
    await expect(service.removeAdmin(ACTOR, ACTOR)).rejects.toThrow(BadRequestException);
    expect(ledgerTx.transaction).not.toHaveBeenCalled();
  });

  it('refuses removing the SYSTEM account', async () => {
    const { service, tx, accounts } = setup();
    await expect(service.removeAdmin(SYSTEM_ACTOR_ID, ACTOR)).rejects.toThrow(BadRequestException);

    tx.admin.findUnique.mockResolvedValue({ role: 'SYSTEM', user: { name: 'System', status: 'ACTIVE' } });
    await expect(service.removeAdmin('AD-SYS', ACTOR)).rejects.toThrow(BadRequestException);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(accounts.revokeSessions).not.toHaveBeenCalled();
  });

  it('refuses removing the last active super admin', async () => {
    const { service, tx, accounts } = setup();
    tx.admin.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', user: { name: 'Sole', status: 'ACTIVE' } });
    tx.$queryRaw.mockResolvedValue([{ id: 'AD-SOLE' }]);

    await expect(service.removeAdmin('AD-SOLE', ACTOR)).rejects.toThrow(new ConflictException(LAST_SUPER_ADMIN));
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(accounts.revokeSessions).not.toHaveBeenCalled();
  });

  it('removes a super admin while another stays active', async () => {
    const { service, tx, accounts } = setup();
    tx.admin.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', user: { name: 'Two', status: 'ACTIVE' } });
    tx.$queryRaw.mockResolvedValue([{ id: 'AD-TWO' }, { id: ACTOR }]);

    await expect(service.removeAdmin('AD-TWO', ACTOR)).resolves.toEqual({ name: 'Two' });
    expect(accounts.revokeSessions).toHaveBeenCalledWith('AD-TWO');
  });

  it('marks the user INACTIVE, audits, keeps the Admin row and revokes sessions', async () => {
    const { service, tx, ledgerTx, accounts } = setup();
    tx.admin.findUnique.mockResolvedValue({ role: 'ADMIN', user: { name: 'Jane Doe', status: 'ACTIVE' } });

    await expect(service.removeAdmin('AD-JANE', ACTOR)).resolves.toEqual({ name: 'Jane Doe' });

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'AD-JANE', status: { not: 'INACTIVE' } },
      data: { status: 'INACTIVE' },
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.admin.update).not.toHaveBeenCalled();
    expect(ledgerTx.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ actorId: ACTOR, action: 'ADMIN_REMOVED', entityType: 'USER', entityId: 'AD-JANE' }),
    );
    expect(accounts.revokeSessions).toHaveBeenCalledWith('AD-JANE');
  });

  it('409s when another admin removed them first', async () => {
    const { service, tx, accounts } = setup();
    tx.admin.findUnique.mockResolvedValue({ role: 'ADMIN', user: { name: 'Jane Doe', status: 'ACTIVE' } });
    tx.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.removeAdmin('AD-JANE', ACTOR)).rejects.toThrow(ConflictException);
    expect(accounts.revokeSessions).not.toHaveBeenCalled();
  });
});

describe('AdminService.changeRole', () => {
  const active = (role: string) => ({ role, user: { name: 'Ada Obi', status: 'ACTIVE' } });

  it('refuses your own role and the SYSTEM account', async () => {
    const { service } = setup();
    await expect(service.changeRole(ACTOR, 'ADMIN', ACTOR)).rejects.toThrow(BadRequestException);
    await expect(service.changeRole(SYSTEM_ACTOR_ID, 'ADMIN', ACTOR)).rejects.toThrow(BadRequestException);
  });

  it('refuses demoting the last active super admin', async () => {
    const { service, tx } = setup();
    tx.admin.findUnique.mockResolvedValue(active('SUPER_ADMIN'));
    tx.$queryRaw.mockResolvedValue([{ id: 'AD-1' }]);
    await expect(service.changeRole('AD-1', 'ADMIN', ACTOR)).rejects.toThrow(LAST_SUPER_ADMIN);
    expect(tx.admin.update).not.toHaveBeenCalled();
  });

  it('refuses the role they already have, and removed admins', async () => {
    const { service, tx } = setup();
    tx.admin.findUnique.mockResolvedValueOnce(active('ADMIN'));
    await expect(service.changeRole('AD-1', 'ADMIN', ACTOR)).rejects.toThrow(ConflictException);
    tx.admin.findUnique.mockResolvedValueOnce({ role: 'ADMIN', user: { name: 'Ada', status: 'INACTIVE' } });
    await expect(service.changeRole('AD-1', 'MARKETER', ACTOR)).rejects.toThrow(ConflictException);
  });

  it('changes the role, audits from and to, and tells the admin', async () => {
    const { service, tx, ledgerTx, notifier } = setup();
    tx.admin.findUnique.mockResolvedValue(active('MARKETER'));
    await expect(service.changeRole('AD-1', 'SUPER_ADMIN', ACTOR)).resolves.toEqual({ name: 'Ada Obi', from: 'MARKETER' });
    expect(tx.admin.update).toHaveBeenCalledWith({ where: { userId: 'AD-1' }, data: { role: 'SUPER_ADMIN' } });
    expect(ledgerTx.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'ADMIN_ROLE_CHANGED', entityId: 'AD-1', meta: { from: 'MARKETER', to: 'SUPER_ADMIN' } }),
    );
    expect(notifier.notify).toHaveBeenCalledWith('AD-1', expect.objectContaining({ title: 'Your role has changed' }));
  });
});

describe('AdminService.resetSignIn', () => {
  it('refuses your own account and the SYSTEM account', async () => {
    const { service, accounts } = setup();
    await expect(service.resetSignIn(ACTOR, 'Lost phone', ACTOR)).rejects.toThrow(BadRequestException);
    await expect(service.resetSignIn(SYSTEM_ACTOR_ID, 'Lost phone', ACTOR)).rejects.toThrow(BadRequestException);
    expect(accounts.clearSignInFactors).not.toHaveBeenCalled();
  });

  it('404s on an unknown user', async () => {
    const { service } = setup();
    await expect(service.resetSignIn('MB-NOPE', 'Lost phone', ACTOR)).rejects.toThrow(NotFoundException);
  });

  it('clears 2FA and passkeys, audits the reason, signs them out and tells them', async () => {
    const { service, tx, ledgerTx, accounts, notifier } = setup();
    tx.user.findUnique.mockResolvedValue({ name: 'Ada Obi', admin: null });
    await expect(service.resetSignIn('MB-1', 'Lost the phone; confirmed on a call', ACTOR)).resolves.toEqual({
      name: 'Ada Obi',
      twoFactor: true,
      passkeys: 1,
    });
    expect(accounts.clearSignInFactors).toHaveBeenCalledWith(tx, 'MB-1');
    expect(ledgerTx.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorId: ACTOR,
        action: 'SIGN_IN_RESET',
        entityId: 'MB-1',
        note: 'Lost the phone; confirmed on a call',
      }),
    );
    expect(accounts.revokeSessions).toHaveBeenCalledWith('MB-1');
    expect(notifier.notify).toHaveBeenCalledWith('MB-1', expect.objectContaining({ title: 'Your sign-in was reset' }));
  });
});
