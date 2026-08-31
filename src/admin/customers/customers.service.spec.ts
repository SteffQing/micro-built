import { CustomerService } from './customers.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('customer loan summary', () => {
  it('calculates every financial field and includes pending asset requests', async () => {
    const prisma = {
      loan: {
        findMany: jest.fn().mockResolvedValue([
          {
            status: 'DISBURSED',
            principal: new Decimal(100),
            repayable: new Decimal(112),
            repaid: new Decimal(40),
            penalty: new Decimal(5),
            penaltyRepaid: new Decimal(2),
            managementFeeRate: new Decimal('0.03'),
          },
          {
            status: 'REPAID',
            principal: new Decimal(50),
            repayable: new Decimal(55),
            repaid: new Decimal(55),
            penalty: new Decimal(0),
            penaltyRepaid: new Decimal(0),
            managementFeeRate: new Decimal(0),
          },
        ]),
        count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1),
      },
      commodityLoan: { count: jest.fn().mockResolvedValue(1) },
      repayment: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { interestPaid: new Decimal(5) },
        }),
        findFirst: jest.fn().mockResolvedValue({
          periodInDT: new Date('2026-08-01T00:00:00Z'),
          period: 'AUGUST 2026',
        }),
      },
    };
    const service = new CustomerService(
      {} as never,
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.getUserLoanSummary('MB-1');

    expect(result.data).toEqual({
      totalBorrowed: 150,
      currentOverdue: 75,
      totalPenalties: 5,
      totalRepaid: 95,
      totalLoanAmount: 167,
      totalDisbursed: 147,
      managementFee: 3,
      interestEarned: 17,
      interestReceived: 5,
      penaltiesReceived: 2,
      outstanding: 72,
      activeLoansCount: 1,
      pendingLoansCount: 2,
      lastRepaymentDate: new Date('2026-08-01T00:00:00Z'),
      lastRepaymentPeriod: 'AUGUST 2026',
    });
  });
});

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

