import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { LedgerService } from 'src/ledger/ledger.service';
import type { LedgerTx } from 'src/ledger/ledger.tx';
import type { PrismaService } from 'src/database/prisma.service';
import type { SettingsService } from 'src/settings/settings.service';
import {
  ACCOUNT_RESTRICTED,
  ASSET_LOAN_NOT_EDITABLE,
  ASSET_REQUEST_IN_REVIEW,
  CATEGORY_REQUIRED,
  COMMODITY_UNAVAILABLE,
  LOAN_IN_PROGRESS,
  LOAN_NOT_FOUND,
  LoanService,
  NOT_A_CUSTOMER,
  NOTHING_TO_UPDATE,
  ONLY_PENDING,
  TOPUP_WAITING,
} from './loan.service';

const CUSTOMER = 'MB-AAAAA';
const LOAN = 'LN-LIVE01';

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['borrowerId'] },
  });
}

/**
 * One mocked client serves as PrismaService and as every transaction client, so writes can be
 * checked wherever they happen. `live` is the customer's PENDING/APPROVED/DISBURSED loan, if any.
 */
function setup(
  opts: {
    live?: { id: string; status: string } | null;
    own?: { status: string; category: string } | null;
    customer?: { user: { status: string } } | null;
    commodity?: { id: string } | null;
    rates?: { interestRate: Prisma.Decimal | null; managementFeeRate: Prisma.Decimal | null };
  } = {},
) {
  const live = opts.live === undefined ? null : opts.live;
  const db = {
    customer: {
      findUnique: jest.fn().mockResolvedValue(opts.customer === undefined ? { user: { status: 'ACTIVE' } } : opts.customer),
    },
    commodity: { findFirst: jest.fn().mockResolvedValue(opts.commodity === undefined ? { id: 'CM-1' } : opts.commodity) },
    loan: {
      // liveLoan() and ownLoan() both use findFirst; tell them apart by the where clause.
      findFirst: jest.fn((args: { where: { id?: string } }) =>
        Promise.resolve(args.where.id ? (opts.own === undefined ? null : opts.own) : live),
      ),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ status: live?.status ?? 'DISBURSED' }),
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    commodityLoan: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'CR-1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    microLoan: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation((work: (tx: typeof db) => Promise<unknown>) => work(db));

  const ledger = { requestTopup: jest.fn().mockResolvedValue({ id: 'TOPUP-1' }) };
  const ledgerTx = {
    transaction: jest.fn((work: (tx: typeof db) => Promise<unknown>) => work(db)),
    lockLoan: jest.fn().mockResolvedValue(undefined),
  };
  const settings = {
    get: jest.fn().mockResolvedValue(
      opts.rates ?? { interestRate: new Prisma.Decimal('0.06'), managementFeeRate: new Prisma.Decimal('0.03') },
    ),
  };
  const service = new LoanService(
    db as unknown as PrismaService,
    ledger as unknown as LedgerService,
    ledgerTx as unknown as LedgerTx,
    settings as unknown as SettingsService,
  );
  return { db, ledger, ledgerTx, settings, service };
}

function expectNoWrites(ctx: ReturnType<typeof setup>) {
  expect(ctx.db.loan.create).not.toHaveBeenCalled();
  expect(ctx.db.commodityLoan.create).not.toHaveBeenCalled();
  expect(ctx.ledger.requestTopup).not.toHaveBeenCalled();
}

