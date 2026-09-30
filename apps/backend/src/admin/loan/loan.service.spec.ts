import { Prisma } from '@prisma/client';
import { CashLoanService, CommodityLoanService } from './loan.service';

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

describe('admin loan read and commodity approval', () => {
  it('returns asset-purchase advances through the category-neutral details read', async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'LN-ASSET',
          principal: decimal(313775),
          repayable: decimal(313775),
          penalty: decimal(0),
          penaltyRepaid: decimal(0),
          repaid: decimal(141913.89),
          tenure: 9,
          extension: 0,
          interestRate: decimal(0),
          managementFeeRate: decimal(0),
          disbursementDate: new Date('2026-07-01T00:00:00Z'),
          status: 'DISBURSED',
          category: 'ASSET_PURCHASE',
          type: 'New',
          createdAt: new Date('2026-07-01T00:00:00Z'),
          updatedAt: new Date('2026-07-01T00:00:00Z'),
          asset: { id: 'CLN-ASSET', name: 'REDMI 13C' },
          borrower: {
            id: 'MB-ASSET',
            name: 'Borrower',
            email: null,
            contact: '08000000000',
            externalId: 'IPPIS-1',
          },
        }),
      },
    };
    const service = new CashLoanService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.getLoan('LN-ASSET');

    expect(prisma.loan.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'LN-ASSET' } }),
    );
    expect(result).toMatchObject({
      id: 'LN-ASSET',
      category: 'ASSET_PURCHASE',
      type: 'New',
      asset: { id: 'CLN-ASSET', name: 'REDMI 13C' },
      amountOwed: 171861.11,
    });
  });

  it('atomically preserves Topup provenance when approving a commodity request', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      commodityLoan: {
        findUnique: jest.fn().mockResolvedValue({
          inReview: true,
          borrowerId: 'MB-1',
          requestedById: 'MB-ADMIN',
          type: 'Topup',
          targetObligationId: 'OBL-1',
        }),
      },
      $transaction: jest.fn(async (callback) =>
        callback({ commodityLoan: { update } }),
      ),
    };
    const service = new CommodityLoanService(prisma as never);

    const result = await service.approveCommodityLoan('CLN-1', {
      amount: 100000,
      tenure: 12,
      interestRate: 5,
      managementFeeRate: 3,
      publicDetails: 'Asset financing',
      privateDetails: 'Approved top-up asset',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'CLN-1' },
        data: expect.objectContaining({
          inReview: false,
          loan: {
            create: expect.objectContaining({
              category: 'ASSET_PURCHASE',
              type: 'Topup',
              status: 'APPROVED',
              borrowerId: 'MB-1',
            }),
          },
        }),
      }),
    );
    expect(result.data).toMatchObject({
      userId: 'MB-1',
      type: 'Topup',
      targetObligationId: 'OBL-1',
    });
  });
});
