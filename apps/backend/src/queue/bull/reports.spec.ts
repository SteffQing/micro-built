import { ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Job } from 'bull';
import * as XLSX from 'xlsx';
import { buildCashLoanWhere } from 'src/admin/loan/loan-filters';
import { buildInflowWhere } from 'src/admin/repayments/repayment-filters';
import { loanFiguresMany } from 'src/common/dto/loan.dto';
import { captureJobError } from 'src/common/observability';
import { ReportQueueName } from 'src/common/types/queue.interface';
import { protectDocument } from 'src/documents/protect';
import { renderReportPdf, renderStatementPdf } from 'src/documents/render/pdf';
import { renderReportXlsx, renderStatementXlsx } from 'src/documents/render/xlsx';
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
// @react-pdf/renderer is ESM-only (Jest can't load it); the renderers have their own spec.
jest.mock('src/documents/render/pdf', () => ({ renderStatementPdf: jest.fn(), renderReportPdf: jest.fn() }));
jest.mock('src/documents/render/xlsx', () => ({ renderStatementXlsx: jest.fn(), renderReportXlsx: jest.fn() }));
jest.mock('src/documents/protect', () => ({
  ...jest.requireActual('src/documents/protect'),
  protectDocument: jest.fn(async (body: Buffer) => Buffer.concat([body, Buffer.from('+locked')])),
}));