describe('LoanService — cash requests', () => {
  it('asks the ledger for a top-up when a disbursed loan exists', async () => {
    const ctx = setup({ live: { id: LOAN, status: 'DISBURSED' } });
    await expect(ctx.service.requestCashLoan(CUSTOMER, { amount: 50000, category: 'PERSONAL' })).resolves.toEqual({
      kind: 'TOPUP',
      id: 'TOPUP-1',
      loanId: LOAN,
    });
    expect(ctx.ledger.requestTopup).toHaveBeenCalledWith({ loanId: LOAN, amount: 50000 });
    expect(ctx.db.loan.create).not.toHaveBeenCalled();
  });

  it('passes on the ledger’s 409 when a top-up is already waiting', async () => {
    const ctx = setup({ live: { id: LOAN, status: 'DISBURSED' } });
    ctx.ledger.requestTopup.mockRejectedValue(new ConflictException(TOPUP_WAITING));
    await expect(ctx.service.requestCashLoan(CUSTOMER, { amount: 50000 })).rejects.toThrow(
      new ConflictException(TOPUP_WAITING),
    );
  });

  it.each(['PENDING', 'APPROVED'])('409s while a loan is %s', async (status) => {
    const ctx = setup({ live: { id: LOAN, status } });
    await expect(ctx.service.requestCashLoan(CUSTOMER, { amount: 50000, category: 'PERSONAL' })).rejects.toThrow(
      new ConflictException(LOAN_IN_PROGRESS),
    );
    expectNoWrites(ctx);
  });

  it('creates a PENDING loan at the current Settings rates, tenure 0 until approval', async () => {
    const ctx = setup();
    const result = await ctx.service.requestCashLoan(CUSTOMER, { amount: 100000.5, category: 'EDUCATION' });

    expect(result).toEqual({ kind: 'LOAN', id: expect.stringMatching(/^LN-/), loanId: result.id });
    expect(ctx.db.loan.create).toHaveBeenCalledWith({
      data: {
        id: result.id,
        borrowerId: CUSTOMER,
        category: 'EDUCATION',
        status: 'PENDING',
        principal: new Prisma.Decimal('100000.5'),
        tenure: 0,
        interestRate: new Prisma.Decimal('0.06'),
        managementFeeRate: new Prisma.Decimal('0.03'),
      },
    });
    expect(ctx.ledger.requestTopup).not.toHaveBeenCalled();
  });

  it('uses 0 rates as placeholders while Settings has none', async () => {
    const ctx = setup({ rates: { interestRate: null, managementFeeRate: null } });
    await ctx.service.requestCashLoan(CUSTOMER, { amount: 1000, category: 'RENT' });
    const { data } = ctx.db.loan.create.mock.calls[0][0] as { data: Record<string, Prisma.Decimal> };
    expect(data.interestRate.toNumber()).toBe(0);
    expect(data.managementFeeRate.toNumber()).toBe(0);
  });

  it('turns a race on the one-live-loan index (P2002) into the same 409', async () => {
    const ctx = setup();
    ctx.db.loan.create.mockRejectedValue(uniqueViolation());
    await expect(ctx.service.requestCashLoan(CUSTOMER, { amount: 1000, category: 'RENT' })).rejects.toThrow(
      new ConflictException(LOAN_IN_PROGRESS),
    );
  });

  it('needs a category for a new loan', async () => {
    const ctx = setup();
    await expect(ctx.service.requestCashLoan(CUSTOMER, { amount: 1000 })).rejects.toThrow(
      new BadRequestException(CATEGORY_REQUIRED),
    );
    expectNoWrites(ctx);
  });

  it('refuses a FLAGGED account (v1 rule) and an account without a customer profile', async () => {
    const flagged = setup({ customer: { user: { status: 'FLAGGED' } } });
    await expect(flagged.service.requestCashLoan(CUSTOMER, { amount: 1000, category: 'RENT' })).rejects.toThrow(
      new BadRequestException(ACCOUNT_RESTRICTED),
    );
    expectNoWrites(flagged);

    const admin = setup({ customer: null });
    await expect(admin.service.requestCashLoan('AD-XXXXX', { amount: 1000, category: 'RENT' })).rejects.toThrow(
      new ForbiddenException(NOT_A_CUSTOMER),
    );
    expectNoWrites(admin);
  });
});

