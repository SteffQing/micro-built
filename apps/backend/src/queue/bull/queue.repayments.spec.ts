import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Job } from 'bull';
import type { PayrollUploadJob } from 'src/common/types/queue.interface';
import { money } from 'src/ledger/money';
import * as XLSX from 'xlsx';
import { RepaymentsConsumer } from './queue.repayments';

jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));

// The payroll-row decision table (V2.MD §0.5): duplicate, UNMATCHED, REVIEWING (no loan, no
// deduction, overpayment), SETTLED; plus the CustomerPayroll update. Prisma and the ledger are mocks.

const HEADER = ['Staff ID', 'Amount', 'Full Name', 'Period', 'MDA', 'Grade', 'Step', 'Command', 'Employee Gross', 'Net Pay'];

interface World {
  /** staffId → customer id */
  customers?: Record<string, string>;
  /** customer id → DISBURSED loan id */
  loans?: Record<string, string>;
  /** loan id → AWAITING/PARTIAL deduction id for the upload's month */
  deductions?: Record<string, string>;
  /** loan id → what allocatePayment applies (and leaves over), or the error it throws */
  allocations?: Record<string, { applied: number; unapplied: number } | Error>;
  /** staff IDs whose row for the month is already imported */
  imported?: string[];
}

function payrollSheet(rows: unknown[][]): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ...rows]), 'Payroll');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function buildConsumer(rows: unknown[][], world: World = {}) {
  const tx = {
    paymentInflow: {
      create: jest.fn(async ({ data }: { data: { externalUserId: string } }) => {
        if (world.imported?.includes(data.externalUserId)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '6',
          });
        }
        return { id: `IN-${data.externalUserId}` };
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    customerPayroll: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    loan: {
      findFirst: jest.fn(async ({ where }: { where: { borrowerId: string } }) => {
        const id = world.loans?.[where.borrowerId];
        return id ? { id } : null;
      }),
    },
    deduction: {
      findFirst: jest.fn(async ({ where }: { where: { loanId: string } }) => {
        const id = world.deductions?.[where.loanId];
        return id ? { id } : null;
      }),
    },
  };
  const prisma = {
    payrollUpload: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'UP-1',
        fileHash: 'abc',
        periodId: 'P-JUN',
        uploadedById: 'AD-1',
        period: { year: 2026, month: 'JUNE' },
      }),
    },
    customer: {
      findMany: jest.fn(async ({ where }: { where: { externalId: { in: string[] } } }) =>
        where.externalId.in
          .filter((staffId) => world.customers?.[staffId])
          .map((staffId) => ({ userId: world.customers![staffId], externalId: staffId })),
      ),
    },
  };
  const supabase = { downloadPrivate: jest.fn().mockResolvedValue(payrollSheet(rows)) };
  const ledgerTx = { transaction: jest.fn((work: (t: typeof tx) => Promise<unknown>) => work(tx)) };
  const ledger = {
    allocatePayment: jest.fn(async ({ loanId }: { loanId: string }) => {
      const result = world.allocations?.[loanId] ?? { applied: 0, unapplied: 0 };
      if (result instanceof Error) throw result;
      return { applied: money(result.applied), unapplied: money(result.unapplied) };
    }),
  };
  const notifier = { notify: jest.fn().mockResolvedValue(undefined) };
  const inapp = { messageUser: jest.fn().mockResolvedValue(undefined) };
  const consumer = new RepaymentsConsumer(
    prisma as never,
    supabase as never,
    ledgerTx as never,
    ledger as never,
    notifier as never,
    inapp as never,
  );
  const job = {
    id: 'J-1',
    name: 'process_payroll_upload',
    data: { uploadId: 'UP-1' },
    progress: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job<PayrollUploadJob>;
  return { consumer, job, tx, prisma, supabase, ledgerTx, ledger, notifier, inapp };
}

const row = (staffId: string, amount: number | string, extra: unknown[] = []) => [
  staffId,
  amount,
  'Ada Obi',
  'JUNE 2026',
  'NAVY',
  ...extra,
];

beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
beforeAll(() => jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined));

