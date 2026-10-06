import { Prisma } from '@prisma/client';
import { RepaymentsService } from './repayments.service';

const d = (n: number) => new Prisma.Decimal(n);

function setup() {
  const prisma = {
    deduction: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    paymentInflow: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
  };
  return { service: new RepaymentsService(prisma as never), prisma };
}

describe('customer deductions', () => {
  it("lists only the customer's deductions, with what was paid against each", async () => {
    const { service, prisma } = setup();
    prisma.deduction.findMany.mockResolvedValue([
      {
        id: 'D-1',
        loanId: 'LN-1',
        expected: d(28650),
        status: 'PARTIAL',
        settledAt: null,
        period: { year: 2026, month: 'OCTOBER' },
        repayments: [{ amount: d(20000) }, { amount: d(5000) }],
      },
      {
        id: 'D-2',
        loanId: 'LN-1',
        expected: d(100),
        status: 'FULFILLED',
        settledAt: null,
        period: { year: 2026, month: 'SEPTEMBER' },
        repayments: [{ amount: d(150) }],
      },
    ]);
    prisma.deduction.count.mockResolvedValue(2);

    const result = await service.getDeductions('MB-1', { page: 1, limit: 10 });

    expect(prisma.deduction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { loan: { borrowerId: 'MB-1' } }, skip: 0, take: 10 }),
    );
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 10 });
    expect(result.data[0]).toMatchObject({ period: 'OCTOBER 2026', expected: 28650, paid: 25000, outstanding: 3650 });
    expect(result.data[1].outstanding).toBe(0); // overpaid never shows as negative
  });
});

describe('customer inflows', () => {
  it("lists only the customer's money in, optionally by source", async () => {
    const { service, prisma } = setup();
    prisma.paymentInflow.findMany.mockResolvedValue([
      {
        id: 'PI-1',
        source: 'LIQUIDATION',
        state: 'SETTLED',
        amount: d(5000),
        createdAt: new Date('2026-10-02T10:00:00Z'),
        period: { year: 2026, month: 'OCTOBER' },
        repayment: { amount: d(5000) },
      },
    ]);
    prisma.paymentInflow.count.mockResolvedValue(1);

    const result = await service.getInflows('MB-1', { source: 'LIQUIDATION' });

    expect(prisma.paymentInflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'MB-1', source: 'LIQUIDATION' } }),
    );
    expect(result.data).toEqual([
      {
        id: 'PI-1',
        source: 'LIQUIDATION',
        state: 'SETTLED',
        amount: 5000,
        applied: 5000,
        period: 'OCTOBER 2026',
        receivedAt: new Date('2026-10-02T10:00:00Z'),
      },
    ]);
  });
});
