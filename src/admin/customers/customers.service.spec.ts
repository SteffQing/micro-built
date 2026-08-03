import { CustomerService } from './customers.service';

describe('customer commodity top-up', () => {
  it('persists the asset request before returning and links it to the obligation', async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          accountOfficerId: 'MB-ADMIN',
          name: 'Borrower',
        }),
      },
      repaymentObligation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'OBL-1' }),
      },
    };
    const userLoans = {
      requestAssetLoan: jest
        .fn()
        .mockResolvedValue({ data: { id: 'CLN-TOPUP' } }),
    };
    const service = new CustomerService(
      {} as never,
      prisma as never,
      {} as never,
      {} as never,
      userLoans as never,
      {} as never,
    );

    const result = await service.loanTopup(
      'MB-1',
      { userId: 'MB-ADMIN', role: 'SUPER_ADMIN' } as never,
      {
        category: 'ASSET_PURCHASE',
        commodityLoan: { assetName: 'Laptop' },
      },
    );

    expect(userLoans.requestAssetLoan).toHaveBeenCalledWith(
      'MB-1',
      'Laptop',
      'MB-ADMIN',
      { type: 'Topup', targetObligationId: 'OBL-1' },
    );
    expect(result.data).toEqual({
      commodityLoanId: 'CLN-TOPUP',
      targetObligationId: 'OBL-1',
    });
  });
});