describe('RepaymentsConsumer: the payroll-row decision table', () => {
  it('UNMATCHED: no customer has the staff ID', async () => {
    const { consumer, job, tx, ledger, notifier } = buildConsumer([row('999', 50000)]);

    const summary = await consumer.processUpload(job);

    expect(tx.paymentInflow.create).toHaveBeenCalledWith({
      data: {
        source: 'PAYROLL',
        periodId: 'P-JUN',
        uploadId: 'UP-1',
        amount: money(50000),
        externalUserId: '999',
        customerId: null,
        state: 'UNMATCHED',
      },
      select: { id: true },
    });
    expect(tx.customerPayroll.updateMany).not.toHaveBeenCalled();
    expect(ledger.allocatePayment).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ unmatched: 1, settled: 0, reviewing: 0 });
  });

  it('REVIEWING: the customer has no DISBURSED loan', async () => {
    const { consumer, job, tx, ledger } = buildConsumer([row('111', 50000)], { customers: { '111': 'MB-1' } });

    const summary = await consumer.processUpload(job);

    expect(tx.paymentInflow.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'MB-1', state: 'REVIEWING' }) }),
    );
    expect(tx.loan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { borrowerId: 'MB-1', status: 'DISBURSED' } }),
    );
    expect(ledger.allocatePayment).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ reviewing: 1 });
  });

  it("REVIEWING: the loan has no AWAITING/PARTIAL deduction in the upload's month", async () => {
    const { consumer, job, tx, ledger } = buildConsumer([row('111', 50000)], {
      customers: { '111': 'MB-1' },
      loans: { 'MB-1': 'LN-1' },
    });

    const summary = await consumer.processUpload(job);

    expect(tx.deduction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { loanId: 'LN-1', periodId: 'P-JUN', status: { in: ['AWAITING', 'PARTIAL'] } } }),
    );
    expect(ledger.allocatePayment).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ reviewing: 1 });
  });

  it('SETTLED: the payment is allocated against the deduction in the same transaction', async () => {
    const { consumer, job, tx, ledger, notifier } = buildConsumer([row('111', 50000)], {
      customers: { '111': 'MB-1' },
      loans: { 'MB-1': 'LN-1' },
      deductions: { 'LN-1': 'D-1' },
      allocations: { 'LN-1': { applied: 50000, unapplied: 0 } },
    });

    const summary = await consumer.processUpload(job);

    expect(ledger.allocatePayment).toHaveBeenCalledWith(
      { loanId: 'LN-1', amount: money(50000), inflowId: 'IN-111', deductionId: 'D-1' },
      tx,
    );
    expect(tx.paymentInflow.update).toHaveBeenCalledWith({ where: { id: 'IN-111' }, data: { state: 'SETTLED' } });
    expect(notifier.notify).toHaveBeenCalledWith('MB-1', {
      title: 'Repayment Received',
      message: expect.stringContaining('for JUNE 2026 has been received and applied to your loan'),
    });
    expect(summary).toMatchObject({ settled: 1, reviewing: 0 });
  });

  it('overpayment: what could not be applied leaves the inflow REVIEWING for a refund', async () => {
    const { consumer, job, tx, notifier } = buildConsumer([row('111', 60000)], {
      customers: { '111': 'MB-1' },
      loans: { 'MB-1': 'LN-1' },
      deductions: { 'LN-1': 'D-1' },
      allocations: { 'LN-1': { applied: 45000, unapplied: 15000 } },
    });

    const summary = await consumer.processUpload(job);

    expect(tx.paymentInflow.update).toHaveBeenCalledWith({ where: { id: 'IN-111' }, data: { state: 'REVIEWING' } });
    const [, notice] = notifier.notify.mock.calls[0] as [string, { message: string }];
    expect(notice.message).toMatch(/more than you owed was deducted; we will contact you about a refund/);
    expect(summary).toMatchObject({ reviewing: 1, settled: 0 });
  });

  it("duplicate: the employee's row for the month is already imported (P2002) and is skipped", async () => {
    const { consumer, job, ledger, notifier } = buildConsumer([row('111', 50000)], {
      customers: { '111': 'MB-1' },
      loans: { 'MB-1': 'LN-1' },
      deductions: { 'LN-1': 'D-1' },
      imported: ['111'],
    });

    const summary = await consumer.processUpload(job);

    expect(ledger.allocatePayment).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ duplicate: 1, failed: 0 });
  });

  it('records nothing for a row with nothing deducted', async () => {
    const { consumer, job, tx } = buildConsumer([row('111', 0)], { customers: { '111': 'MB-1' } });

    const summary = await consumer.processUpload(job);

    expect(tx.paymentInflow.create).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ skipped: 1 });
  });
});