describe('LoanService — commodity requests', () => {
  it('400s unless the name matches an active commodity (any case)', async () => {
    const ctx = setup({ commodity: null });
    await expect(ctx.service.requestCommodityLoan(CUSTOMER, '  solar PANEL ')).rejects.toThrow(
      new BadRequestException(COMMODITY_UNAVAILABLE),
    );
    expect(ctx.db.commodity.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'Solar Panel', mode: 'insensitive' }, active: true },
      select: { id: true },
    });
    expectNoWrites(ctx);
  });

  it('adds an IN_REVIEW asset request to a disbursed loan, under the loan lock', async () => {
    const ctx = setup({ live: { id: LOAN, status: 'DISBURSED' } });
    await expect(ctx.service.requestCommodityLoan(CUSTOMER, 'laptop')).resolves.toEqual({
      kind: 'TOPUP',
      id: 'CR-1',
      loanId: LOAN,
    });
    expect(ctx.ledgerTx.lockLoan).toHaveBeenCalledWith(ctx.db, LOAN);
    expect(ctx.db.commodityLoan.create).toHaveBeenCalledWith({
      data: { loanId: LOAN, commodityId: 'CM-1', status: 'IN_REVIEW' },
      select: { id: true },
    });
    expect(ctx.db.loan.create).not.toHaveBeenCalled();
    expect(ctx.ledger.requestTopup).not.toHaveBeenCalled();
  });

  it('409s on a disbursed loan that already has an asset request in review', async () => {
    const ctx = setup({ live: { id: LOAN, status: 'DISBURSED' } });
    ctx.db.commodityLoan.count.mockResolvedValue(1);
    await expect(ctx.service.requestCommodityLoan(CUSTOMER, 'Laptop')).rejects.toThrow(
      new ConflictException(ASSET_REQUEST_IN_REVIEW),
    );
    expectNoWrites(ctx);
  });

  it('409s on a disbursed loan with a top-up waiting', async () => {
    const ctx = setup({ live: { id: LOAN, status: 'DISBURSED' } });
    ctx.db.microLoan.count.mockResolvedValue(1);
    await expect(ctx.service.requestCommodityLoan(CUSTOMER, 'Laptop')).rejects.toThrow(
      new ConflictException(TOPUP_WAITING),
    );
    expectNoWrites(ctx);
  });

  it.each(['PENDING', 'APPROVED'])('409s while a loan is %s', async (status) => {
    const ctx = setup({ live: { id: LOAN, status } });
    await expect(ctx.service.requestCommodityLoan(CUSTOMER, 'Laptop')).rejects.toThrow(
      new ConflictException(LOAN_IN_PROGRESS),
    );
    expectNoWrites(ctx);
  });

  it('otherwise opens a PENDING ASSET_PURCHASE loan (principal 0, tenure 0) with its request, in one transaction', async () => {
    const ctx = setup();
    const result = await ctx.service.requestCommodityLoan(CUSTOMER, 'Laptop');

    expect(result).toEqual({ kind: 'LOAN', id: 'CR-1', loanId: expect.stringMatching(/^LN-/) });
    expect(ctx.db.$transaction).toHaveBeenCalledTimes(1);
    expect(ctx.db.loan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: result.loanId,
        borrowerId: CUSTOMER,
        category: 'ASSET_PURCHASE',
        status: 'PENDING',
        principal: new Prisma.Decimal(0),
        tenure: 0,
      }),
    });
    expect(ctx.db.commodityLoan.create).toHaveBeenCalledWith({
      data: { loanId: result.loanId, commodityId: 'CM-1', status: 'IN_REVIEW' },
      select: { id: true },
    });
  });
});

