jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
jest.mock('src/notifications/mail.service', () => ({ MailService: class {} }));

import type { DeductionStatus } from '@prisma/client';
import { CustomersService } from './customers.service';

describe('customers overview', () => {
  const zero = { defaultedCount: 0, flaggedCount: 0, ontimeCount: 0 };
  let prisma: {
    payrollPeriod: { findFirst: jest.Mock };
    deduction: { findMany: jest.Mock };
    customer: { count: jest.Mock };
  };
  let service: CustomersService;

  const deductions = (rows: [string, DeductionStatus][]) =>
    prisma.deduction.findMany.mockResolvedValue(
      rows.map(([borrowerId, status]) => ({ status, loan: { borrowerId } })),
    );

  beforeEach(() => {
    prisma = {
      payrollPeriod: { findFirst: jest.fn().mockResolvedValue({ id: 'P-AUG' }) },
      deduction: { findMany: jest.fn().mockResolvedValue([]) },
      customer: { count: jest.fn() },
    };
    service = new CustomersService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  });

  it('returns the card fields', async () => {
    prisma.customer.count.mockResolvedValueOnce(18).mockResolvedValueOnce(16).mockResolvedValueOnce(3);
    deductions([
      ['MB-FAILED', 'FAILED'],
      ['MB-PARTIAL', 'PARTIAL'],
      ['MB-PAID', 'FULFILLED'],
    ]);

    expect(await service.getOverview()).toEqual({
      activeCustomersCount: 18,
      flaggedCustomersCount: 16,
      customersWithActiveLoansCount: 3,
      defaultedCount: 2,
      flaggedCount: 1,
      ontimeCount: 1,
    });
    expect(prisma.customer.count).toHaveBeenCalledWith({ where: { user: { status: 'ACTIVE' } } });
    expect(prisma.customer.count).toHaveBeenCalledWith({ where: { user: { status: 'FLAGGED' } } });
    expect(prisma.customer.count).toHaveBeenCalledWith({ where: { loans: { some: { status: 'DISBURSED' } } } });
  });

  it('reads the latest closed period and its settled deductions', async () => {
    await service.getRepaymentStatusCounts();

    expect(prisma.payrollPeriod.findFirst).toHaveBeenCalledWith({
      where: { closedAt: { not: null } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: { id: true },
    });
    expect(prisma.deduction.findMany).toHaveBeenCalledWith({
      where: { periodId: 'P-AUG', status: { in: ['FAILED', 'PARTIAL', 'FULFILLED'] } },
      select: { status: true, loan: { select: { borrowerId: true } } },
    });
  });

  it.each([
    ['FAILED', 'PARTIAL', 'FULFILLED'],
    ['FULFILLED', 'PARTIAL', 'FAILED'],
    ['PARTIAL', 'FAILED', 'FULFILLED'],
  ] as DeductionStatus[][])('counts a borrower with %s, %s, %s once, as failed', async (...statuses) => {
    deductions(statuses.map((status) => ['MB-1', status]));
    expect(await service.getRepaymentStatusCounts()).toEqual({ ...zero, defaultedCount: 1 });
  });

  it.each([
    ['PARTIAL', 'FULFILLED'],
    ['FULFILLED', 'PARTIAL'],
  ] as DeductionStatus[][])('counts a borrower with %s and %s as a partial defaulter', async (...statuses) => {
    deductions(statuses.map((status) => ['MB-1', status]));
    expect(await service.getRepaymentStatusCounts()).toEqual({ ...zero, defaultedCount: 1, flaggedCount: 1 });
  });

  it('counts borrowers, not deductions', async () => {
    deductions([
      ['MB-F', 'FAILED'],
      ['MB-F', 'FAILED'],
      ['MB-P', 'PARTIAL'],
      ['MB-OK1', 'FULFILLED'],
      ['MB-OK1', 'FULFILLED'],
      ['MB-OK2', 'FULFILLED'],
    ]);
    expect(await service.getRepaymentStatusCounts()).toEqual({ defaultedCount: 2, flaggedCount: 1, ontimeCount: 2 });
  });

  it('is all zeros until a period has been closed', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue(null);
    expect(await service.getRepaymentStatusCounts()).toEqual(zero);
    expect(prisma.deduction.findMany).not.toHaveBeenCalled();
  });
});
