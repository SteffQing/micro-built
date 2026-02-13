import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { Job } from 'bull';
import { GenerateReports } from './queue.reports';
import { MailService } from 'src/notifications/mail.service';
import { Prisma } from '@prisma/client';
import { logic, roundTo2 } from 'src/common/logic/repayment.logic';
import { addMonths, differenceInMonths, max, subDays } from 'date-fns';
import { groupBy } from 'lodash';
import { formatDateToDmy } from 'src/common/utils';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

import generateLoanReportPDF from 'src/notifications/templates/CustomerReportPDF';

jest.mock('src/notifications/templates/CustomerReportPDF', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('GenerateReports Processor', () => {
  let processor: GenerateReports;
  let prisma: PrismaService;
  let mail: {
    sendLoanScheduleReport: jest.Mock;
    sendCustomerLoanReport: jest.Mock;
  };
  let supabase: SupabaseService;

  const mockJob = {
    data: {
      period: 'MAY 2026',
      email: 'steveola23@gmail.com',
      save: true,
    },
    progress: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job;

  const dec = (n: number | string) => new Prisma.Decimal(n);

  type LoanRow = {
    principal: Prisma.Decimal;
    penalty: Prisma.Decimal;
    interestRate: Prisma.Decimal;
    tenure: number;
    disbursementDate: Date;
    repaid: Prisma.Decimal;
    penaltyRepaid: Prisma.Decimal;
    repayable: Prisma.Decimal;
    extension: number;
    borrower: {
      externalId: string;
      name: string;
      payroll: { command: string; organization: string } | null;
    };
  };

  const makeLoan = (overrides: Partial<LoanRow> = {}): LoanRow => {
    const baseWithoutRepayable = {
      principal: dec(1000),
      penalty: dec(0),
      interestRate: dec(0.1),
      tenure: 12,
      extension: 0,
      disbursementDate: new Date('2026-01-15T00:00:00.000Z'),
      repaid: dec(0),
      penaltyRepaid: dec(0),
      borrower: {
        externalId: 'IPPIS001',
        name: 'Test User',
        payroll: { command: 'TEST_COMMAND', organization: 'TEST_ORG' },
      },
    } satisfies Omit<LoanRow, 'repayable'>;

    const merged = {
      ...baseWithoutRepayable,
      ...overrides,
      borrower: {
        ...baseWithoutRepayable.borrower,
        ...(overrides.borrower ?? {}),
      },
    } as Omit<LoanRow, 'repayable'>;

    const repayableNumber = logic.getTotalPayment(
      merged.principal.toNumber(),
      merged.interestRate.toNumber(),
      merged.tenure,
    );

    return {
      ...merged,
      repayable: dec(repayableNumber),
    };
  };

  const computeExpectedScheduleRows = (loans: LoanRow[]) => {
    const byUser = groupBy(loans, (l) => l.borrower.externalId);

    return Object.values(byUser)
      .map((userLoans) => {
        const { borrower, disbursementDate } = userLoans[0];
        if (!borrower || !borrower.payroll) return null;

        const aggregate = userLoans.map((loan) => {
          const principal = loan.principal.toNumber();
          const rate = loan.interestRate.toNumber();
          const months = loan.tenure + loan.extension;

          const monthlyPayment = logic.getMonthlyPayment(
            principal,
            rate,
            loan.tenure,
            loan.extension,
          );
          const penaltyOwed = loan.penalty.sub(loan.penaltyRepaid);
          const owed = penaltyOwed.add(monthlyPayment);

          const totalPayable = loan.repayable.add(loan.penalty);
          const totalRepaid = loan.repaid.add(loan.penaltyRepaid);

          const endDate = subDays(addMonths(loan.disbursementDate, months), 1);
          const balance = totalPayable.sub(totalRepaid);

          return {
            owed: owed.toNumber(),
            endDate,
            balance: balance.toNumber(),
          };
        });

        const endDate = max(aggregate.map((a) => a.endDate));
        const expected = roundTo2(
          aggregate.reduce((acc, a) => acc + a.owed, 0),
        );
        const balance = roundTo2(
          aggregate.reduce((acc, a) => acc + a.balance, 0),
        );

        return {
          externalId: borrower.externalId,
          name: borrower.name,
          command: borrower.payroll.command,
          tenure: differenceInMonths(endDate, disbursementDate),
          start: disbursementDate,
          end: endDate,
          expected,
          balance,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateReports,
        {
          provide: PrismaService,
          useValue: {
            loan: { findMany: jest.fn() },
            user: { findUniqueOrThrow: jest.fn() },
          },
        },
        {
          provide: MailService,
          useValue: {
            sendLoanScheduleReport: jest.fn(),
            sendCustomerLoanReport: jest.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: { uploadReport: jest.fn() },
        },
      ],
    }).compile();

    processor = module.get<GenerateReports>(GenerateReports);
    prisma = module.get<PrismaService>(PrismaService);
    mail = module.get(MailService);
    supabase = module.get<SupabaseService>(SupabaseService);
  });

  it('should generate schedule variation XLSX with accurate rows (and send email via MailService)', async () => {
    const loans: LoanRow[] = [
      makeLoan({
        borrower: {
          externalId: 'IPPIS001',
          name: 'Ada Lovelace',
          payroll: { command: 'NAVY', organization: 'ORG1' },
        },
        disbursementDate: new Date('2026-01-10T00:00:00.000Z'),
        principal: dec(100_000),
        interestRate: dec(0.1),
        tenure: 6,
        extension: 0,
        penalty: dec(0),
        repaid: dec(10_000),
      }),
      makeLoan({
        borrower: {
          externalId: 'IPPIS001',
          name: 'Ada Lovelace',
          payroll: { command: 'NAVY', organization: 'ORG1' },
        },
        disbursementDate: new Date('2026-02-05T00:00:00.000Z'),
        principal: dec(50_000),
        interestRate: dec(0.1),
        tenure: 12,
        extension: 2,
        penalty: dec(1_500),
        penaltyRepaid: dec(500),
        repaid: dec(0),
      }),
      makeLoan({
        borrower: {
          externalId: 'IPPIS001',
          name: 'Ada Lovelace',
          payroll: { command: 'NAVY', organization: 'ORG1' },
        },
        disbursementDate: new Date('2026-03-01T00:00:00.000Z'),
        principal: dec(75_000),
        interestRate: dec(0.05),
        tenure: 10,
        extension: 0,
        penalty: dec(0),
        repaid: dec(5_000),
      }),
      makeLoan({
        borrower: {
          externalId: 'IPPIS002',
          name: 'Grace Hopper',
          payroll: { command: 'ARMY', organization: 'ORG2' },
        },
        disbursementDate: new Date('2026-01-20T00:00:00.000Z'),
        principal: dec(200_000),
        interestRate: dec(0.1),
        tenure: 12,
        extension: 0,
        penalty: dec(2_000),
        penaltyRepaid: dec(0),
        repaid: dec(30_000),
      }),
      makeLoan({
        borrower: {
          externalId: 'IPPIS002',
          name: 'Grace Hopper',
          payroll: { command: 'ARMY', organization: 'ORG2' },
        },
        disbursementDate: new Date('2026-04-01T00:00:00.000Z'),
        principal: dec(25_000),
        interestRate: dec(0.1),
        tenure: 5,
        extension: 1,
        penalty: dec(0),
        repaid: dec(0),
      }),
      makeLoan({
        borrower: {
          externalId: 'IPPIS003',
          name: 'Skip Payroll',
          payroll: null,
        },
        disbursementDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ].sort(
      (a, b) => a.disbursementDate.getTime() - b.disbursementDate.getTime(),
    );

    (prisma.loan.findMany as jest.Mock).mockResolvedValue(loans);
    (supabase as any).uploadVariationScheduleDoc = jest
      .fn()
      .mockResolvedValue(undefined);

    await processor.generateScheduleVariation(mockJob as any);

    expect(prisma.loan.findMany).toHaveBeenCalled();
    expect(mockJob.progress).toHaveBeenCalledWith(40);
    expect(mockJob.progress).toHaveBeenCalledWith(70);
    expect(mockJob.progress).toHaveBeenCalledWith(90);
    expect(mockJob.progress).toHaveBeenCalledWith(100);

    expect(mail.sendLoanScheduleReport).toHaveBeenCalled();

    const [, , xlsxBuffer] = mail.sendLoanScheduleReport.mock.calls[0];
    expect(Buffer.isBuffer(xlsxBuffer)).toBe(true);

    const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      defval: '',
    });

    const expectedRows = computeExpectedScheduleRows(loans);

    for (const expected of expectedRows) {
      const row = rows.find((r) => r['IPPIS NO.'] === expected.externalId);
      expect(row).toBeDefined();
      if (!row) {
        throw new Error(`Missing row for borrower ${expected.externalId}`);
      }
      expect(row['NAMES OF BENEFICIARIES']).toBe(expected.name);
      expect(row['COMMAND']).toBe(expected.command);
      expect(Number(row['LOAN BALANCE'])).toBeCloseTo(expected.balance, 2);
      expect(Number(row['AMOUNT'])).toBeCloseTo(expected.expected, 2);
      expect(Number(row['TENURE'])).toBe(expected.tenure);
      expect(row['START DATE']).toBe(formatDateToDmy(expected.start));
      expect(row['END DATE']).toBe(formatDateToDmy(expected.end));
    }

    expect(rows.some((r) => r['IPPIS NO.'] === 'IPPIS003')).toBe(false);

    if (process.env.EXPORT_REPORT_XLSX === 'true') {
      const outDir = path.resolve(process.cwd(), 'tmp');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, 'test-variation-schedule.xlsx'),
        xlsxBuffer,
      );
    }
  });

  it('should not upload to supabase when save=false', async () => {
    const job = {
      ...mockJob,
      data: { ...mockJob.data, save: false },
      progress: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job;

    const loans: LoanRow[] = [
      makeLoan({
        borrower: {
          externalId: 'IPPIS010',
          name: 'No Upload User',
          payroll: { command: 'AIRFORCE', organization: 'ORG3' },
        },
        disbursementDate: new Date('2026-01-10T00:00:00.000Z'),
        principal: dec(10_000),
        interestRate: dec(0.1),
        tenure: 10,
      }),
    ];

    (prisma.loan.findMany as jest.Mock).mockResolvedValue(loans);
    (supabase as any).uploadVariationScheduleDoc = jest
      .fn()
      .mockResolvedValue(undefined);

    await processor.generateScheduleVariation(job as any);

    expect((supabase as any).uploadVariationScheduleDoc).not.toHaveBeenCalled();
  });

  it('should generate customer loan report XLSX + PDF (and send email via MailService)', async () => {
    const userId = 'user_123';
    const email = 'customer@example.com';
    const job = {
      data: { userId, email },
      progress: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job;

    const mockUser = {
      name: 'Ada Lovelace',
      externalId: 'IPPIS001',
      repaymentRate: 12.5,
    };

    const firstExpect = dec(logic.getMonthlyPayment(100_000, 0.1, 6));
    const firstOwe = firstExpect.sub(dec(20_000));
    const firstPenalty = firstOwe.mul(dec(0.2));
    const secondExpect = firstExpect.add(firstOwe).add(firstPenalty);
    const secondPenalty = secondExpect.mul(dec(0.2));
    const thirdExpect = secondExpect.add(secondPenalty);
    const totalRepaid = thirdExpect.add(dec(20_000));

    const loans = [
      {
        principal: dec(100_000),
        penalty: dec(500),
        penaltyRepaid: dec(500),
        repaid: totalRepaid,
        interestRate: dec(0.1),
        category: 'PERSONAL',
        disbursementDate: new Date('2026-01-10T00:00:00.000Z'),
        tenure: 6,
        extension: 0,
        type: 'NEW',
        repayable: dec(logic.getTotalPayment(100_000, 0.1, 6)),
        asset: { name: 'Laptop' },
        repayments: [
          {
            period: 'JANUARY 2026',
            expectedAmount: firstExpect,
            repaidAmount: dec(20_000),
            penaltyCharge: dec(0),
          },
          {
            period: 'FEBRUARY 2026',
            expectedAmount: secondExpect,
            repaidAmount: dec(0),
            penaltyCharge: firstPenalty,
          },
          {
            period: 'MARCH 2026',
            expectedAmount: thirdExpect,
            repaidAmount: thirdExpect,
            penaltyCharge: secondPenalty,
          },
        ],
      },
      {
        principal: dec(50_000),
        penalty: dec(0),
        penaltyRepaid: dec(0),
        repaid: dec(10_000),
        interestRate: dec(0.1),
        category: 'PERSONAL',
        disbursementDate: new Date('2026-03-01T00:00:00.000Z'),
        tenure: 3,
        extension: 0,
        type: 'TOPUP',
        repayable: dec(logic.getTotalPayment(50_000, 0.1, 3)),
        asset: null,
        repayments: [
          {
            period: 'MARCH 2026',
            expectedAmount: dec(logic.getMonthlyPayment(50_000, 0.1, 3)),
            repaidAmount: dec(10_000),
            penaltyCharge: dec(0),
          },
        ],
      },
    ];

    (prisma as any).user.findUniqueOrThrow.mockResolvedValue(mockUser);
    (prisma.loan.findMany as jest.Mock).mockResolvedValue(loans);

    const pdfBuffer = Buffer.from('%PDF-1.4\nmock pdf');
    (generateLoanReportPDF as unknown as jest.Mock).mockResolvedValue(
      pdfBuffer,
    );

    const returned = await processor.generateCustomerLoanReport(job as any);

    expect((prisma as any).user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: userId },
      select: { name: true, externalId: true, repaymentRate: true },
    });
    expect(prisma.loan.findMany).toHaveBeenCalled();

    expect(job.progress).toHaveBeenCalledWith(30);
    expect(job.progress).toHaveBeenCalledWith(40);

    expect(mail.sendCustomerLoanReport).toHaveBeenCalledTimes(1);

    const [to, details, xlsxBuffer, passedPdf] =
      mail.sendCustomerLoanReport.mock.calls[0];

    expect(to).toBe(email);
    expect(details).toEqual(
      expect.objectContaining({
        name: mockUser.name,
        id: mockUser.externalId,
        count: expect.any(Number),
        start: expect.any(String),
        end: expect.any(String),
      }),
    );

    expect(Buffer.isBuffer(xlsxBuffer)).toBe(true);
    expect(Buffer.isBuffer(passedPdf)).toBe(true);
    expect(passedPdf).toBe(pdfBuffer);
    expect(returned).toBe(pdfBuffer);
    expect(returned.subarray(0, 4).toString('utf8')).toBe('%PDF');

    const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: true,
    });

    expect(aoa[0]?.[0]).toBe(`Customer Name: ${mockUser.name}`);
    expect(aoa[1]?.[0]).toBe(`Customer IPPIS NO.: ${mockUser.externalId}`);
    expect(aoa[2]?.[0]).toBe(
      `Customer Repayment Rate: ${mockUser.repaymentRate}%`,
    );

    const headerRow = aoa.find((r) => r?.[0] === 'Date');
    expect(headerRow).toBeDefined();
    expect(headerRow).toEqual([
      'Date',
      'Note',
      'Borrowed Amount',
      'Interest Applied',
      'Current Due',
      'Actual Payment',
      'Outstanding',
    ]);

    if (process.env.EXPORT_CUSTOMER_REPORT === 'true') {
      const outDir = path.resolve(process.cwd(), 'tmp');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, `${Date.now()}-test-customer-loan-report.xlsx`),
        xlsxBuffer,
      );
      // fs.writeFileSync(
      //   path.join(outDir, 'test-customer-loan-report.pdf'),
      //   passedPdf,
      // );
    }
  });
});
