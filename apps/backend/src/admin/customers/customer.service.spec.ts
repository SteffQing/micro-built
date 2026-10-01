jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));

import { BadRequestException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import type { AuthUser } from 'src/common/types';
import type { CustomerLoanTopupDto } from '../common/dto/customer.dto';
import { CustomerService, FLAG_REASON_REQUIRED, ONLY_SUPER_ADMIN_STATUS } from './customer.service';

const admin = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  userId: 'AD-1',
  type: 'ADMIN',
  role: 'ADMIN',
  email: 'admin@example.com',
  status: 'ACTIVE',
  twoFactorEnabled: true,
  ...overrides,
});

function setup() {
  const tx = {
    user: { update: jest.fn() },
    customer: { update: jest.fn() },
    loan: { findUniqueOrThrow: jest.fn().mockResolvedValue({ status: 'DISBURSED' }) },
    commodityLoan: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'CL-1' }) },
    microLoan: { count: jest.fn().mockResolvedValue(0) },
  };
  const prisma = {
    customer: {
      findUnique: jest.fn().mockResolvedValue({
        userId: 'MB-1',
        accountOfficerId: 'AD-1',
        user: { name: 'Jane Doe', status: 'ACTIVE' },
      }),
    },
    loan: { findFirst: jest.fn().mockResolvedValue({ id: 'LN-1' }) },
    commodity: { findFirst: jest.fn().mockResolvedValue({ id: 'COM-1' }) },
  };
  const ledgerTx = {
    transaction: jest.fn((work: (t: typeof tx) => Promise<unknown>) => work(tx)),
    audit: jest.fn(),
    lockLoan: jest.fn(),
  };
  const ledger = { requestTopup: jest.fn().mockResolvedValue({ id: 'ML-1' }) };
  const accounts = { revokeSessions: jest.fn().mockResolvedValue(undefined) };
  const inapp = { messageUser: jest.fn() };
  const service = new CustomerService(
    prisma as never,
    ledgerTx as never,
    ledger as never,
    {} as never,
    accounts as never,
    inapp as never,
  );
  return { service, tx, prisma, ledgerTx, ledger, accounts };
}

