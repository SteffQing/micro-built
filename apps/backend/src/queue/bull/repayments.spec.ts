import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';
import { CustomerNotifierService } from 'src/notifications/customer-notifier.service';
import { RepaymentObligationService } from 'src/obligations/repayment-obligation.service';
import * as XLSX from 'xlsx';
import { RepaymentsConsumer } from './queue.repayments';

describe('RepaymentsConsumer canonical obligation orchestration', () => {
  let consumer: RepaymentsConsumer;
  let prisma: any;
  let config: any;
  let notifier: any;
  let obligations: any;

  beforeEach(async () => {
    prisma = {
      repayment: {
        create: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            repaidAmount: new Prisma.Decimal(100),
            expectedAmount: new Prisma.Decimal(100),
          },
        }),
        findUnique: jest.fn(),
      },
      userPayroll: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ userId: 'IPPIS-1', user: { id: 'USER-1' } }]),
        update: jest.fn(),
      },
      user: { update: jest.fn() },
      liquidationRequest: { update: jest.fn() },
    };
    config = {
      getValue: jest.fn().mockResolvedValue(0),
      topupValue: jest.fn(),
      depleteValue: jest.fn(),
      setRecentProcessedRepayment: jest.fn(),
    };
    notifier = { notify: jest.fn() };
    obligations = {
      backfillActiveObligations: jest.fn(),
      createCompatibilityExpectations: jest.fn().mockResolvedValue(1),
      applyPayrollPayment: jest.fn().mockResolvedValue({
        duplicate: false,
        applied: 51000,
        credit: 0,
        penaltyPaid: 1000,
        interestPaid: 5000,
      }),
      closeRepaymentPeriod: jest.fn(),
      applyUnscheduledPayment: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        RepaymentsConsumer,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: CustomerNotifierService, useValue: notifier },
        { provide: RepaymentObligationService, useValue: obligations },
      ],
    }).compile();
    consumer = module.get(RepaymentsConsumer);
  });

  function workbookBuffer() {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Staff ID', 'Amount', 'Full Name', 'Period', 'MDA'],
      ['IPPIS-1', 51000, 'Ada Customer', 'AUGUST 2026', 'NAVY'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Repayments');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  it('uses the same canonical installment for expectation and payroll allocation', async () => {
    const buffer = workbookBuffer();
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: jest
        .fn()
        .mockResolvedValue(
          buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
          ),
        ),
    });
    const progress = jest.fn();

    await consumer.handleIPPISrepayment({
      data: { url: 'https://example.test/payroll.xlsx', period: 'AUGUST 2026' },
      progress,
    } as unknown as Job<any>);

    expect(obligations.createCompatibilityExpectations).toHaveBeenCalledWith(
      'AUGUST 2026',
    );
    expect(obligations.applyPayrollPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'USER-1',
        period: 'AUGUST 2026',
        externalReference: expect.stringMatching(
          /^IPPIS-1:AUGUST 2026:[a-f0-9]{64}:1$/,
        ),
      }),
    );
    expect(config.topupValue).toHaveBeenCalledWith('TOTAL_REPAID', 51000);
    expect(config.topupValue).toHaveBeenCalledWith(
      'INTEREST_RATE_REVENUE',
      5000,
    );
    expect(config.topupValue).toHaveBeenCalledWith('PENALTY_FEE_REVENUE', 1000);
  });

  it('closes defaults once through the obligation service and records the period', async () => {
    obligations.closeRepaymentPeriod.mockResolvedValue({
      totalPenalty: new Prisma.Decimal(2500),
      defaults: 1,
      notifications: [
        {
          userId: 'USER-1',
          expected: 50000,
          paid: 25000,
          shortfall: 25000,
          penalty: 2500,
        },
      ],
    });
    config.getValue.mockResolvedValue(0.1);

    await consumer.handleCloseRepaymentPeriod({
      data: { period: 'AUGUST 2026' },
    } as Job<any>);

    expect(obligations.closeRepaymentPeriod).toHaveBeenCalledWith(
      'AUGUST 2026',
      0.1,
    );
    expect(config.topupValue).toHaveBeenCalledWith('BALANCE_OUTSTANDING', 2500);
    expect(config.setRecentProcessedRepayment).toHaveBeenCalled();
    expect(notifier.notify).toHaveBeenCalledWith(
      'USER-1',
      expect.objectContaining({ title: 'Missed Repayment' }),
    );
  });

  it('routes liquidation through the canonical waterfall and then approves it', async () => {
    obligations.applyUnscheduledPayment.mockResolvedValue({
      duplicate: false,
      applied: new Prisma.Decimal(75000),
      credit: new Prisma.Decimal(0),
      penaltyPaid: new Prisma.Decimal(5000),
      interestPaid: new Prisma.Decimal(10000),
    });

    await consumer.handleLiquidationRequest({
      data: {
        userId: 'USER-1',
        amount: 75000,
        liquidationRequestId: 'LIQ-1',
      },
    } as Job<any>);

    expect(obligations.applyUnscheduledPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'USER-1',
        amount: 75000,
        source: 'LIQUIDATION',
        liquidationRequestId: 'LIQ-1',
      }),
    );
    expect(prisma.liquidationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'LIQ-1' },
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
  });
});
