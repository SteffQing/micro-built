import { Prisma } from '@prisma/client';
import { RepaymentObligationService } from './repayment-obligation.service';

describe('RepaymentObligationService recorded interest', () => {
  it('combines legacy interest and current receipt allocations without double counting', async () => {
    const tx = {
      repayment: {
        groupBy: jest.fn().mockResolvedValue([
          {
            loanId: 'LN-MIXED',
            _sum: { interestPaid: new Prisma.Decimal('20600') },
          },
        ]),
      },
      paymentAllocation: {
        groupBy: jest.fn().mockResolvedValue([
          {
            loanId: 'LN-MIXED',
            _sum: { amount: new Prisma.Decimal('5000') },
          },
        ]),
      },
    };
    const service = new RepaymentObligationService({} as never);

    const result = await (service as any).recordedInterestPaidByLoan(tx, [
      'LN-MIXED',
    ]);

    expect(result.get('LN-MIXED').toFixed(2)).toBe('25600.00');
    expect(tx.repayment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ receiptId: null }),
      }),
    );
    expect(tx.paymentAllocation.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          component: 'INTEREST',
          reversesAllocationId: null,
        }),
      }),
    );
  });
});