describe('LoanService — changing a request', () => {
  it('404s for a loan that is not the customer’s', async () => {
    const ctx = setup({ own: null });
    await expect(ctx.service.updateLoan(CUSTOMER, 'LN-OTHER', { amount: 1 })).rejects.toThrow(
      new NotFoundException(LOAN_NOT_FOUND),
    );
    await expect(ctx.service.deleteLoan(CUSTOMER, 'LN-OTHER')).rejects.toThrow(NotFoundException);
    expect(ctx.db.loan.findFirst).toHaveBeenCalledWith({
      where: { id: 'LN-OTHER', borrowerId: CUSTOMER },
      select: { status: true, category: true },
    });
  });

  it.each(['APPROVED', 'DISBURSED', 'REJECTED', 'REPAID'])('409s once the loan is %s', async (status) => {
    const ctx = setup({ own: { status, category: 'PERSONAL' } });
    await expect(ctx.service.updateLoan(CUSTOMER, LOAN, { amount: 1 })).rejects.toThrow(
      new ConflictException(ONLY_PENDING),
    );
    await expect(ctx.service.deleteLoan(CUSTOMER, LOAN)).rejects.toThrow(new ConflictException(ONLY_PENDING));
    expect(ctx.db.loan.updateMany).not.toHaveBeenCalled();
    expect(ctx.db.loan.deleteMany).not.toHaveBeenCalled();
  });

  it('updates a PENDING loan by compare-and-swap on its status', async () => {
    const ctx = setup({ own: { status: 'PENDING', category: 'PERSONAL' } });
    await ctx.service.updateLoan(CUSTOMER, LOAN, { amount: 75000, category: 'MEDICAL' });
    expect(ctx.db.loan.updateMany).toHaveBeenCalledWith({
      where: { id: LOAN, borrowerId: CUSTOMER, status: 'PENDING' },
      data: { principal: new Prisma.Decimal(75000), category: 'MEDICAL' },
    });
  });

  it('409s when an admin decided between the read and the write', async () => {
    const ctx = setup({ own: { status: 'PENDING', category: 'PERSONAL' } });
    ctx.db.loan.updateMany.mockResolvedValue({ count: 0 });
    await expect(ctx.service.updateLoan(CUSTOMER, LOAN, { amount: 75000 })).rejects.toThrow(
      new ConflictException(ONLY_PENDING),
    );
  });

  it('400s an empty update and 409s editing an asset request', async () => {
    const ctx = setup({ own: { status: 'PENDING', category: 'PERSONAL' } });
    await expect(ctx.service.updateLoan(CUSTOMER, LOAN, {})).rejects.toThrow(new BadRequestException(NOTHING_TO_UPDATE));

    const asset = setup({ own: { status: 'PENDING', category: 'ASSET_PURCHASE' } });
    await expect(asset.service.updateLoan(CUSTOMER, LOAN, { amount: 1 })).rejects.toThrow(
      new ConflictException(ASSET_LOAN_NOT_EDITABLE),
    );
    expect(ctx.db.loan.updateMany).not.toHaveBeenCalled();
    expect(asset.db.loan.updateMany).not.toHaveBeenCalled();
  });

  it('deletes a PENDING loan with its in-review asset request, in one transaction', async () => {
    const ctx = setup({ own: { status: 'PENDING', category: 'ASSET_PURCHASE' } });
    await ctx.service.deleteLoan(CUSTOMER, LOAN);
    expect(ctx.db.$transaction).toHaveBeenCalledTimes(1);
    expect(ctx.db.commodityLoan.deleteMany).toHaveBeenCalledWith({ where: { loanId: LOAN, status: 'IN_REVIEW' } });
    expect(ctx.db.loan.deleteMany).toHaveBeenCalledWith({
      where: { id: LOAN, borrowerId: CUSTOMER, status: 'PENDING' },
    });
  });

  it('409s (rolling the transaction back) when the loan left PENDING meanwhile', async () => {
    const ctx = setup({ own: { status: 'PENDING', category: 'PERSONAL' } });
    ctx.db.loan.deleteMany.mockResolvedValue({ count: 0 });
    await expect(ctx.service.deleteLoan(CUSTOMER, LOAN)).rejects.toThrow(new ConflictException(ONLY_PENDING));
  });
});