describe('RepaymentsConsumer: CustomerPayroll from the row', () => {
  it('updates only the values the sheet has (non-empty / > 0), never the organization', async () => {
    const { consumer, job, tx } = buildConsumer([row('111', 50000, ['GL 08', '', '', 250000, 0])], {
      customers: { '111': 'MB-1' },
    });

    await consumer.processUpload(job);

    expect(tx.customerPayroll.updateMany).toHaveBeenCalledWith({
      where: { externalId: '111' },
      data: { grade: 'GL 08', employeeGross: money(250000) },
    });
  });
});

describe('RepaymentsConsumer: the job', () => {
  const world: World = {
    customers: { '111': 'MB-1', '222': 'MB-2', '333': 'MB-3' },
    loans: { 'MB-1': 'LN-1', 'MB-3': 'LN-3' },
    deductions: { 'LN-1': 'D-1', 'LN-3': 'D-3' },
    allocations: { 'LN-1': { applied: 50000, unapplied: 0 }, 'LN-3': new Error('database went away') },
    imported: ['444'],
  };
  const rows = [row('111', 50000), row('222', 40000), row('333', 30000), row('444', 20000), row('999', 10000)];

  it('reads the stored sheet of the upload', async () => {
    const { consumer, job, supabase } = buildConsumer(rows, world);
    await consumer.processUpload(job);
    expect(supabase.downloadPrivate).toHaveBeenCalledWith('payroll-uploads', '2026-06/abc.xlsx');
  });

  it('counts a row that throws as failed, reports it, and carries on with the rest', async () => {
    const { captureJobError } = jest.requireMock<{ captureJobError: jest.Mock }>('src/common/observability');
    captureJobError.mockClear();
    const { consumer, job, ledgerTx } = buildConsumer(rows, world);

    const summary = await consumer.processUpload(job);

    expect(ledgerTx.transaction).toHaveBeenCalledTimes(5);
    expect(summary).toEqual({
      uploadId: 'UP-1',
      period: 'JUNE 2026',
      rows: 5,
      settled: 1,
      reviewing: 1,
      unmatched: 1,
      duplicate: 1,
      failed: 1,
      skipped: 0,
    });
    expect(captureJobError).toHaveBeenCalledTimes(1);
    expect(captureJobError).toHaveBeenCalledWith(expect.any(Error), {
      queue: 'repayments',
      job: 'process_payroll_upload',
      jobId: 'J-1',
    });
  });

  it('notifies only customers whose payment was applied, and sends the uploader a summary', async () => {
    const { consumer, job, notifier, inapp } = buildConsumer(rows, world);

    await consumer.processUpload(job);

    expect(notifier.notify).toHaveBeenCalledTimes(1);
    expect(notifier.notify).toHaveBeenCalledWith('MB-1', expect.objectContaining({ title: 'Repayment Received' }));
    expect(inapp.messageUser).toHaveBeenCalledWith({
      userId: 'AD-1',
      title: 'Payroll Upload Processed With Errors',
      message: expect.stringContaining(
        'The JUNE 2026 payroll (5 rows) is processed: 1 settled, 1 for review, 1 unmatched, 1 already imported, 1 failed.',
      ),
      callToActionUrl: '/repayments?tab=inflows&upload=UP-1',
    });
  });

  it('is safe to run again: every row already in is a duplicate', async () => {
    const { consumer, job, ledger, notifier } = buildConsumer([row('111', 50000), row('999', 10000)], {
      ...world,
      imported: ['111', '999'],
    });

    const summary = await consumer.processUpload(job);

    expect(summary).toMatchObject({ duplicate: 2, settled: 0, unmatched: 0 });
    expect(ledger.allocatePayment).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('fails the job when the upload is gone', async () => {
    const { consumer, job, prisma, supabase } = buildConsumer(rows, world);
    prisma.payrollUpload.findUnique.mockResolvedValue(null);
    await expect(consumer.processUpload(job)).rejects.toThrow('Payroll upload UP-1 not found');
    expect(supabase.downloadPrivate).not.toHaveBeenCalled();
  });

  it('reports a failed job and tells the uploader', async () => {
    const { captureJobError } = jest.requireMock<{ captureJobError: jest.Mock }>('src/common/observability');
    captureJobError.mockClear();
    const { consumer, job, inapp } = buildConsumer(rows, world);
    const error = new Error('storage unavailable');

    await consumer.onFailed(job, error);

    expect(captureJobError).toHaveBeenCalledWith(error, { queue: 'repayments', job: 'process_payroll_upload', jobId: 'J-1' });
    expect(inapp.messageUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'AD-1', title: 'Payroll Upload Failed' }),
    );
  });
});
