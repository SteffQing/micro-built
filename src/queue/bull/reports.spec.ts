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

describe('GenerateReports Processor', () => {
  let processor: GenerateReports;
  let prisma: PrismaService;
  let mail: { sendLoanScheduleReport: jest.Mock };
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
            loan: { findMany: jest.fn() }, // Mock the specific model
          },
        },
        {
          provide: MailService,
          useValue: { sendLoanScheduleReport: jest.fn() },
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
});
