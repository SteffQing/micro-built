import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';
import * as XLSX from 'xlsx';
import { RepaymentsConsumer } from './queue.repayments';

describe('RepaymentsConsumer Processor', () => {
  let consumer: RepaymentsConsumer;
  let prisma: {
    loan: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
    repayment: {
      findMany: jest.Mock;
      createMany: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    userPayroll: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
    user: {
      update: jest.Mock;
    };
    liquidationRequest: {
      update: jest.Mock;
    };
  };
  let config: {
    getValue: jest.Mock;
    topupValue: jest.Mock;
    depleteValue: jest.Mock;
    setRecentProcessedRepayment: jest.Mock;
  };

  const dec = (n: number | string) => new Prisma.Decimal(n);

  const makeXlsxBuffer = (aoa: any[][]) => {
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  };

  const makeFetchOk = (buffer: Buffer) => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      statusText: 'OK',
      arrayBuffer: jest
        .fn()
        .mockResolvedValue(
          buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
          ),
        ),
    });
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepaymentsConsumer,
        {
          provide: PrismaService,
          useValue: {
            loan: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
            repayment: {
              findMany: jest.fn(),
              createMany: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
            userPayroll: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
            user: {
              update: jest.fn(),
            },
            liquidationRequest: {
              update: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getValue: jest.fn(),
            topupValue: jest.fn().mockResolvedValue(undefined),
            depleteValue: jest.fn().mockResolvedValue(undefined),
            setRecentProcessedRepayment: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    consumer = module.get<RepaymentsConsumer>(RepaymentsConsumer);
    prisma = module.get(PrismaService);
    config = module.get(ConfigService);

    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleIPPISrepayment', () => {
    it.skip('should throw when download fails', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });
      config.getValue.mockResolvedValue(0.1);

      const job = {
        data: { url: 'https://example.com/file.xlsx', period: 'MAY 2026' },
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await expect(consumer.handleIPPISrepayment(job as any)).rejects.toThrow(
        'Failed to download file: Not Found',
      );
    });

    it.skip('should throw when excel is empty', async () => {
      const buffer = makeXlsxBuffer([['Staff ID', 'Amount']]);
      makeFetchOk(buffer);
      config.getValue.mockResolvedValue(0.1);

      const job = {
        data: { url: 'https://example.com/file.xlsx', period: 'MAY 2026' },
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await expect(consumer.handleIPPISrepayment(job as any)).rejects.toThrow(
        'Excel file appears to be empty',
      );
    });

    it('should create missing awaiting repayments for active loans, apply a fulfilled repayment, mark remaining as failed, and update configs', async () => {
      process.env.DEBUG_REPAYMENTS = 'true';
      const period = 'MAY 2026';
      const url = 'https://example.com/file.xlsx';

      const buffer = makeXlsxBuffer([
        [
          'Staff ID',
          'Amount',
          'Grade',
          'Step',
          'Command',
          'Employee Gross',
          'Net Pay',
        ],
        ['IPPIS001', 150, 'GL', 10, 'NAVY', 1000, 800],
      ]);
      makeFetchOk(buffer);

      config.getValue.mockResolvedValue(0.1);

      prisma.loan.findMany.mockResolvedValue([
        {
          id: 'loan_1',
          principal: dec(1000),
          penalty: dec(50),
          tenure: 10,
          interestRate: dec(0.1),
          extension: 0,
          borrowerId: 'user_1',
          penaltyRepaid: dec(10),
        },
        {
          id: 'loan_2',
          principal: dec(2000),
          penalty: dec(0),
          tenure: 10,
          interestRate: dec(0.1),
          extension: 0,
          borrowerId: 'user_2',
          penaltyRepaid: dec(0),
        },
      ]);

      prisma.repayment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            expectedAmount: dec(100),
            id: 'rep_await_1',
            loan: {
              id: 'loan_1',
              principal: dec(1000),
              tenure: 10,
              extension: 0,
              repaid: dec(0),
              penalty: dec(50),
              interestRate: dec(0.1),
              disbursementDate: new Date('2026-01-01T00:00:00.000Z'),
              penaltyRepaid: dec(10),
              repayable: dec(1100),
            },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'rep_await_2',
            expectedAmount: dec(100),
          },
        ]);

      prisma.userPayroll.findMany.mockResolvedValue([
        { userId: 'IPPIS001', user: { id: 'user_1' } },
      ]);

      prisma.repayment.createMany.mockResolvedValue({ count: 2 });
      prisma.repayment.update.mockResolvedValue({ id: 'rep_await_1' });
      prisma.loan.update.mockResolvedValue({ id: 'loan_1' });
      prisma.userPayroll.update.mockResolvedValue({ userId: 'IPPIS001' });
      prisma.user.update.mockResolvedValue({ id: 'user_1' });

      const job = {
        data: { url, period },
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await consumer.handleIPPISrepayment(job as any);

      expect((global as any).fetch).toHaveBeenCalledWith(url);
      expect(config.getValue).toHaveBeenCalledWith('PENALTY_FEE_RATE');

      expect(prisma.repayment.createMany).toHaveBeenCalledTimes(1);
      const createManyArg = prisma.repayment.createMany.mock.calls[0][0];
      expect(createManyArg.data).toHaveLength(2);
      expect(createManyArg.data[0]).toEqual(
        expect.objectContaining({
          amount: dec(0),
          status: 'AWAITING',
          period,
          loanId: 'loan_1',
          userId: 'user_1',
        }),
      );

      expect(prisma.userPayroll.update).toHaveBeenCalledWith({
        where: { userId: 'IPPIS001' },
        data: expect.objectContaining({
          grade: 'GL',
          step: 10,
          command: 'NAVY',
          employeeGross: 1000,
          netPay: 800,
        }),
      });

      expect(prisma.repayment.update).toHaveBeenCalledWith({
        where: { id: 'rep_await_1' },
        data: expect.objectContaining({
          status: 'FULFILLED',
          repaidAmount: dec(100),
          amount: dec(150),
        }),
      });

      expect(prisma.loan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'loan_1' },
          data: expect.objectContaining({
            repaid: expect.any(Prisma.Decimal),
            penalty: expect.any(Object),
            penaltyRepaid: expect.any(Object),
          }),
        }),
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: { repaymentRate: 100 },
      });

      expect(prisma.repayment.update).toHaveBeenCalledWith({
        where: { id: 'rep_await_2' },
        data: expect.objectContaining({
          status: 'FAILED',
          failureNote: `Payment not received for period: ${period}`,
          penaltyCharge: expect.any(Object),
          loan: { update: expect.any(Object) },
        }),
        select: { id: true },
      });

      expect(config.topupValue).toHaveBeenCalled();
      expect(config.depleteValue).toHaveBeenCalled();
      expect(config.setRecentProcessedRepayment).toHaveBeenCalled();
      expect(job.progress).toHaveBeenCalledWith(100);
    });

    it('should create MANUAL_RESOLUTION repayment when staff id is not found in payroll map', async () => {
      const period = 'MAY 2026';
      const url = 'https://example.com/file.xlsx';

      const buffer = makeXlsxBuffer([
        ['Staff ID', 'Amount', 'Grade', 'Step', 'Command'],
        ['IPPIS404', 100, 'GL', 10, 'NAVY'],
      ]);
      makeFetchOk(buffer);
      config.getValue.mockResolvedValue(0.1);

      prisma.loan.findMany.mockResolvedValue([]);
      prisma.repayment.findMany.mockResolvedValue([]);
      prisma.userPayroll.findMany.mockResolvedValue([]);
      prisma.repayment.create.mockResolvedValue({ id: 'rep_manual' });

      const job = {
        data: { url, period },
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await consumer.handleIPPISrepayment(job as any);

      expect(prisma.repayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: dec(100),
          period,
          status: 'MANUAL_RESOLUTION',
          failureNote: expect.stringContaining(
            'No corresponding IPPIS ID found for the given staff id: IPPIS404',
          ),
        }),
      });
    });

    it('should create overflow MANUAL_RESOLUTION repayment when balance remains after settling all awaiting repayments', async () => {
      const period = 'MAY 2026';
      const url = 'https://example.com/file.xlsx';

      const buffer = makeXlsxBuffer([
        ['Staff ID', 'Amount', 'Grade', 'Step', 'Command'],
        ['IPPIS001', 250, 'GL', 10, 'NAVY'],
      ]);
      makeFetchOk(buffer);
      config.getValue.mockResolvedValue(0);

      prisma.loan.findMany.mockResolvedValue([]);

      prisma.repayment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            expectedAmount: dec(100),
            id: 'rep_await_1',
            loan: {
              id: 'loan_1',
              principal: dec(1000),
              tenure: 10,
              extension: 0,
              repaid: dec(0),
              penalty: dec(0),
              interestRate: dec(0.1),
              disbursementDate: new Date('2026-01-01T00:00:00.000Z'),
              penaltyRepaid: dec(0),
              repayable: dec(1100),
            },
          },
        ])
        .mockResolvedValueOnce([]);

      prisma.userPayroll.findMany.mockResolvedValue([
        { userId: 'IPPIS001', user: { id: 'user_1' } },
      ]);

      prisma.userPayroll.update.mockResolvedValue({ userId: 'IPPIS001' });
      prisma.repayment.update.mockResolvedValue({ id: 'rep_await_1' });
      prisma.loan.update.mockResolvedValue({ id: 'loan_1' });
      prisma.user.update.mockResolvedValue({ id: 'user_1' });
      prisma.repayment.create.mockResolvedValue({ id: 'rep_overflow' });

      const job = {
        data: { url, period },
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await consumer.handleIPPISrepayment(job as any);

      expect(prisma.repayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: dec(250),
          period,
          status: 'MANUAL_RESOLUTION',
          failureNote: 'Overflow of repayment balance',
          userId: 'user_1',
        }),
      });
    });
  });

  describe.skip('handleRepaymentOverflow', () => {
    it('should allocate repayment by updating existing repayment record (repaymentId) and update global configs', async () => {
      prisma.loan.findMany.mockResolvedValue([
        {
          id: 'loan_1',
          principal: dec(1000),
          penalty: dec(0),
          tenure: 10,
          extension: 0,
          interestRate: dec(0.1),
          repaid: dec(0),
          disbursementDate: new Date('2026-01-01T00:00:00.000Z'),
          penaltyRepaid: dec(0),
          repayable: dec(1100),
        },
      ]);

      prisma.repayment.update.mockResolvedValue({ id: 'rep_manual' });
      prisma.loan.update.mockResolvedValue({ id: 'loan_1' });

      const job = {
        data: {
          repaymentId: 'rep_manual',
          userId: 'user_1',
          amount: 50,
          period: 'MAY 2026',
          resolutionNote: 'Resolved',
        },
      } as unknown as Job;

      await consumer.handleRepaymentOverflow(job as any);

      expect(prisma.repayment.update).toHaveBeenCalledWith({
        where: { id: 'rep_manual' },
        data: expect.objectContaining({
          failureNote: null,
          userId: 'user_1',
          loanId: 'loan_1',
          status: 'FULFILLED',
          repaidAmount: dec(50),
          expectedAmount: dec(50),
          resolutionNote: 'Resolved',
        }),
      });

      expect(config.topupValue).toHaveBeenCalled();
    });
  });

  describe.skip('handleLiquidationRequest', () => {
    it('should allocate repayment and approve liquidation request', async () => {
      prisma.loan.findMany.mockResolvedValue([
        {
          id: 'loan_1',
          principal: dec(1000),
          penalty: dec(0),
          tenure: 10,
          extension: 0,
          interestRate: dec(0.1),
          repaid: dec(0),
          disbursementDate: new Date('2026-01-01T00:00:00.000Z'),
          penaltyRepaid: dec(0),
          repayable: dec(1100),
        },
      ]);

      prisma.repayment.create.mockResolvedValue({ id: 'rep_new' });
      prisma.loan.update.mockResolvedValue({ id: 'loan_1' });
      prisma.liquidationRequest.update.mockResolvedValue({ id: 'liq_1' });

      const job = {
        data: {
          amount: 50,
          userId: 'user_1',
          liquidationRequestId: 'liq_1',
        },
      } as unknown as Job;

      await consumer.handleLiquidationRequest(job as any);

      expect(prisma.repayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 50,
          userId: 'user_1',
          loanId: 'loan_1',
          status: 'FULFILLED',
          liquidationRequestId: 'liq_1',
        }),
      });

      expect(prisma.liquidationRequest.update).toHaveBeenCalledWith({
        where: { id: 'liq_1' },
        data: { status: 'APPROVED' },
      });

      expect(config.topupValue).toHaveBeenCalled();
    });
  });
});
