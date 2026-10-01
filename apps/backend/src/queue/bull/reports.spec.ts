import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Job } from 'bull';
import * as XLSX from 'xlsx';
import { buildCashLoanWhere } from 'src/admin/loan/loan-filters';
import { buildInflowWhere } from 'src/admin/repayments/repayment-filters';
import { loanFiguresMany } from 'src/common/dto/loan.dto';
import { captureJobError } from 'src/common/observability';
import { ReportQueueName } from 'src/common/types/queue.interface';
import { XLSX_MIME } from 'src/documents/spreadsheet';
import { repaymentRates } from 'src/ledger/repayment-rate';
import { GenerateReports } from './queue.reports';

jest.mock('src/notifications/mail.service', () => ({ MailService: class {} }));
jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));
jest.mock('src/common/dto/loan.dto', () => ({ loanFiguresMany: jest.fn() }));
jest.mock('src/ledger/repayment-rate', () => ({
  repaymentRates: jest.fn(),
  customersByRepaymentRate: jest.fn(),
}));

const dec = (n: number | string) => new Prisma.Decimal(n);
const NOW = new Date('2026-10-01T09:00:00Z');

function job<T>(name: string, data: T, attempts?: { made: number; max?: number }) {
  return {
    id: 7,
    name,
    data,
    progress: jest.fn(),
    attemptsMade: attempts?.made ?? 1,
    opts: { attempts: attempts?.max },
  } as unknown as Job<T>;
}

/** The first sheet of a delivered file, row by row. */
function sheetRows(body: unknown): unknown[][] {
  const book = XLSX.read(body as Buffer, { type: 'buffer' });
  return XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]], { header: 1, defval: '' });
}

