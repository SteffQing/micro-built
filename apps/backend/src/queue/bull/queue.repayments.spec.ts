import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { RepaymentsConsumer } from './queue.repayments';
import type { ResolveRepayment } from 'src/common/types/repayment.interface';

const dec = (n: number) => new Prisma.Decimal(n);

// Loan that owes exactly `owed` (no penalty, nothing repaid yet). principal defaults
// to `owed` (zero interest); pass a smaller principal to give the loan interest.
const makeLoan = (id: string, owed: number, principal = owed) => ({
  id,
  principal: dec(principal),
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
  const build = (status: string, applied = 0, interest = 0) => {
    const prisma = {
      repayment: {
        findUnique: jest.fn().mockResolvedValue({ status }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const config = {
      topupValue: jest.fn().mockResolvedValue(undefined),
      depleteValue: jest.fn().mockResolvedValue(undefined),
    };
    const notifier = { notify: jest.fn().mockResolvedValue(undefined) };
    const obligations = {
      backfillActiveObligations: jest.fn().mockResolvedValue(undefined),
      applyUnscheduledPayment: jest.fn().mockResolvedValue({
        applied: dec(applied),
        interestPaid: dec(interest),
        penaltyPaid: dec(0),
      }),
    };
    const consumer = new RepaymentsConsumer(
      prisma as any,
      config as any,
      notifier as any,
      obligations as any,
    );
    return { consumer, prisma, obligations, notifier };
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

  it('delegates one overflow receipt to the consolidated obligation allocator', async () => {
    const { consumer, obligations } = build('MANUAL_RESOLUTION', 100_000);

    await consumer.handleRepaymentOverflow(job(100_000));

    expect(obligations.backfillActiveObligations).toHaveBeenCalledTimes(1);
    expect(obligations.applyUnscheduledPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        amount: 100_000,
        source: 'OVERFLOW',
        compatibilityRepaymentId: 'rep_1',
      }),
    );
  });

  it('uses the canonical allocator even when a partial amount is received', async () => {
    const { consumer, obligations } = build('MANUAL_RESOLUTION', 40_000);

    await consumer.handleRepaymentOverflow(job(40_000));

    expect(obligations.applyUnscheduledPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 40_000 }),
    );
  });

  it('uses the allocator result for interest revenue instead of recalculating it', async () => {
    const { consumer, obligations } = build(
      'MANUAL_RESOLUTION',
      60_000,
      10_000,
    );

    await consumer.handleRepaymentOverflow(job(60_000));

    expect(obligations.applyUnscheduledPayment).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the resolution was already FULFILLED (idempotency guard)', async () => {
    const { consumer, prisma, obligations } = build('FULFILLED');

    await consumer.handleRepaymentOverflow(job(100_000));

    expect(obligations.applyUnscheduledPayment).not.toHaveBeenCalled();
    expect(prisma.repayment.update).not.toHaveBeenCalled();
    expect(prisma.repayment.create).not.toHaveBeenCalled();
  });
});
