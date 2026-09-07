import { RepaymentStatus } from '@prisma/client';
import { CustomersService } from './customers.service';

describe('customer overview repayment metrics', () => {
  const zeroCounts = {
    defaultedCount: 0,
    flaggedCount: 0,
    ontimeCount: 0,
  };
  let service: CustomersService;
  let prisma: {
    repayment: { findMany: jest.Mock };
    user: { count: jest.Mock };
    loan: { groupBy: jest.Mock };
  };
  let config: { getValue: jest.Mock };

  beforeEach(() => {
    prisma = {
      repayment: { findMany: jest.fn().mockResolvedValue([]) },
      user: { count: jest.fn() },
      loan: { groupBy: jest.fn() },
    };
    config = {
      getValue: jest.fn().mockResolvedValue(new Date('2026-08-01T00:00:00Z')),
    };
    service = new CustomersService(
      prisma as never,
      config as never,
      {} as never,
    );
  });

  it('returns the six card fields, including customers with a single repayment', async () => {
    prisma.user.count.mockResolvedValueOnce(18).mockResolvedValueOnce(16);
    prisma.loan.groupBy.mockResolvedValue([
      { borrowerId: 'MB-FAILED' },
      { borrowerId: 'MB-PARTIAL' },
      { borrowerId: 'MB-FULFILLED' },
    ]);
    prisma.repayment.findMany.mockResolvedValue([
      { userId: 'MB-FAILED', status: 'FAILED' },
      { userId: 'MB-PARTIAL', status: 'PARTIAL' },
      { userId: 'MB-FULFILLED', status: 'FULFILLED' },
    ]);

    expect(await service.getOverview()).toEqual({
      activeCustomersCount: 18,
      flaggedCustomersCount: 16,
      customersWithActiveLoansCount: 3,
      defaultedCount: 1,
      flaggedCount: 1,
      ontimeCount: 1,
    });
  });

  it.each([
    ['FAILED', 'PARTIAL', 'FULFILLED'],
    ['FAILED', 'FULFILLED', 'PARTIAL'],
    ['PARTIAL', 'FAILED', 'FULFILLED'],
    ['PARTIAL', 'FULFILLED', 'FAILED'],
    ['FULFILLED', 'FAILED', 'PARTIAL'],
    ['FULFILLED', 'PARTIAL', 'FAILED'],
  ] as RepaymentStatus[][])(
    'counts a customer with %s, %s, %s only as a defaulter',
    async (...statuses: RepaymentStatus[]) => {
      prisma.repayment.findMany.mockResolvedValue(
        statuses.map((status) => ({ userId: 'MB-MULTIPLE-LOANS', status })),
      );

      expect(await service.getUsersRepaymentStatusSummary()).toEqual({
        ...zeroCounts,
        defaultedCount: 1,
      });
    },
  );

  it.each([
    ['PARTIAL', 'FULFILLED'],
    ['FULFILLED', 'PARTIAL'],
  ] as RepaymentStatus[][])(
    'counts a customer with %s and %s only as flagged with issues',
    async (...statuses: RepaymentStatus[]) => {
      prisma.repayment.findMany.mockResolvedValue(
        statuses.map((status) => ({ userId: 'MB-MULTIPLE-LOANS', status })),
      );

      expect(await service.getUsersRepaymentStatusSummary()).toEqual({
        ...zeroCounts,
        flaggedCount: 1,
      });
    },
  );

  it('counts customers rather than duplicate repayment rows', async () => {
    prisma.repayment.findMany.mockResolvedValue([
      { userId: 'MB-FAILED', status: 'FAILED' },
      { userId: 'MB-FAILED', status: 'FAILED' },
      { userId: 'MB-PARTIAL', status: 'PARTIAL' },
      { userId: 'MB-PARTIAL', status: 'PARTIAL' },
      { userId: 'MB-PAID-1', status: 'FULFILLED' },
      { userId: 'MB-PAID-1', status: 'FULFILLED' },
      { userId: 'MB-PAID-2', status: 'FULFILLED' },
    ]);

    expect(await service.getUsersRepaymentStatusSummary()).toEqual({
      defaultedCount: 1,
      flaggedCount: 1,
      ontimeCount: 2,
    });
  });

  it.each(['2026-08-01T00:00:00Z', '2026-07-31T23:00:00Z'])(
    'uses the Lagos repayment month when the closure marker is %s',
    async (closedPeriod) => {
      config.getValue.mockResolvedValue(new Date(closedPeriod));

      await service.getUsersRepaymentStatusSummary();

      expect(config.getValue).toHaveBeenCalledWith('LAST_REPAYMENT_DATE');
      expect(prisma.repayment.findMany).toHaveBeenCalledWith({
        where: {
          periodInDT: {
            gte: new Date('2026-07-31T23:00:00Z'),
            lt: new Date('2026-08-31T23:00:00Z'),
          },
          status: { in: ['FAILED', 'PARTIAL', 'FULFILLED'] },
          userId: { not: null },
          user: { role: 'CUSTOMER' },
        },
        select: { userId: true, status: true },
      });
    },
  );

  it('uses a half-open month range across the year boundary', async () => {
    config.getValue.mockResolvedValue(new Date('2026-12-01T00:00:00Z'));

    await service.getUsersRepaymentStatusSummary();

    expect(prisma.repayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periodInDT: {
            gte: new Date('2026-11-30T23:00:00Z'),
            lt: new Date('2026-12-31T23:00:00Z'),
          },
        }),
      }),
    );
  });

  it('returns explicit zero counts when no repayment month has been closed', async () => {
    config.getValue.mockResolvedValue(null);

    expect(await service.getUsersRepaymentStatusSummary()).toEqual(zeroCounts);
    expect(prisma.repayment.findMany).not.toHaveBeenCalled();
  });

  it('returns explicit zero counts when the closed month has no qualifying repayments', async () => {
    expect(await service.getUsersRepaymentStatusSummary()).toEqual(zeroCounts);
  });
});