describe('customer loan-change history', () => {
  const makeService = (prisma: object) =>
    new CustomerService(
      {} as never,
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

  it('shows an asset top-up before approval without inventing financial values', async () => {
    const service = makeService({
      loan: { findMany: jest.fn().mockResolvedValue([]) },
      commodityLoan: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'CLN-PENDING',
            name: 'Generator',
            createdAt: new Date('2026-08-03T10:00:00Z'),
            inReview: true,
            rejectedAt: null,
            rejectedById: null,
            requestedById: 'ADMIN-1',
            requestedByUser: { id: 'ADMIN-1', name: 'Charles' },
            targetObligationId: 'OBL-1',
          },
        ]),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'ADMIN-1', name: 'Charles' }]),
      },
    });

    const result = await service.getTopupHistory('MB-1', {});

    expect(result.data[0]).toMatchObject({
      id: 'CLN-PENDING',
      status: 'PENDING',
      assetName: 'Generator',
      amountAdded: null,
      consolidatedOutstanding: null,
      monthlyAfter: null,
    });
  });

  it('explains the exact before-and-after calculation for a disbursed top-up', async () => {
    const service = makeService({
      loan: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'LN-TOPUP',
            principal: new Decimal(100000),
            repayable: new Decimal(110000),
            tenure: 12,
            status: 'DISBURSED',
            category: 'CASH_LOAN',
            createdAt: new Date('2026-08-03T10:00:00Z'),
            disbursementDate: new Date('2026-08-03T11:00:00Z'),
            requestedById: 'ADMIN-1',
            approvedAt: new Date('2026-08-03T10:05:00Z'),
            approvedById: 'ADMIN-1',
            rejectedAt: null,
            rejectedById: null,
            requestedByUser: { id: 'ADMIN-1', name: 'Charles' },
            asset: null,
            obligationAdvance: {
              obligationId: 'OBL-1',
              joinedByEvent: {
                actorId: 'ADMIN-2',
                recordedAt: new Date('2026-08-03T11:00:00Z'),
              },
            },
          },
        ]),
      },
      commodityLoan: { findMany: jest.fn().mockResolvedValue([]) },
      repaymentPlan: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'PLN-OLD',
            obligationId: 'OBL-1',
            reason: 'INITIAL_DISBURSEMENT',
            status: 'SUPERSEDED',
            inputSnapshot: {},
            termMonths: 6,
            scheduledBalance: new Decimal(180000),
            penaltyBalance: new Decimal(0),
            scheduledMonthly: new Decimal(30000),
            effectiveFromPeriod: new Date('2026-07-01'),
            createdBy: 'ADMIN-1',
            createdAt: new Date('2026-07-01'),
            publishedAt: new Date('2026-07-01'),
            inputHash: 'old-hash',
          },
          {
            id: 'PLN-TOPUP',
            obligationId: 'OBL-1',
            reason: 'TOPUP',
            status: 'PUBLISHED',
            inputSnapshot: {
              loanId: 'LN-TOPUP',
              previousPlanId: 'PLN-OLD',
              oldContractualOutstanding: '180000.00',
              oldPenaltyOutstanding: '5000.00',
              newAdvanceContractualRepayable: '110000.00',
              actualConsolidatedBalance: '290000.00',
              oldRemainingTerm: 6,
              selectedTopupTerm: 12,
            },
            termMonths: 12,
            scheduledBalance: new Decimal(290000),
            penaltyBalance: new Decimal(5000),
            scheduledMonthly: new Decimal(24583.33),
            effectiveFromPeriod: new Date('2026-09-01'),
            createdBy: 'ADMIN-2',
            createdAt: new Date('2026-08-03'),
            publishedAt: new Date('2026-08-03'),
            inputHash: 'topup-hash',
          },
        ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'ADMIN-1', name: 'Charles' },
          { id: 'ADMIN-2', name: 'Sunny' },
        ]),
      },
    });

    const result = await service.getTopupHistory('MB-1', {});

    expect(result.data[0]).toMatchObject({
      amountAdded: 110000,
      outstandingBefore: 185000,
      consolidatedOutstanding: 295000,
      termBefore: 6,
      selectedTerm: 12,
      termAfter: 12,
      monthlyBefore: 30000,
      monthlyAfter: 24583.33,
      decidedByName: 'Sunny',
      planHash: 'topup-hash',
    });
  });

  it('returns tenure requests with the frozen balance and named decision actors', async () => {
    const service = makeService({
      tenureChangeRequest: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'TCR-1',
            obligationId: 'OBL-1',
            status: 'APPROVED',
            requestedTermMonths: 18,
            previousTermMonths: 12,
            previousMonthly: new Decimal(25000),
            proposedMonthly: new Decimal(16666.67),
            balanceSnapshot: new Decimal(300000),
            effectiveFromPeriod: new Date('2026-09-01'),
            reasonCode: 'CUSTOMER_REQUEST',
            note: 'Reduce payroll deduction',
            requestedBy: 'ADMIN-1',
            approvedBy: 'ADMIN-2',
            rejectedBy: null,
            expectedObligationVersion: 4,
            previewHash: 'preview-hash',
            createdAt: new Date('2026-08-03'),
            decidedAt: new Date('2026-08-03'),
          },
        ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'ADMIN-1', name: 'Charles' },
          { id: 'ADMIN-2', name: 'Sunny' },
        ]),
      },
    });

    const result = await service.getTenureChangeHistory('MB-1', {});

    expect(result.data[0]).toMatchObject({
      previousTermMonths: 12,
      requestedTermMonths: 18,
      previousMonthly: 25000,
      proposedMonthly: 16666.67,
      balanceSnapshot: 300000,
      requestedByName: 'Charles',
      approvedByName: 'Sunny',
      previewHash: 'preview-hash',
    });
  });

  it('reconstructs the account statement from exact event allocations', async () => {
    const event = (
      sequence: number,
      type: string,
      payload: Record<string, string>,
      allocations: Array<{ component: string; amount: Decimal }> = [],
    ) => ({
      id: `EVT-${sequence}`,
      obligationId: 'OBL-1',
      sequence: BigInt(sequence),
      type,
      effectiveAt: new Date(`2026-0${sequence}-01T00:00:00Z`),
      recordedAt: new Date(`2026-0${sequence}-01T00:00:00Z`),
      actorType: 'SYSTEM',
      actorId: null,
      causationId: null,
      correlationId: `event:${sequence}`,
      idempotencyKey: `event:${sequence}`,
      policyVersion: 'TEST_V1',
      payload,
      payloadHash: `hash-${sequence}`,
      allocations,
    });
    const service = makeService({
      obligationEvent: {
        findMany: jest.fn().mockResolvedValue([
          event(1, 'MIGRATION_BASELINE_CREATED', {
            contractualOutstanding: '100.10',
            penaltyOutstanding: '10.20',
          }),
          event(2, 'TOPUP_DISBURSED', { contractualRepayable: '50.30' }),
          event(3, 'PAYMENT_RECEIVED', { receiptId: 'RCT-1' }, [
            { component: 'PENALTY', amount: new Decimal('5.10') },
            { component: 'PRINCIPAL', amount: new Decimal('20.20') },
          ]),
          event(4, 'INSTALLMENT_DEFAULTED', { penalty: '4.40' }),
        ]),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await service.getLoanStatement('MB-1', {});

    expect(result.data.map((row) => row.totalBalance)).toEqual([
      139.7, 135.3, 160.6, 110.3,
    ]);
    expect(result.data[1]).toMatchObject({
      description: 'Repayment received',
      credit: 25.3,
      contractualBalance: 130.2,
      penaltyBalance: 5.1,
      totalBalance: 135.3,
    });
  });
});
