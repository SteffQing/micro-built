jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));
jest.mock('src/ledger/balances', () => ({ loanBalancesMany: jest.fn() }));
jest.mock('src/ledger/repayment-rate', () => ({ repaymentRates: jest.fn().mockResolvedValue(new Map([['MB-1', 90]])) }));

import { BadRequestException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import type { AuthUser } from 'src/common/types';
import { Prisma } from '@prisma/client';
import { loanBalancesMany } from 'src/ledger/balances';
import type { CustomerLoanTopupDto } from '../common/dto/customer.dto';
import { CustomerService, FLAG_REASON_REQUIRED, ONLY_SUPER_ADMIN_STATUS } from './customer.service';

const admin = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  userId: 'AD-1',
  type: 'ADMIN',
  role: 'ADMIN',
  email: 'admin@example.com',
  status: 'ACTIVE',
  twoFactorEnabled: true,
  hasPasskey: false,
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

  it('kind decides cash or asset, with no category', async () => {
    const { service, ledger, tx } = setup();
    await service.loanTopup('MB-1', { kind: 'CASH', cashLoan: { amount: 50000 } }, admin());
    expect(ledger.requestTopup).toHaveBeenCalledWith(expect.objectContaining({ amount: 50000 }));
    await service.loanTopup('MB-1', { kind: 'ASSET', commodityLoan: { assetName: 'Laptop' } }, admin());
    expect(tx.commodityLoan.create).toHaveBeenCalled();
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

describe('loan summary', () => {
  const d = (n: number) => new Prisma.Decimal(n);
  const parts = (principal: number, interest: number) => ({ principal: d(principal), interest: d(interest), penalty: d(0) });

  function summarySetup(counts: { loans: number[]; topups: number[]; assets: number }, next: unknown, balances: unknown[]) {
    const { service, prisma } = setup();
    const loanCount = jest.fn();
    counts.loans.forEach((n) => loanCount.mockResolvedValueOnce(n)); // PENDING, APPROVED
    const topupCount = jest.fn();
    counts.topups.forEach((n) => topupCount.mockResolvedValueOnce(n)); // PENDING, APPROVED
    Object.assign(prisma, {
      loan: { findMany: jest.fn().mockResolvedValue(balances.map((_, i) => ({ id: `LN-${i + 1}` }))), count: loanCount },
      microLoan: { count: topupCount },
      commodityLoan: { count: jest.fn().mockResolvedValue(counts.assets) },
      deduction: { findFirst: jest.fn().mockResolvedValue(next) },
      repayment: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    (loanBalancesMany as jest.Mock).mockResolvedValue(new Map(balances.map((b, i) => [`LN-${i + 1}`, b])));
    return service;
  }

  it('shows the next deduction, the months left and the open requests by kind', async () => {
    const service = summarySetup(
      { loans: [1, 0], topups: [0, 2], assets: 1 },
      { expected: d(41308.33), period: { year: 2026, month: 'NOVEMBER' } },
      [
        {
          status: 'DISBURSED',
          booked: parts(100000, 24000),
          collected: parts(0, 0),
          managementFee: d(3000),
          repaid: d(0),
          outstanding: d(124000),
          remainingMonths: 3,
        },
      ],
    );

    expect(await service.getSummary('MB-1')).toMatchObject({
      outstanding: 124000,
      monthlyDeduction: 41308.33,
      monthsLeft: 3,
      nextDeductionPeriod: 'NOVEMBER 2026',
      openRequests: { loans: 1, topups: 2, assets: 1, total: 4 },
      repaymentRate: 90,
    });
  });

  it("counts a deduction awaiting its voucher as the next one (the next month's opens only once it settles)", async () => {
    const service = summarySetup({ loans: [0, 0], topups: [0, 0], assets: 0 }, null, []);
    const prisma = (service as unknown as { prisma: { deduction: { findFirst: jest.Mock } } }).prisma;
    await service.getSummary('MB-1');
    expect(prisma.deduction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['OPEN', 'AWAITING'] }, loan: { borrowerId: 'MB-1', status: 'DISBURSED' } },
        orderBy: [{ period: { year: 'asc' } }, { period: { month: 'asc' } }],
      }),
    );
  });

  it('has no deduction tiles without a running loan', async () => {
    const service = summarySetup({ loans: [0, 0], topups: [0, 0], assets: 0 }, null, []);

    expect(await service.getSummary('MB-1')).toMatchObject({
      monthlyDeduction: null,
      monthsLeft: null,
      nextDeductionPeriod: null,
      openRequests: { loans: 0, topups: 0, assets: 0, total: 0 },
    });
  });
});

describe('payroll', () => {
  const record = {
    externalId: 'PF1',
    netPay: new Prisma.Decimal('180000.5'),
    employeeGross: new Prisma.Decimal('240000'),
    grade: 'L12',
    step: 3,
    command: 'Lagos Command',
    organizationId: 'ORG-NPF',
    organization: { name: 'NPF' },
  };
  const expected = {
    externalId: 'PF1',
    netPay: 180000.5,
    employeeGross: 240000,
    grade: 'L12',
    step: 3,
    command: 'Lagos Command',
    organization: 'NPF',
    organizationId: 'ORG-NPF',
  };

  it('keeps the organization’s name and adds its id, on the payroll tab and in the PPI', async () => {
    const { service, prisma } = setup();
    prisma.customer.findUnique.mockResolvedValue({ payroll: record, identity: null, paymentMethod: null });

    await expect(service.getPayroll('MB-1')).resolves.toEqual(expected);
    await expect(service.getPPI('MB-1')).resolves.toEqual({ payroll: expected, identity: null, paymentMethod: null });
  });

  it('is null before the customer has a payroll record', async () => {
    const { service, prisma } = setup();
    prisma.customer.findUnique.mockResolvedValue({ payroll: null });
    await expect(service.getPayroll('MB-1')).resolves.toBeNull();
  });
});
