import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DashboardService } from './dashboard.service';

const D = (value: string | number) => new Prisma.Decimal(value);

// 2026-07-15 12:00 Lagos.
const NOW = new Date('2026-07-15T11:00:00Z');

function setup() {
  const prisma = {
    $queryRaw: jest.fn(),
    loan: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    microLoan: { count: jest.fn(), findMany: jest.fn() },
    commodityLoan: { findMany: jest.fn() },
    repaymentBreakdown: { groupBy: jest.fn() },
    voucher: { findFirst: jest.fn() },
    paymentInflow: { count: jest.fn() },
    customer: { count: jest.fn(), findMany: jest.fn() },
    tenureChange: { count: jest.fn() },
  };
  const settings = { get: jest.fn() };
  const clock = { now: () => NOW };
  const periods = {
    awaitingPayrollPeriod: jest.fn().mockResolvedValue(null),
    openVariationPeriod: jest.fn().mockResolvedValue({ year: 2026, month: 'JULY' }),
  };
  const service = new DashboardService(prisma as never, settings as never, clock as never, periods as never);
  return { prisma, settings, service , periods };
}

/** Mocks for overview / loan-report-overview: booked row, collected groups, outstanding, counts. */
function mockFigures(prisma: ReturnType<typeof setup>['prisma']) {
  // Principal 100,000 + 50,000 (2 % and 3 % fee), interest 30,000, penalty 1,000.
  prisma.$queryRaw.mockResolvedValue([
    { principal: D('150000'), interest: D('30000'), penalty: D('1000'), managementFee: D('3500') },
  ]);
  prisma.repaymentBreakdown.groupBy.mockResolvedValue([
    { component: 'PRINCIPAL', _sum: { amount: D('20000') } },
    { component: 'INTEREST', _sum: { amount: D('4000.50') } },
    { component: 'PENALTY', _sum: { amount: D('250') } },
  ]);
  prisma.loan.aggregate.mockResolvedValue({ _sum: { owed: D('181000'), repaid: D('24250.50') } });
  prisma.loan.count.mockImplementation(({ where }: { where: { status: string } }) =>
    Promise.resolve(where.status === 'DISBURSED' ? 3 : 2),
  );
  prisma.microLoan.count.mockResolvedValue(1);
}

/** The Prisma.Sql fragments interpolated into the first $queryRaw call. */
function sqlFragments(prisma: ReturnType<typeof setup>['prisma']): Prisma.Sql[] {
  const [, ...values] = prisma.$queryRaw.mock.calls[0] as unknown[];
  return values.filter(
    (value): value is Prisma.Sql => typeof value === 'object' && value !== null && Array.isArray((value as Prisma.Sql).values),
  );
}

