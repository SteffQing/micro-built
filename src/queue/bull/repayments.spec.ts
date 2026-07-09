import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';
import { CustomerNotifierService } from 'src/notifications/customer-notifier.service';
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
      findFirst: jest.Mock;
      createMany: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      aggregate: jest.Mock;
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
              findFirst: jest.fn(),
              createMany: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
              aggregate: jest.fn(),
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
        {
          provide: CustomerNotifierService,
          useValue: { notify: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    consumer = module.get<RepaymentsConsumer>(RepaymentsConsumer);
    prisma = module.get(PrismaService);
    config = module.get(ConfigService);

    (global as any).fetch = jest.fn();
    prisma.repayment.findFirst.mockResolvedValue(null);
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

    it('should create missing payroll awaiting repayments, apply a fulfilled repayment, and leave the period open until close', async () => {
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
          'Organization',
        ],
        ['IPPIS001', 150, 'GL', 10, 'NAVY', 1000, 800, 'FEDERAL'],
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
        ]);

      prisma.userPayroll.findMany.mockResolvedValue([
        { userId: 'IPPIS001', user: { id: 'user_1' } },
      ]);

      prisma.repayment.createMany.mockResolvedValue({ count: 2 });
      prisma.repayment.update.mockResolvedValue({ id: 'rep_await_1' });
      prisma.repayment.aggregate.mockResolvedValue({
        _sum: { repaidAmount: dec(100), expectedAmount: dec(100) },
      });
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
          source: 'PAYROLL',
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

      expect(config.topupValue).toHaveBeenCalled();
      expect(config.depleteValue).toHaveBeenCalled();
      expect(config.setRecentProcessedRepayment).not.toHaveBeenCalled();
      expect(job.progress).toHaveBeenCalledWith(100);
    });

    it('should create MANUAL_RESOLUTION repayment when staff id is not found in payroll map', async () => {
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
          'Organization',
        ],
        ['IPPIS404', 100, 'GL', 10, 'NAVY', 400000, 80000, 'FEDERAL'],
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
          source: 'MANUAL',
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
        [
          'Staff ID',
          'Amount',
          'Grade',
          'Step',
          'Command',
          'Employee Gross',
          'Net Pay',
          'Organization',
        ],
        ['IPPIS001', 250, 'GL', 10, 'NAVY', 400000, 80000, 'FEDERAL'],
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
      prisma.repayment.aggregate.mockResolvedValue({
        _sum: { repaidAmount: dec(100), expectedAmount: dec(100) },
      });
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
          source: 'OVERFLOW',
          failureNote: 'Overflow of repayment balance',
          userId: 'user_1',
        }),
      });
    });

    it('allows two files for the same open period when they contain different staff', async () => {
      const period = 'MAY 2026';

      const firstBuffer = makeXlsxBuffer([
        [
          'Staff ID',
          'Amount',
          'Grade',
          'Step',
          'Command',
          'Employee Gross',
          'Net Pay',
          'Organization',
        ],
        ['IPPIS001', 100, 'GL', 10, 'NAVY', 400000, 80000, 'FEDERAL'],
      ]);
      const secondBuffer = makeXlsxBuffer([
        [
          'Staff ID',
          'Amount',
          'Grade',
          'Step',
          'Command',
          'Employee Gross',
          'Net Pay',
          'Organization',
        ],
        ['IPPIS002', 100, 'GL', 10, 'ARMY', 300000, 70000, 'POLICE'],
      ]);

      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          statusText: 'OK',
          arrayBuffer: jest
            .fn()
            .mockResolvedValue(
              firstBuffer.buffer.slice(
                firstBuffer.byteOffset,
                firstBuffer.byteOffset + firstBuffer.byteLength,
              ),
            ),
        })
        .mockResolvedValueOnce({
          ok: true,
          statusText: 'OK',
          arrayBuffer: jest
            .fn()
            .mockResolvedValue(
              secondBuffer.buffer.slice(
                secondBuffer.byteOffset,
                secondBuffer.byteOffset + secondBuffer.byteLength,
              ),
            ),
        });

      config.getValue.mockImplementation((key: string) => {
        if (key === 'PENALTY_FEE_RATE') return Promise.resolve(0.1);
        if (key === 'LAST_REPAYMENT_DATE') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      prisma.loan.findMany.mockResolvedValue([
        {
          id: 'loan_1',
          principal: dec(1000),
          penalty: dec(0),
          tenure: 10,
          interestRate: dec(0.1),
          extension: 0,
          borrowerId: 'user_1',
          penaltyRepaid: dec(0),
        },
        {
          id: 'loan_2',
          principal: dec(1000),
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
              penalty: dec(0),
              interestRate: dec(0.1),
              disbursementDate: new Date('2026-01-01T00:00:00.000Z'),
              penaltyRepaid: dec(0),
              repayable: dec(1100),
            },
          },
        ])
        .mockResolvedValueOnce([{ loanId: 'loan_1' }, { loanId: 'loan_2' }])
        .mockResolvedValueOnce([
          {
            expectedAmount: dec(100),
            id: 'rep_await_2',
            loan: {
              id: 'loan_2',
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
        ]);

      prisma.userPayroll.findMany
        .mockResolvedValueOnce([{ userId: 'IPPIS001', user: { id: 'user_1' } }])
        .mockResolvedValueOnce([
          { userId: 'IPPIS002', user: { id: 'user_2' } },
        ]);

      prisma.repayment.createMany.mockResolvedValue({ count: 2 });
      prisma.repayment.update.mockResolvedValue({ id: 'rep_await' });
      prisma.repayment.aggregate
        .mockResolvedValueOnce({
          _sum: { repaidAmount: dec(100), expectedAmount: dec(100) },
        })
        .mockResolvedValueOnce({
          _sum: { repaidAmount: dec(100), expectedAmount: dec(100) },
        });
      prisma.loan.update.mockResolvedValue({ id: 'loan_1' });
      prisma.userPayroll.update.mockResolvedValue({ userId: 'IPPIS001' });
      prisma.user.update.mockResolvedValue({ id: 'user_1' });

      const firstJob = {
        data: { url: 'https://example.com/1.xlsx', period },
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job;
      const secondJob = {
        data: { url: 'https://example.com/2.xlsx', period },
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await consumer.handleIPPISrepayment(firstJob as any);
      await consumer.handleIPPISrepayment(secondJob as any);

      expect(prisma.repayment.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.repayment.update).toHaveBeenCalledTimes(2);
      expect(config.setRecentProcessedRepayment).not.toHaveBeenCalled();
    });

    it('skips a re-saved same-staff payroll row once that staff already has a processed payroll repayment for the period', async () => {
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
          'Company',
        ],
        ['IPPIS001', 250, 'GL', 10, 'NAVY', 400000, 80000, 'FEDERAL'],
      ]);
      makeFetchOk(buffer);
      config.getValue.mockImplementation((key: string) => {
        if (key === 'PENALTY_FEE_RATE') return Promise.resolve(0);
        if (key === 'LAST_REPAYMENT_DATE') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      prisma.loan.findMany.mockResolvedValue([]);
      prisma.repayment.findMany.mockResolvedValueOnce([]); // generateRepaymentsForActiveLoans
      prisma.userPayroll.findMany.mockResolvedValue([
        { userId: 'IPPIS001', user: { id: 'user_1' } },
      ]);
      prisma.repayment.findFirst.mockResolvedValue({
        id: 'rep_done_1',
      });

      const job = {
        data: { url, period },
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await consumer.handleIPPISrepayment(job as any);

      expect(prisma.repayment.update).not.toHaveBeenCalled();
      expect(prisma.repayment.create).not.toHaveBeenCalled();
      expect(prisma.loan.update).not.toHaveBeenCalled();
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

  describe('handleLiquidationRequest', () => {
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
        data: expect.objectContaining({ status: 'APPROVED' }),
      });

      expect(config.topupValue).toHaveBeenCalled();
    });
  });

  describe('handleLiquidationRequest — retry idempotency', () => {
    const baseLoan = {
      id: 'loan-1',
      principal: dec(500_000),
      repayable: dec(860_000),
      penalty: dec(0),
      penaltyRepaid: dec(0),
      repaid: dec(0),
      interestRate: dec(0.06),
      tenure: 12,
      extension: 0,
      disbursementDate: new Date('2025-01-01'),
    };

    it('does not create a duplicate repayment record when the job is retried', async () => {
      prisma.loan.findMany.mockResolvedValue([baseLoan]);

      // Simulate: first run already created this repayment
      prisma.repayment.findFirst.mockResolvedValue({
        repaidAmount: dec(860_000),
      });
      prisma.liquidationRequest.update.mockResolvedValue({});

      const job = {
        data: {
          amount: 860_000,
          userId: 'user-1',
          liquidationRequestId: 'liq-1',
        },
      } as unknown as Job;

      await consumer.handleLiquidationRequest(job as any);

      // No new repayment should be created
      expect(prisma.repayment.create).not.toHaveBeenCalled();
      // Liquidation request still gets approved
      expect(prisma.liquidationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED' }),
        }),
      );
    });

    it('accumulates stats from existing repayment on retry so config counters are correct', async () => {
      prisma.loan.findMany.mockResolvedValue([baseLoan]);

      prisma.repayment.findFirst.mockResolvedValue({
        repaidAmount: dec(71_666),
      });
      prisma.liquidationRequest.update.mockResolvedValue({});

      const job = {
        data: {
          amount: 71_666,
          userId: 'user-1',
          liquidationRequestId: 'liq-1',
        },
      } as unknown as Job;

      await consumer.handleLiquidationRequest(job as any);

      // topupValue called with TOTAL_REPAID > 0 (stats reconstructed from existing)
      expect(config.topupValue).toHaveBeenCalledWith(
        'TOTAL_REPAID',
        expect.any(Number),
      );
      const totalRepaidArg = config.topupValue.mock.calls.find(
        (c: any[]) => c[0] === 'TOTAL_REPAID',
      )?.[1];
      expect(totalRepaidArg).toBeGreaterThan(0);
    });
  });

  describe('handleIPPISrepayment — secondary header guard', () => {
    it('throws before creating AWAITING records when required columns are missing', async () => {
      const buffer = makeXlsxBuffer([
        ['IPPIS_NUMBER', 'PAYMENT', 'GROSS', 'NET'],
        ['EMP001', 50000, 400000, 80000],
      ]);
      makeFetchOk(buffer);
      config.getValue.mockResolvedValue(0.05);

      const job = {
        data: { url: 'http://fake/file.xlsx', period: 'APRIL 2026' },
        progress: jest.fn(),
      } as unknown as Job;

      await expect(consumer.handleIPPISrepayment(job as any)).rejects.toThrow(
        'Missing required columns:',
      );

      expect(prisma.repayment.createMany).not.toHaveBeenCalled();
    });

    it('does not throw when all required headers are present', async () => {
      const buffer = makeXlsxBuffer([
        ['StaffID', 'Amount', 'EmployeeGross', 'NetPay', 'Organization'],
        ['EMP001', 71666, 400000, 80000, 'FEDERAL'],
      ]);
      makeFetchOk(buffer);
      config.getValue.mockResolvedValue(0.05);

      prisma.loan.findMany.mockResolvedValue([]);
      prisma.repayment.findMany
        .mockResolvedValueOnce([]) // generateRepaymentsForActiveLoans
        .mockResolvedValueOnce([]); // markAwaitingRepaymentsAsFailed
      prisma.repayment.createMany.mockResolvedValue({ count: 0 });
      prisma.userPayroll.findMany.mockResolvedValue([]);

      const job = {
        data: { url: 'http://fake/file.xlsx', period: 'APRIL 2026' },
        progress: jest.fn(),
      } as unknown as Job;

      await expect(
        consumer.handleIPPISrepayment(job as any),
      ).resolves.not.toThrow();
    });
  });

  describe('handleCloseRepaymentPeriod', () => {
    it('fails remaining awaiting payroll repayments, adds penalty to outstanding, and closes the period', async () => {
      const period = 'MAY 2026';
      config.getValue.mockResolvedValue(0.1);
      prisma.repayment.findMany.mockResolvedValue([
        {
          id: 'rep_await_2',
          expectedAmount: dec(100),
          userId: 'user_2',
        },
      ]);
      prisma.repayment.update.mockResolvedValue({ id: 'rep_await_2' });

      const job = {
        data: { period },
      } as unknown as Job;

      await consumer.handleCloseRepaymentPeriod(job as any);

      expect(prisma.repayment.update).toHaveBeenCalledWith({
        where: { id: 'rep_await_2' },
        data: expect.objectContaining({
          status: 'FAILED',
          failureNote: `Payment not received for period: ${period}`,
          loan: {
            update: expect.objectContaining({
              penalty: { increment: expect.any(Prisma.Decimal) },
              extension: { increment: 1 },
            }),
          },
        }),
        select: { id: true },
      });
      expect(config.topupValue).toHaveBeenCalledWith('BALANCE_OUTSTANDING', 10);
      expect(config.setRecentProcessedRepayment).toHaveBeenCalled();
    });
  });
});