describe('status change', () => {
  it('flags with the reason, audits the change and keeps sessions', async () => {
    const { service, tx, ledgerTx, accounts } = setup();

    const message = await service.updateStatus('MB-1', { status: 'FLAGGED', reason: ' ID mismatch ' }, admin());

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'MB-1' }, data: { status: 'FLAGGED' } });
    expect(tx.customer.update).toHaveBeenCalledWith({ where: { userId: 'MB-1' }, data: { flagReason: 'ID mismatch' } });
    expect(ledgerTx.audit).toHaveBeenCalledWith(tx, {
      actorId: 'AD-1',
      action: 'CUSTOMER_STATUS_CHANGED',
      entityType: 'USER',
      entityId: 'MB-1',
      note: 'ACTIVE → FLAGGED: ID mismatch',
    });
    expect(accounts.revokeSessions).not.toHaveBeenCalled();
    expect(message).toBe("Jane Doe's account is now flagged");
  });

  it('needs a reason to flag', async () => {
    const { service, tx } = setup();
    await expect(service.updateStatus('MB-1', { status: 'FLAGGED', reason: '  ' }, admin())).rejects.toThrow(
      new BadRequestException(FLAG_REASON_REQUIRED),
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('clears the flag reason on ACTIVE', async () => {
    const { service, prisma, tx, ledgerTx } = setup();
    prisma.customer.findUnique.mockResolvedValue({ user: { name: 'Jane Doe', status: 'FLAGGED' } });

    await service.updateStatus('MB-1', { status: 'ACTIVE' }, admin({ role: 'SUPER_ADMIN' }));

    expect(tx.customer.update).toHaveBeenCalledWith({ where: { userId: 'MB-1' }, data: { flagReason: null } });
    expect(ledgerTx.audit.mock.calls[0][1]).toMatchObject({ note: 'FLAGGED → ACTIVE' });
  });

  it('signs the customer out everywhere on INACTIVE, after commit', async () => {
    const { service, tx, ledgerTx, accounts } = setup();

    await service.updateStatus('MB-1', { status: 'INACTIVE', reason: 'Left service' }, admin({ role: 'SUPER_ADMIN' }));

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'MB-1' }, data: { status: 'INACTIVE' } });
    expect(tx.customer.update).not.toHaveBeenCalled();
    expect(ledgerTx.audit.mock.calls[0][1]).toMatchObject({ note: 'ACTIVE → INACTIVE: Left service' });
    expect(accounts.revokeSessions).toHaveBeenCalledWith('MB-1');
    expect(accounts.revokeSessions.mock.invocationCallOrder[0]).toBeGreaterThan(
      ledgerTx.transaction.mock.invocationCallOrder[0],
    );
  });

  it('a failed sign-out does not fail the request (the guard already blocks INACTIVE users)', async () => {
    const { service, accounts } = setup();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    accounts.revokeSessions.mockRejectedValue(new Error('redis down'));
    await expect(
      service.updateStatus('MB-1', { status: 'INACTIVE' }, admin({ role: 'SUPER_ADMIN' })),
    ).resolves.toContain('inactive');
  });

  it('only a super admin activates or deactivates', async () => {
    const { service, tx } = setup();
    await expect(service.updateStatus('MB-1', { status: 'INACTIVE' }, admin())).rejects.toThrow(
      new ForbiddenException(ONLY_SUPER_ADMIN_STATUS),
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('loan top-up', () => {
  const cash = (overrides: Partial<CustomerLoanTopupDto> = {}): CustomerLoanTopupDto => ({
    category: 'PERSONAL',
    cashLoan: { amount: 50000 },
    ...overrides,
  });

  it('cash: a PENDING top-up through the ledger, with the tenure change', async () => {
    const { service, ledger, ledgerTx } = setup();

    const result = await service.loanTopup('MB-1', cash({ monthsDelta: 3 }), admin());

    expect(ledger.requestTopup).toHaveBeenCalledWith({
      loanId: 'LN-1',
      amount: 50000,
      requestedById: 'AD-1',
      monthsDelta: 3,
    });
    expect(ledgerTx.transaction).not.toHaveBeenCalled();
    expect(result.data).toEqual({ kind: 'CASH', loanId: 'LN-1', topupId: 'ML-1', commodityLoanId: null });
  });

  it('cash: refuses a tenure (monthsDelta changes it)', async () => {
    const { service, ledger } = setup();
    await expect(service.loanTopup('MB-1', cash({ cashLoan: { amount: 1, tenure: 6 } }), admin())).rejects.toThrow(
      BadRequestException,
    );
    expect(ledger.requestTopup).not.toHaveBeenCalled();
  });

  it('asset: a request in review on the running loan, no money moved', async () => {
    const { service, tx, ledger, ledgerTx, prisma } = setup();

    const result = await service.loanTopup(
      'MB-1',
      { category: 'ASSET_PURCHASE', commodityLoan: { assetName: '  solar   PANEL ' } },
      admin(),
    );

    expect(prisma.commodity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: { equals: 'Solar Panel', mode: 'insensitive' }, active: true } }),
    );
    expect(ledgerTx.lockLoan).toHaveBeenCalledWith(tx, 'LN-1');
    expect(tx.commodityLoan.create).toHaveBeenCalledWith({
      data: { loanId: 'LN-1', commodityId: 'COM-1', status: 'IN_REVIEW' },
      select: { id: true },
    });
    expect(ledger.requestTopup).not.toHaveBeenCalled();
    expect(result.data).toEqual({ kind: 'ASSET', loanId: 'LN-1', topupId: null, commodityLoanId: 'CL-1' });
  });

  it('asset: 409 while a top-up is waiting', async () => {
    const { service, tx } = setup();
    tx.microLoan.count.mockResolvedValue(1);
    await expect(
      service.loanTopup('MB-1', { category: 'ASSET_PURCHASE', commodityLoan: { assetName: 'Laptop' } }, admin()),
    ).rejects.toThrow(ConflictException);
    expect(tx.commodityLoan.create).not.toHaveBeenCalled();
  });

  it('asset: monthsDelta is decided on approval, not here', async () => {
    const { service } = setup();
    await expect(
      service.loanTopup(
        'MB-1',
        { category: 'ASSET_PURCHASE', commodityLoan: { assetName: 'Laptop' }, monthsDelta: 2 },
        admin(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('409 without a running loan', async () => {
    const { service, prisma } = setup();
    prisma.loan.findFirst.mockResolvedValue(null);
    await expect(service.loanTopup('MB-1', cash(), admin())).rejects.toThrow(ConflictException);
  });

  it("a marketer can't top up someone else's customer", async () => {
    const { service, ledger } = setup();
    await expect(service.loanTopup('MB-1', cash(), admin({ userId: 'AD-2', role: 'MARKETER' }))).rejects.toThrow(
      ForbiddenException,
    );
    expect(ledger.requestTopup).not.toHaveBeenCalled();
  });
});