describe('GenerateReports', () => {
  let prisma: {
    customer: { findMany: jest.Mock; findUnique: jest.Mock };
    loan: { findMany: jest.Mock; aggregate: jest.Mock };
    commodityLoan: { findMany: jest.Mock };
    paymentInflow: { findMany: jest.Mock };
  };
  const documents = { deliver: jest.fn() };
  const statements = { lines: jest.fn() };
  const variations = { preview: jest.fn(), buildWorkbook: jest.fn() };
  const mail = { sendLoanScheduleReport: jest.fn() };
  const inapp = { messageUser: jest.fn() };
  const clock = { now: () => NOW };
  let reports: GenerateReports;

  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      customer: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      loan: { findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn() },
      commodityLoan: { findMany: jest.fn().mockResolvedValue([]) },
      paymentInflow: { findMany: jest.fn().mockResolvedValue([]) },
    };
    (loanFiguresMany as jest.Mock).mockResolvedValue(new Map());
    (repaymentRates as jest.Mock).mockResolvedValue(new Map());
    reports = new GenerateReports(
      prisma as never,
      documents as never,
      statements as never,
      variations as never,
      mail as never,
      inapp as never,
      clock as never,
    );
  });

  describe('export_list', () => {
    const loan = {
      id: 'LN-1',
      status: 'DISBURSED',
      category: 'PERSONAL',
      principal: dec(100_000),
      tenure: 6,
      interestRate: dec(0.05),
      managementFeeRate: dec(0.02),
      disbursementDate: new Date('2026-06-10T10:00:00Z'),
      createdAt: new Date('2026-06-01T10:00:00Z'),
      borrowerId: 'MB-1',
      borrower: { externalId: '001234', user: { name: 'Ada Obi' } },
    };

    it("ANDs a customer's own scope with the list filter and delivers the file to the requester", async () => {
      prisma.loan.findMany.mockResolvedValue([loan]);
      (loanFiguresMany as jest.Mock).mockResolvedValue(
        new Map([
          [
            'LN-1',
            {
              owed: 130_000,
              repaid: 30_000,
              outstanding: 100_000,
              principal: 100_000,
              interestBooked: 30_000,
              penaltyBooked: 0,
              tenure: 6,
              remainingMonths: 4,
              monthly: 25_000,
            },
          ],
        ]),
      );
      const filters = { status: 'DISBURSED', search: 'ada' };

      await reports.exportList(
        job(ReportQueueName.export_list, {
          dataset: 'cash_loans' as const,
          filters,
          requestedById: 'MB-1',
          scopeUserId: 'MB-1',
        }),
      );

      const { where } = prisma.loan.findMany.mock.calls[0][0];
      expect(where).toEqual({ AND: [buildCashLoanWhere(filters as never), { borrowerId: 'MB-1' }] });
      expect(loanFiguresMany).toHaveBeenCalledWith(prisma, [loan]);

      const delivered = documents.deliver.mock.calls[0][0];
      expect(delivered).toMatchObject({
        userId: 'MB-1',
        email: undefined,
        title: 'Cash loans export ready',
        fileName: 'cash-loans-2026-10-01.xlsx',
        contentType: XLSX_MIME,
      });
      expect(delivered.message).toContain('(1 row)');
      const [header, row] = sheetRows(delivered.body);
      const cell = (name: string) => row[header.indexOf(name)];
      expect(cell('Loan ID')).toBe('LN-1');
      expect(cell('Customer')).toBe('Ada Obi');
      expect(cell('Category')).toBe('Personal');
      expect(cell('Interest Rate (%)')).toBe(5);
      expect(cell('Outstanding')).toBe(100_000);
      expect(cell('Monthly Deduction')).toBe(25_000);
      expect(cell('Disbursed On')).toBe('10/06/2026');
    });

    it("never lets a customer's filters widen their repayments export to someone else's", async () => {
      const filters = { customerId: 'MB-OTHER', from: '2026-01', to: '2026-06' };

      await reports.exportList(
        job(ReportQueueName.export_list, {
          dataset: 'repayments' as const,
          filters,
          requestedById: 'MB-1',
          email: 'ada@example.com',
          scopeUserId: 'MB-1',
        }),
      );

      const { where } = prisma.paymentInflow.findMany.mock.calls[0][0];
      expect(where).toEqual({ AND: [buildInflowWhere(filters as never), { customerId: 'MB-1' }] });
      expect(documents.deliver).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'MB-1', email: 'ada@example.com', message: expect.stringContaining('(0 rows)') }),
      );
      // The header row is there even with nothing to export.
      expect(sheetRows(documents.deliver.mock.calls[0][0].body)[0]).toContain('Payroll Month');
    });

    it('uses the admin list filter unchanged, with the repayment rate and no placeholder emails', async () => {
      prisma.customer.findMany.mockResolvedValue([
        {
          userId: 'MB-1',
          externalId: '001234',
          user: {
            name: 'Ada Obi',
            email: '2348012345678@phone.microbuiltprime.com',
            phoneNumber: '+2348012345678',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-31T23:30:00Z'),
          },
          accountOfficer: { user: { name: 'Officer One' } },
          payroll: { organization: 'Navy', command: 'LAGOS', employeeGross: dec(200_000), netPay: dec(150_000) },
        },
      ]);
      (repaymentRates as jest.Mock).mockResolvedValue(new Map([['MB-1', 87.5]]));

      await reports.exportList(
        job(ReportQueueName.export_list, {
          dataset: 'customers' as const,
          filters: { status: 'ACTIVE' },
          requestedById: 'AD-1',
          email: 'admin@microbuilt.com',
        }),
      );

      expect(prisma.customer.findMany.mock.calls[0][0].where).toEqual({ user: { status: 'ACTIVE' } });
      expect(repaymentRates).toHaveBeenCalledWith(prisma, ['MB-1']);
      const [header, row] = sheetRows(documents.deliver.mock.calls[0][0].body);
      const cell = (name: string) => row[header.indexOf(name)];
      expect(cell('Email')).toBe('');
      expect(cell('Repayment Rate (%)')).toBe(87.5);
      expect(cell('Account Officer')).toBe('Officer One');
      // 23:30 UTC on the 31st is 1 February in Lagos.
      expect(cell('Signed Up')).toBe('01/02/2026');
      expect(documents.deliver).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'AD-1', email: 'admin@microbuilt.com' }),
      );
    });

    it('scopes commodity requests through their loan', async () => {
      await reports.exportRows('commodity_loans', {}, 'MB-1');
      expect(prisma.commodityLoan.findMany.mock.calls[0][0].where).toEqual({
        AND: [{}, { loan: { borrowerId: 'MB-1' } }],
      });
    });

    it('refuses a job queued in the v1 shape (no requester)', async () => {
      await expect(
        reports.exportList(job(ReportQueueName.export_list, { dataset: 'customers', filters: {}, email: 'x@y.com' } as never)),
      ).rejects.toThrow('request it again');
      expect(documents.deliver).not.toHaveBeenCalled();
    });
  });

  describe('customer_report', () => {
    const statement = {
      opening: 0,
      debits: 120_000,
      credits: 20_000,
      closing: 100_000,
      lines: [
        {
          date: new Date('2026-06-10T10:00:00Z'),
          loanId: 'LN-1',
          reference: 'ML-1',
          type: 'DISBURSEMENT',
          description: 'Loan disbursed',
          debit: 100_000,
          credit: 0,
          balance: 100_000,
          managementFee: 2_000,
        },
        {
          date: new Date('2026-07-28T10:00:00Z'),
          loanId: 'LN-1',
          reference: 'RP-1',
          type: 'REPAYMENT',
          description: 'Payroll deduction, JULY 2026',
          debit: 0,
          credit: 20_000,
          balance: 100_000,
          split: { principal: 15_000, interest: 5_000, penalty: 0 },
        },
      ],
    };

    beforeEach(() => {
      prisma.customer.findUnique.mockResolvedValue({ externalId: '001234', user: { name: 'Ada Obi' } });
      prisma.loan.aggregate.mockResolvedValue({ _min: { disbursementDate: new Date('2026-05-31T23:30:00Z') } });
      statements.lines.mockResolvedValue(statement);
    });

    it("defaults to the first disbursement's month through this month and sends the admin copy to the requester", async () => {
      await reports.customerReport(
        job(ReportQueueName.customer_report, {
          customerId: 'MB-1',
          email: 'admin@microbuilt.com',
          requestedById: 'AD-1',
          audience: 'admin' as const,
        }),
      );

      // 23:30 UTC on 31 May is June in Lagos.
      expect(statements.lines).toHaveBeenCalledWith(
        { customerId: 'MB-1' },
        { from: { year: 2026, month: 'JUNE' }, to: { year: 2026, month: 'OCTOBER' } },
        'admin',
      );
      const delivered = documents.deliver.mock.calls[0][0];
      expect(delivered).toMatchObject({
        userId: 'AD-1',
        email: 'admin@microbuilt.com',
        title: 'Loan report for Ada Obi is ready',
        fileName: 'loan-report-001234-2026-06-to-2026-10.xlsx',
        contentType: XLSX_MIME,
      });
      const grid = sheetRows(delivered.body);
      expect(grid[0].slice(0, 2)).toEqual(['Customer', 'Ada Obi']);
      expect(grid[1].slice(0, 2)).toEqual(['IPPIS number', '001234']);
      expect(grid[2].slice(0, 2)).toEqual(['Period', 'JUNE 2026 – OCTOBER 2026']);
      expect(grid[6].slice(0, 2)).toEqual(['Closing balance', 100_000]);
      const header = grid.find((row) => row[0] === 'Date')!;
      expect(header).toContain('Management Fee');
      expect(header).toContain('Interest Paid');
      const repayment = grid.find((row) => row[2] === 'RP-1')!;
      expect(repayment[header.indexOf('Credit')]).toBe(20_000);
      expect(repayment[header.indexOf('Principal Paid')]).toBe(15_000);
    });

    it("gives the customer's own copy to the customer, without the admin columns", async () => {
      await reports.customerReport(
        job(ReportQueueName.customer_report, {
          customerId: 'MB-1',
          email: 'ada@example.com',
          audience: 'customer' as const,
          from: '2026-07',
          to: '2026-08',
        }),
      );

      expect(prisma.loan.aggregate).not.toHaveBeenCalled();
      expect(statements.lines).toHaveBeenCalledWith(
        { customerId: 'MB-1' },
        { from: { year: 2026, month: 'JULY' }, to: { year: 2026, month: 'AUGUST' } },
        'customer',
      );
      const delivered = documents.deliver.mock.calls[0][0];
      expect(delivered).toMatchObject({ userId: 'MB-1', email: 'ada@example.com', title: 'Your loan report is ready' });
      const header = sheetRows(delivered.body).find((row) => row[0] === 'Date')!;
      expect(header).not.toContain('Management Fee');
    });

    it('fails when the customer has no disbursed loan', async () => {
      prisma.loan.aggregate.mockResolvedValue({ _min: { disbursementDate: null } });
      await expect(
        reports.customerReport(
          job(ReportQueueName.customer_report, { customerId: 'MB-1', email: 'a@b.com', audience: 'admin' as const }),
        ),
      ).rejects.toThrow('no disbursed loan');
      expect(documents.deliver).not.toHaveBeenCalled();
    });
  });

  describe('variation_draft', () => {
    it('emails the draft workbook of the period with its count and total', async () => {
      const rows = [{ amount: dec('25000.50') }, { amount: dec(0) }, { amount: dec(10_000) }];
      variations.preview.mockResolvedValue({ period: { label: 'JUNE 2026' }, rows });
      const file = Buffer.from('xlsx');
      variations.buildWorkbook.mockReturnValue(file);

      await reports.variationDraft(
        job(ReportQueueName.variation_draft, { periodId: 'P-1', email: 'payroll@example.com', requestedById: 'AD-1' }),
      );

      expect(variations.preview).toHaveBeenCalledWith('P-1');
      expect(variations.buildWorkbook).toHaveBeenCalledWith(rows);
      expect(mail.sendLoanScheduleReport).toHaveBeenCalledWith(
        'payroll@example.com',
        { period: 'JUNE 2026', len: 3, amount: 35_000.5, draft: true },
        file,
      );
    });
  });

  describe('failures', () => {
    const error = new Error('boom');

    it('reports the error and tells the requester their file could not be made', async () => {
      await reports.onFailed(
        job(ReportQueueName.export_list, { dataset: 'cash_loans' as const, requestedById: 'AD-1' }),
        error,
      );
      expect(captureJobError).toHaveBeenCalledWith(error, {
        queue: 'reports',
        job: ReportQueueName.export_list,
        jobId: 7,
      });
      expect(inapp.messageUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'AD-1', title: "Your cash loans export couldn't be made" }),
      );
    });

    it("tells the customer when they asked for their own report, and the admin for a variation draft", async () => {
      await reports.onFailed(job(ReportQueueName.customer_report, { customerId: 'MB-1' }), error);
      await reports.onFailed(job(ReportQueueName.variation_draft, { periodId: 'P-1', requestedById: 'AD-2' }), error);
      expect(inapp.messageUser.mock.calls.map(([m]) => [m.userId, m.title])).toEqual([
        ['MB-1', "Your loan report couldn't be made"],
        ['AD-2', "Your variation draft couldn't be made"],
      ]);
    });

    it('waits for the last attempt before telling anyone', async () => {
      await reports.onFailed(
        job(ReportQueueName.export_list, { dataset: 'customers' as const, requestedById: 'AD-1' }, { made: 1, max: 3 }),
        error,
      );
      expect(captureJobError).toHaveBeenCalledTimes(1);
      expect(inapp.messageUser).not.toHaveBeenCalled();
    });

    it('never throws when the notification itself fails', async () => {
      inapp.messageUser.mockRejectedValueOnce(new Error('db down'));
      await expect(
        reports.onFailed(job(ReportQueueName.export_list, { dataset: 'customers' as const, requestedById: 'AD-1' }), error),
      ).resolves.toBeUndefined();
      expect(captureJobError).toHaveBeenCalledTimes(2);
    });
  });
});
