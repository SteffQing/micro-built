import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { Job } from 'bull';
import { GenerateReports } from './queue.reports';
import { MailService } from 'src/notifications/mail.service';
import { Prisma } from '@prisma/client';
import { logic } from 'src/common/logic/repayment.logic';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

import generateLoanReportPDF from 'src/notifications/templates/CustomerReportPDF';
import { PayrollVariationService } from 'src/obligations/payroll-variation.service';
import { createHash } from 'crypto';

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
  let variations: {
    getBatch: jest.Mock;
    serialize: jest.Mock;
    setArtifact: jest.Mock;
    recordEmail: jest.Mock;
  };
  const dec = (n: number | string) => new Prisma.Decimal(n);

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
          useValue: {
            uploadReport: jest.fn(),
            uploadVariationScheduleDoc: jest.fn(),
          },
        },
        {
          provide: PayrollVariationService,
          useValue: {
            getBatch: jest.fn(),
            serialize: jest.fn().mockReturnValue({ period: 'AUGUST 2026' }),
            setArtifact: jest.fn(),
            recordEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<GenerateReports>(GenerateReports);
    prisma = module.get<PrismaService>(PrismaService);
    mail = module.get(MailService);
    supabase = module.get<SupabaseService>(SupabaseService);
    variations = module.get(PayrollVariationService);
  });

  it('retries a transient database connection failure before generating', async () => {
    jest.useFakeTimers();
    const connectionError = Object.assign(
      new Error("Can't reach database server"),
      { code: 'P1001' },
    );
    const operation = jest
      .fn()
      .mockRejectedValueOnce(connectionError)
      .mockResolvedValue('connected');

    const result = (processor as any).retryTransientDatabase(operation);
    await jest.advanceTimersByTimeAsync(500);

    await expect(result).resolves.toBe('connected');
    expect(operation).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  const variationJob = () =>
    ({
      data: { variationBatchId: 'VAR-1', email: 'payroll@example.com' },
      progress: jest.fn(),
    }) as unknown as Job;
  const savedBatch = () => ({
    id: 'VAR-1',
    period: new Date('2026-07-31T23:00:00Z'),
    version: 1,
    kind: 'VARIATION',
    status: 'PREPARED',
    createdAt: new Date('2026-08-01T08:00:00Z'),
    internalScheduleId: 'SCH-1',
    note: 'August review',
    artifactHash: null,
    rows: [
      {
        externalId: '001234',
        borrowerName: 'Customer One',
        command: 'LAGOS',
        action: 'STOP',
        reasons: ['Liquidation applied', 'Loan settled'],
        contractualOutstanding: dec(0),
        penaltyOutstanding: dec(0),
        totalOutstanding: dec(0),
        amount: dec(0),
        termRemaining: 0,
        effectiveFromPeriod: new Date('2026-07-31T23:00:00Z'),
        endDate: null,
      },
    ],
  });

  it('rejects old queued jobs rather than sending a full customer schedule', async () => {
    await expect(
      processor.generateScheduleVariation({
        data: { period: 'AUGUST 2026' },
      } as Job),
    ).rejects.toThrow('Refresh the variation preview');
    expect(mail.sendLoanScheduleReport).not.toHaveBeenCalled();
  });

  it('exports stop instructions with zero deduction and the correct Lagos effective date', async () => {
    variations.getBatch.mockResolvedValue(savedBatch());
    await processor.generateScheduleVariation(variationJob());
    const [to, details, buffer] = mail.sendLoanScheduleReport.mock.calls[0];
    expect(to).toBe('payroll@example.com');
    expect(details).toMatchObject({
      amount: 0,
      len: 1,
      draft: false,
      variationId: 'VAR-1',
    });
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    expect(
      XLSX.utils.sheet_to_json(workbook.Sheets['Payroll changes']),
    ).toEqual([
      expect.objectContaining({
        ACTION: 'STOP',
        AMOUNT: 0,
        'IPPIS NO.': '001234',
        'START DATE': '01/08/2026',
        'END DATE': '',
      }),
    ]);
    expect(variations.recordEmail).toHaveBeenCalledWith('VAR-1');
  });

  it('reproduces identical bytes after the operator confirms the saved file as sent', async () => {
    const batch = savedBatch();
    variations.getBatch.mockResolvedValue(batch);
    await processor.generateScheduleVariation(variationJob());
    const original: Buffer = mail.sendLoanScheduleReport.mock.calls[0][2];
    variations.getBatch.mockResolvedValue({
      ...batch,
      status: 'SENT',
      artifactHash: createHash('sha256').update(original).digest('hex'),
    });
    await processor.generateScheduleVariation(variationJob());
    expect(mail.sendLoanScheduleReport.mock.calls[1][2]).toEqual(original);
    expect(supabase.uploadVariationScheduleDoc).toHaveBeenCalledTimes(1);
  });

  it('records email delivery failure without confirming submission', async () => {
    variations.getBatch.mockResolvedValue(savedBatch());
    mail.sendLoanScheduleReport.mockRejectedValue(
      new Error('Provider rejected delivery'),
    );
    await expect(
      processor.generateScheduleVariation(variationJob()),
    ).rejects.toThrow('Provider rejected delivery');
    expect(variations.recordEmail).toHaveBeenCalledWith(
      'VAR-1',
      'Provider rejected delivery',
    );
  });

  it('rejects a changed binary instead of emailing a different historical file', async () => {
    variations.getBatch.mockResolvedValue({
      ...savedBatch(),
      artifactHash: 'different',
    });
    await expect(
      processor.generateScheduleVariation(variationJob()),
    ).rejects.toThrow('cannot be reproduced exactly');
    expect(mail.sendLoanScheduleReport).not.toHaveBeenCalled();
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
      'Penalty Charged',
      'Actual Payment',
      'Outstanding',
    ]);

    if (process.env.EXPORT_CUSTOMER_REPORT === 'true') {
      const outDir = path.resolve(process.cwd(), 'tmp');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, `test-customer-loan-report.xlsx`),
        xlsxBuffer,
      );
      // fs.writeFileSync(
      //   path.join(outDir, 'test-customer-loan-report.pdf'),
      //   passedPdf,
      // );
    }
  });
});