describe('DashboardService', () => {
  describe('overview', () => {
    it('derives every figure from the booked, collected and outstanding aggregates', async () => {
      const { prisma, service } = setup();
      mockFigures(prisma);

      await expect(service.overview()).resolves.toEqual({
        activeCount: 3,
        pendingCount: 3, // 2 loans + 1 top-up
        totalLoanAmount: 180000,
        totalDisbursed: 146500,
        managementFee: 3500,
        interestBooked: 30000,
        interestCollected: 4000.5,
        penaltyCharged: 1000,
        penaltyCollected: 250,
        grossProfit: 33500,
        outstanding: 156749.5,
      });
      expect(prisma.microLoan.count).toHaveBeenCalledWith({ where: { purpose: 'TOPUP', status: 'PENDING' } });
      expect(prisma.loan.aggregate).toHaveBeenCalledWith({
        where: { status: 'DISBURSED' },
        _sum: { owed: true, repaid: true },
      });
    });

    it('is all-time without a range', async () => {
      const { prisma, service } = setup();
      mockFigures(prisma);
      await service.overview({});

      expect(prisma.repaymentBreakdown.groupBy.mock.calls[0][0].where).toBeUndefined();
      expect(sqlFragments(prisma).every((sql) => sql.values.length === 0)).toBe(true);
    });

    it('filters microloans by the Lagos bounds of the range and collections by payroll month', async () => {
      const { prisma, service } = setup();
      mockFigures(prisma);
      await service.overview({ from: '2026-01', to: '2026-06' });

      const values = sqlFragments(prisma).flatMap((sql) => sql.values);
      // Lagos midnight on 1 Jan 2026 and on 1 Jul 2026 (exclusive), as UTC instants.
      expect(values).toEqual(['2025-12-31T23:00:00.000Z', '2026-06-30T23:00:00.000Z']);

      const where = prisma.repaymentBreakdown.groupBy.mock.calls[0][0].where;
      expect(where.repayment.paymentInflow.period.AND).toHaveLength(2);
      // Outstanding is never filtered.
      expect(prisma.loan.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'DISBURSED' } }));
    });

    it('returns zeros on an empty ledger', async () => {
      const { prisma, service } = setup();
      prisma.$queryRaw.mockResolvedValue([{ principal: D(0), interest: D(0), penalty: D(0), managementFee: D(0) }]);
      prisma.repaymentBreakdown.groupBy.mockResolvedValue([]);
      prisma.loan.aggregate.mockResolvedValue({ _sum: { owed: null, repaid: null } });
      prisma.loan.count.mockResolvedValue(0);
      prisma.microLoan.count.mockResolvedValue(0);

      const data = await service.overview();
      expect(Object.values(data).every((value) => value === 0)).toBe(true);
    });

    it('rejects from after to', async () => {
      const { service } = setup();
      await expect(service.overview({ from: '2026-06', to: '2026-01' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('loan report overview sums every collected component into totalRepaid', async () => {
    const { prisma, service } = setup();
    mockFigures(prisma);

    await expect(service.loanReportOverview({ from: '2026-01' })).resolves.toEqual({
      totalLoanAmount: 180000,
      totalDisbursed: 146500,
      outstanding: 156749.5,
      totalRepaid: 24250.5,
      interestBooked: 30000,
      interestCollected: 4000.5,
      activeLoansCount: 3,
      pendingLoansCount: 3,
    });
  });

  describe('disbursement chart', () => {
    it('defaults to January … the current Lagos month and fills empty months', async () => {
      const { prisma, service } = setup();
      prisma.$queryRaw.mockResolvedValue([
        { ym: '2026-02', category: 'PERSONAL', total: D('250000') },
        { ym: '2026-02', category: 'ASSET_PURCHASE', total: D('100000.25') },
        { ym: '2026-07', category: 'BUSINESS', total: D('50000') },
      ]);

      const data = await service.disbursementChart();
      expect(data.map((month) => month.period)).toEqual([
        'JANUARY 2026',
        'FEBRUARY 2026',
        'MARCH 2026',
        'APRIL 2026',
        'MAY 2026',
        'JUNE 2026',
        'JULY 2026',
      ]);
      expect(data[0]).toEqual({ period: 'JANUARY 2026', categories: {}, total: 0 });
      expect(data[1]).toEqual({
        period: 'FEBRUARY 2026',
        categories: { PERSONAL: 250000, ASSET_PURCHASE: 100000.25 },
        total: 350000.25,
      });
      expect(data[6].total).toBe(50000);
      expect(sqlFragments(prisma).flatMap((sql) => sql.values)).toEqual([
        '2025-12-31T23:00:00.000Z',
        '2026-07-31T23:00:00.000Z',
      ]);
    });

    it('spans years', async () => {
      const { prisma, service } = setup();
      prisma.$queryRaw.mockResolvedValue([]);
      const data = await service.disbursementChart({ from: '2025-11', to: '2026-02' });
      expect(data.map((month) => month.period)).toEqual(['NOVEMBER 2025', 'DECEMBER 2025', 'JANUARY 2026', 'FEBRUARY 2026']);
    });

    it('refuses more than 60 months', async () => {
      const { service } = setup();
      await expect(service.disbursementChart({ from: '2020-01', to: '2026-01' })).rejects.toThrow(
        'Pick at most 60 months for the chart',
      );
    });
  });

  it('open requests: cash loans, pending top-ups and asset requests with their kind', async () => {
    const { prisma, service } = setup();
    const borrower = { userId: 'MB-1', user: { name: 'Ada' } };
    const at = new Date('2026-07-01T10:00:00Z');
    prisma.loan.findMany.mockResolvedValue([
      { id: 'LN-1', principal: D('50000'), category: 'BUSINESS', createdAt: at, borrower },
    ]);
    prisma.microLoan.findMany.mockResolvedValue([
      { id: 'ML-1', amount: D('20000'), createdAt: at, loan: { id: 'LN-2', category: 'PERSONAL', borrower } },
    ]);
    prisma.commodityLoan.findMany.mockResolvedValue([
      {
        id: 'CL-1',
        createdAt: at,
        commodity: { name: 'Laptop' },
        loan: { id: 'LN-3', category: 'ASSET_PURCHASE', status: 'PENDING', borrower },
      },
      {
        id: 'CL-2',
        createdAt: at,
        commodity: { name: 'Phone' },
        loan: { id: 'LN-2', category: 'PERSONAL', status: 'DISBURSED', borrower },
      },
    ]);

    const data = await service.openLoanRequests();
    expect(prisma.loan.findMany.mock.calls[0][0].where).toEqual({
      status: 'PENDING',
      category: { not: 'ASSET_PURCHASE' },
    });
    expect(data.cashLoans).toEqual([
      { id: 'LN-1', customerId: 'MB-1', customerName: 'Ada', amount: 50000, category: 'BUSINESS', requestedAt: at },
    ]);
    expect(data.topups).toEqual([
      {
        id: 'ML-1',
        loanId: 'LN-2',
        customerId: 'MB-1',
        customerName: 'Ada',
        amount: 20000,
        category: 'PERSONAL',
        requestedAt: at,
      },
    ]);
    expect(data.commodityLoans.map((request) => [request.id, request.kind, request.name])).toEqual([
      ['CL-1', 'NEW_LOAN', 'Laptop'],
      ['CL-2', 'TOPUP', 'Phone'],
    ]);
  });

  it('status distribution lists every status', async () => {
    const { prisma, service } = setup();
    prisma.loan.groupBy.mockResolvedValue([
      { status: 'DISBURSED', _count: { _all: 2 } },
      { status: 'PENDING', _count: { _all: 1 } },
    ]);
    await expect(service.statusDistribution()).resolves.toEqual({
      statusCounts: { PENDING: 1, REJECTED: 0, APPROVED: 0, DISBURSED: 2, REPAID: 0 },
    });
  });

  describe('operations', () => {
    function mockOperations(prisma: ReturnType<typeof setup>['prisma'], settings: ReturnType<typeof setup>['settings']) {
      settings.get.mockResolvedValue({
        interestRate: D('0.06'),
        managementFeeRate: D('0.025'),
        penaltyRate: null,
        maxDeductionRate: null,
        inMaintenance: false,
      });
      prisma.paymentInflow.count.mockImplementation(({ where }: { where: { source?: string } }) =>
        Promise.resolve(where.source === 'LIQUIDATION' ? 1 : 4),
      );
      prisma.customer.count.mockResolvedValue(2);
      prisma.tenureChange.count.mockResolvedValue(3);
      prisma.loan.findMany.mockResolvedValue([
        {
          id: 'LN-1',
          principal: D('120000'),
          category: 'PERSONAL',
          status: 'DISBURSED',
          disbursementDate: new Date('2026-07-02T09:00:00Z'),
          borrower: { userId: 'MB-1', user: { name: 'Ada' } },
        },
      ]);
      prisma.customer.findMany.mockResolvedValue([
        { userId: 'MB-2', createdAt: new Date('2026-07-03T09:00:00Z'), user: { name: 'Bola', status: 'FLAGGED' } },
      ]);
    }

    it('reports the pulse from v2 data', async () => {
      const { prisma, settings, service } = setup();
      mockOperations(prisma, settings);
      prisma.voucher.findFirst.mockResolvedValue({
        createdAt: new Date('2026-07-01T08:00:00Z'),
        variation: { period: { year: 2026, month: 'JUNE' } },
      });

      const data = await service.operations();
      expect(data).toEqual({
        lastRepaymentRun: { period: 'JUNE 2026', date: new Date('2026-07-01T08:00:00Z'), upToDate: true },
        currentPeriod: 'JULY 2026',
        awaitingPayrollPeriod: null,
        nextVariationPeriod: 'JULY 2026',
        rates: { interestRate: 6, managementFeeRate: 2.5, penaltyRate: null, maxDeductionRate: null },
        attention: { manualResolutions: 4, pendingLiquidations: 1, flaggedCustomers: 2, pendingTenureChanges: 3 },
        recentLoans: [
          {
            id: 'LN-1',
            customerId: 'MB-1',
            customerName: 'Ada',
            amount: 120000,
            category: 'PERSONAL',
            status: 'DISBURSED',
            disbursedAt: new Date('2026-07-02T09:00:00Z'),
          },
        ],
        recentCustomers: [
          { id: 'MB-2', name: 'Bola', status: 'FLAGGED', createdAt: new Date('2026-07-03T09:00:00Z') },
        ],
      });
      expect(prisma.paymentInflow.count).toHaveBeenCalledWith({ where: { state: { in: ['UNMATCHED', 'REVIEWING'] } } });
      expect(prisma.paymentInflow.count).toHaveBeenCalledWith({ where: { source: 'LIQUIDATION', state: 'AWAITING' } });
    });

    it('waits on the earliest generated month whose payroll file has not come in, and is null before any upload', async () => {
      const { prisma, settings, service, periods } = setup();
      mockOperations(prisma, settings);
      prisma.voucher.findFirst.mockResolvedValueOnce({
        createdAt: new Date('2026-07-01T08:00:00Z'),
        variation: { period: { year: 2026, month: 'JUNE' } },
      });
      periods.awaitingPayrollPeriod.mockResolvedValueOnce({ year: 2026, month: 'JULY' });
      const data = await service.operations();
      expect(data.lastRepaymentRun?.upToDate).toBe(false);
      expect(data.awaitingPayrollPeriod).toBe('JULY 2026');

      prisma.voucher.findFirst.mockResolvedValueOnce(null);
      expect((await service.operations()).lastRepaymentRun).toBeNull();
    });
  });
});