const dec = (n: number | string) => new Prisma.Decimal(n);
const NOW = new Date('2026-10-01T09:00:00Z');
const RENDERED = Buffer.from('rendered');

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
    customer: { findMany: jest.Mock };
    loan: { findMany: jest.Mock };
    commodityLoan: { findMany: jest.Mock };
    paymentInflow: { findMany: jest.Mock };
    organization: { findUnique: jest.Mock };
  };
  const documents = { deliver: jest.fn() };
  const customerReports = { build: jest.fn() };
  const variations = { preview: jest.fn(), buildWorkbook: jest.fn(), generate: jest.fn() };
  const mail = { sendLoanScheduleReport: jest.fn() };
  const inapp = { messageUser: jest.fn() };
  const clock = { now: () => NOW };
  let reports: GenerateReports;

  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      loan: { findMany: jest.fn().mockResolvedValue([]) },
      commodityLoan: { findMany: jest.fn().mockResolvedValue([]) },
      paymentInflow: { findMany: jest.fn().mockResolvedValue([]) },
      organization: { findUnique: jest.fn().mockResolvedValue({ name: 'NPF' }) },
    };
    (loanFiguresMany as jest.Mock).mockResolvedValue(new Map());
    (repaymentRates as jest.Mock).mockResolvedValue(new Map());
    for (const render of [renderStatementPdf, renderReportPdf]) (render as jest.Mock).mockResolvedValue(RENDERED);
    for (const render of [renderStatementXlsx, renderReportXlsx]) (render as jest.Mock).mockReturnValue(RENDERED);
    reports = new GenerateReports(
      prisma as never,
      documents as never,
      customerReports as never,
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
    const report = {
      audience: 'admin',
      generatedAt: new Date('2026-10-05T12:57:52Z'),
      range: { from: '2026-06', to: '2026-10', fromLabel: 'JUNE 2026', toLabel: 'OCTOBER 2026' },
      customer: { id: 'MB-1', name: 'Ada Obi', externalId: '001234' },
      statement: { lines: [{}, {}] },
    };

    beforeEach(() => customerReports.build.mockResolvedValue(report));

    const cases = [
      ['statement', 'pdf', renderStatementPdf, 'application/pdf', 'ADA OBI_MB-1_20261005135752_statement.pdf'],
      ['statement', 'xlsx', renderStatementXlsx, XLSX_MIME, 'ADA OBI_MB-1_20261005135752_statement.xlsx'],
      ['report', 'pdf', renderReportPdf, 'application/pdf', 'ADA OBI_MB-1_20261005135752_report.pdf'],
      ['report', 'xlsx', renderReportXlsx, XLSX_MIME, 'ADA OBI_MB-1_20261005135752_report.xlsx'],
    ] as const;

    it.each(cases)('renders a %s as %s and delivers it to the requester', async (kind, format, render, contentType, fileName) => {
      await reports.customerReport(
        job(ReportQueueName.customer_report, {
          customerId: 'MB-1',
          email: 'admin@microbuilt.com',
          requestedById: 'AD-1',
          audience: 'admin' as const,
          kind,
          format,
          from: '2026-06',
        }),
      );

      expect(customerReports.build).toHaveBeenCalledWith('MB-1', 'admin', { from: '2026-06', to: undefined });
      expect(render).toHaveBeenCalledWith(report);
      for (const other of [renderStatementPdf, renderStatementXlsx, renderReportPdf, renderReportXlsx]) {
        if (other !== render) expect(other).not.toHaveBeenCalled();
      }
      const what = kind === 'statement' ? 'Statement' : 'Loan report';
      expect(documents.deliver).toHaveBeenCalledWith({
        userId: 'AD-1',
        email: 'admin@microbuilt.com',
        title: `${what} for Ada Obi is ready`,
        message: `Ada Obi's ${what.toLowerCase()} for JUNE 2026 – OCTOBER 2026 is ready to download. The link works for 7 days.`,
        fileName,
        contentType,
        body: RENDERED,
      });
    });

    it("gives the customer's own copy to the customer, in-app only when there's no email", async () => {
      customerReports.build.mockResolvedValue({
        ...report,
        audience: 'customer',
        customer: { ...report.customer, externalId: null },
      });

      await reports.customerReport(
        job(ReportQueueName.customer_report, {
          customerId: 'MB-1',
          audience: 'customer' as const,
          kind: 'statement' as const,
          format: 'pdf' as const,
          from: '2026-07',
          to: '2026-08',
        }),
      );

      expect(customerReports.build).toHaveBeenCalledWith('MB-1', 'customer', { from: '2026-07', to: '2026-08' });
      expect(documents.deliver).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'MB-1',
          email: undefined,
          title: 'Your statement is ready',
          fileName: 'ADA OBI_MB-1_20261005135752_statement.pdf',
          message: expect.stringContaining('open it with your customer ID'),
          body: Buffer.concat([RENDERED, Buffer.from('+locked')]),
        }),
      );
      // The password is the customer ID, and it is never written in the message.
      expect(protectDocument).toHaveBeenCalledWith(RENDERED, 'pdf', 'MB-1');
      expect(documents.deliver.mock.calls[0][0].message).not.toContain('MB-1');
    });

    it('treats a customer asking for their own copy as the customer (their id is the requester)', async () => {
      customerReports.build.mockResolvedValue({ ...report, audience: 'customer' });
      await reports.customerReport(
        job(ReportQueueName.customer_report, {
          customerId: 'MB-1',
          requestedById: 'MB-1',
          audience: 'customer' as const,
          kind: 'report' as const,
          format: 'xlsx' as const,
        }),
      );
      expect(documents.deliver).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'MB-1', title: 'Your loan report is ready' }),
      );
      expect(protectDocument).toHaveBeenCalledWith(RENDERED, 'xlsx', 'MB-1');
    });

    it("protects an admin's copy only when asked, naming whose ID opens it", async () => {
      await reports.customerReport(
        job(ReportQueueName.customer_report, {
          customerId: 'MB-1',
          requestedById: 'AD-1',
          audience: 'admin' as const,
          kind: 'statement' as const,
          format: 'pdf' as const,
          protect: true,
        }),
      );
      expect(documents.deliver.mock.calls[0][0].message).toContain("opens with Ada Obi's customer ID");
      expect(documents.deliver.mock.calls[0][0].message).not.toContain('MB-1');
    });

    it('treats a job queued before Stage 6 (no kind or format) as a statement spreadsheet', async () => {
      await reports.customerReport(
        job(ReportQueueName.customer_report, { customerId: 'MB-1', audience: 'admin', requestedById: 'AD-1' } as never),
      );
      expect(renderStatementXlsx).toHaveBeenCalledWith(report);
      expect(documents.deliver).toHaveBeenCalledWith(expect.objectContaining({ contentType: XLSX_MIME }));
    });

    it('delivers nothing when the report cannot be built', async () => {
      customerReports.build.mockRejectedValue(new Error('Customer not found'));
      await expect(
        reports.customerReport(
          job(ReportQueueName.customer_report, {
            customerId: 'MB-X',
            audience: 'admin' as const,
            kind: 'report' as const,
            format: 'pdf' as const,
          }),
        ),
      ).rejects.toThrow('Customer not found');
      expect(documents.deliver).not.toHaveBeenCalled();
    });
  });

  describe('variation_generate', () => {
    const data = { organizationId: 'ORG-1', period: '2026-10', requestedById: 'AD-1' };
    const generated = {
      variationId: 'V-1',
      organizationId: 'ORG-1',
      organization: 'NPF',
      period: 'OCTOBER 2026',
      ym: '2026-10',
      version: 2,
      filePath: 'ORG-1/2026-10/v2.xlsx',
      rows: 3,
      counts: { START: 1, AMEND: 1, STOP: 1 },
      frozen: 40,
      amount: dec('52500.5'),
    };

    it("generates the organization's month and tells the requester in-app what went into the file", async () => {
      variations.generate.mockResolvedValue(generated);

      await expect(reports.variationGenerate(job(ReportQueueName.variation_generate, data))).resolves.toEqual({
        variationId: 'V-1',
        organizationId: 'ORG-1',
        period: '2026-10',
        version: 2,
        rows: 3,
        frozen: 40,
      });

      expect(variations.generate).toHaveBeenCalledWith('ORG-1', { year: 2026, month: 'OCTOBER' }, 'AD-1');
      expect(inapp.messageUser).toHaveBeenCalledWith({
        userId: 'AD-1',
        title: 'NPF OCTOBER 2026 variation generated',
        message: expect.stringContaining('Version 2: 3 changes (1 start, 1 amend, 1 stop) totalling ₦52,500.50.'),
        callToActionUrl: expect.any(String),
      });
      expect(inapp.messageUser.mock.calls[0][0].message).toContain('40 deductions are frozen');
    });

    it('says when nothing changed and the file has only its header row', async () => {
      variations.generate.mockResolvedValue({
        ...generated,
        rows: 0,
        counts: { START: 0, AMEND: 0, STOP: 0 },
        amount: dec(0),
      });
      await reports.variationGenerate(job(ReportQueueName.variation_generate, data));
      expect(inapp.messageUser.mock.calls[0][0].message).toContain(
        'Nothing changed, so the file has only its header row.',
      );
    });

    it('is still done when the requester could not be told', async () => {
      variations.generate.mockResolvedValue(generated);
      inapp.messageUser.mockRejectedValueOnce(new Error('db down'));
      await expect(reports.variationGenerate(job(ReportQueueName.variation_generate, data))).resolves.toMatchObject({
        version: 2,
      });
      expect(captureJobError).toHaveBeenCalledTimes(1);
    });

    it('lets a failed generation fail the job, with no notification yet', async () => {
      variations.generate.mockRejectedValue(new ConflictException('nope'));
      await expect(reports.variationGenerate(job(ReportQueueName.variation_generate, data))).rejects.toThrow('nope');
      expect(inapp.messageUser).not.toHaveBeenCalled();
    });
  });

  describe('variation_draft', () => {
    it("emails the draft workbook of the organization's month with its count and total", async () => {
      const rows = [{ amount: dec('25000.50') }, { amount: dec(0) }, { amount: dec(10_000) }];
      variations.preview.mockResolvedValue({
        organization: { id: 'ORG-1', name: 'NPF' },
        period: { label: 'JUNE 2026' },
        rows,
      });
      const file = Buffer.from('xlsx');
      variations.buildWorkbook.mockReturnValue(file);

      await reports.variationDraft(
        job(ReportQueueName.variation_draft, {
          organizationId: 'ORG-1',
          period: '2026-06',
          email: 'payroll@example.com',
          requestedById: 'AD-1',
        }),
      );

      expect(variations.preview).toHaveBeenCalledWith('ORG-1', { year: 2026, month: 'JUNE' });
      expect(variations.buildWorkbook).toHaveBeenCalledWith(rows);
      // The mailer names the subject, the body and the attachment after the period: the organization goes in it.
      expect(mail.sendLoanScheduleReport).toHaveBeenCalledWith(
        'payroll@example.com',
        { period: 'JUNE 2026 (NPF)', len: 3, amount: 35_000.5, draft: true },
        file,
      );
    });

    it("keeps what a file name can't carry out of the attachment name", async () => {
      variations.preview.mockResolvedValue({
        organization: { id: 'ORG-2', name: 'Police/Customs: North' },
        period: { label: 'JUNE 2026' },
        rows: [],
      });
      variations.buildWorkbook.mockReturnValue(Buffer.from('xlsx'));
      await reports.variationDraft(
        job(ReportQueueName.variation_draft, { organizationId: 'ORG-2', period: '2026-06', email: 'p@example.com', requestedById: 'AD-1' }),
      );
      expect(mail.sendLoanScheduleReport.mock.calls[0][1].period).toBe('JUNE 2026 (Police Customs North)');
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
      await reports.onFailed(job(ReportQueueName.customer_report, { customerId: 'MB-1', kind: 'report' as const }), error);
      await reports.onFailed(
        job(ReportQueueName.customer_report, { customerId: 'MB-1', requestedById: 'AD-1', kind: 'statement' as const }),
        error,
      );
      await reports.onFailed(
        job(ReportQueueName.variation_draft, { organizationId: 'ORG-1', period: '2026-06', requestedById: 'AD-2' }),
        error,
      );
      expect(inapp.messageUser.mock.calls.map(([m]) => [m.userId, m.title])).toEqual([
        ['MB-1', "Your loan report couldn't be made"],
        ['AD-1', "Your statement couldn't be made"],
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

    describe('a failed generation', () => {
      const data = { organizationId: 'ORG-1', period: '2026-10', requestedById: 'AD-1' };

      it('tells the requester why it was refused, and leaves Sentry out of it', async () => {
        const refusal = new ConflictException(
          "NPF's NOVEMBER 2026 variation already exists, so OCTOBER 2026 can't change any more",
        );
        await reports.onFailed(job(ReportQueueName.variation_generate, data), refusal);
        expect(captureJobError).not.toHaveBeenCalled();
        expect(inapp.messageUser).toHaveBeenCalledWith({
          userId: 'AD-1',
          title: "NPF OCTOBER 2026 variation wasn't generated",
          message: refusal.message,
          callToActionUrl: expect.any(String),
        });
      });

      it('reports any other failure, and tells the requester it can be tried again', async () => {
        await reports.onFailed(job(ReportQueueName.variation_generate, data), error);
        expect(captureJobError).toHaveBeenCalledWith(error, {
          queue: 'reports',
          job: ReportQueueName.variation_generate,
          jobId: 7,
        });
        const [notice] = inapp.messageUser.mock.calls[0];
        expect(notice).toMatchObject({ userId: 'AD-1', title: "NPF OCTOBER 2026 variation wasn't generated" });
        expect(notice.message).toContain('generate it again');
      });

      it("still tells them when the organization can't be read", async () => {
        prisma.organization.findUnique.mockReturnValue(Promise.reject(new Error('db down')));
        await reports.onFailed(job(ReportQueueName.variation_generate, data), error);
        expect(inapp.messageUser.mock.calls[0][0].title).toBe("OCTOBER 2026 variation wasn't generated");
      });

      it('waits for the last attempt before telling anyone', async () => {
        await reports.onFailed(job(ReportQueueName.variation_generate, data, { made: 1, max: 2 }), error);
        expect(inapp.messageUser).not.toHaveBeenCalled();
      });
    });
  });
});
