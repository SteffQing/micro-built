import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { RepaymentsConsumer } from './queue.repayments';
import type { ResolveRepayment } from 'src/common/types/repayment.interface';

const dec = (n: number) => new Prisma.Decimal(n);

// Loan that owes exactly `owed` (no penalty, nothing repaid yet, zero interest).
const makeLoan = (id: string, owed: number) => ({
  id,
  principal: dec(owed),
  penalty: dec(0),
  tenure: 12,
  extension: 0,
  interestRate: dec(0),
  repaid: dec(0),
  disbursementDate: new Date('2026-01-15T00:00:00.000Z'),
  penaltyRepaid: dec(0),
  repayable: dec(owed),
});

describe('RepaymentsConsumer.handleRepaymentOverflow — manual resolution audit trail', () => {
  const build = (status: string, loans: ReturnType<typeof makeLoan>[]) => {
    const prisma = {
      repayment: {
        findUnique: jest.fn().mockResolvedValue({ status }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      loan: {
        findMany: jest.fn().mockResolvedValue(loans),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const config = {
      topupValue: jest.fn().mockResolvedValue(undefined),
      depleteValue: jest.fn().mockResolvedValue(undefined),
    };
    const consumer = new RepaymentsConsumer(prisma as any, config as any);
    return { consumer, prisma };
  };

  const job = (amount: number) =>
    ({
      data: {
        repaymentId: 'rep_1',
        userId: 'user_1',
        amount,
        period: 'MAY 2026',
        resolutionNote: 'note',
      } as ResolveRepayment,
    }) as unknown as Job<ResolveRepayment>;

  it('reuses the existing row for the first loan and creates a row for each extra loan', async () => {
    // ₦100k resolved across Loan A (owes ₦60k) and Loan B (owes ₦50k) → spills into B.
    const { consumer, prisma } = build('MANUAL_RESOLUTION', [
      makeLoan('A', 60_000),
      makeLoan('B', 50_000),
    ]);

    await consumer.handleRepaymentOverflow(job(100_000));

    // First loan reuses the manual-resolution row; second loan gets its own record.
    expect(prisma.repayment.update).toHaveBeenCalledTimes(1);
    expect(prisma.repayment.update.mock.calls[0][0].data.loanId).toBe('A');
    expect(prisma.repayment.create).toHaveBeenCalledTimes(1);
    expect(prisma.repayment.create.mock.calls[0][0].data.loanId).toBe('B');
    // Both loans still get credited.
    expect(prisma.loan.update).toHaveBeenCalledTimes(2);
  });

  it('uses a single row when the amount fits within the first loan', async () => {
    const { consumer, prisma } = build('MANUAL_RESOLUTION', [
      makeLoan('A', 60_000),
      makeLoan('B', 50_000),
    ]);

    await consumer.handleRepaymentOverflow(job(40_000));

    expect(prisma.repayment.update).toHaveBeenCalledTimes(1);
    expect(prisma.repayment.create).not.toHaveBeenCalled();
    expect(prisma.loan.update).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the resolution was already FULFILLED (idempotency guard)', async () => {
    const { consumer, prisma } = build('FULFILLED', [makeLoan('A', 60_000)]);

    await consumer.handleRepaymentOverflow(job(100_000));

    expect(prisma.loan.findMany).not.toHaveBeenCalled();
    expect(prisma.repayment.update).not.toHaveBeenCalled();
    expect(prisma.repayment.create).not.toHaveBeenCalled();
  });
});
