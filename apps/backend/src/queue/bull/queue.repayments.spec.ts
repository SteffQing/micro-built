import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Job } from 'bull';
import type { VoucherJob } from 'src/common/types/queue.interface';
import { money } from 'src/ledger/money';
import * as XLSX from 'xlsx';
import { RepaymentsConsumer } from './queue.repayments';

jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));

// The voucher-row decision table (PLAN_V2 R4): duplicate, UNMATCHED, REVIEWING (no deduction in the variation, another
// organization, overpayment), SETTLED; the CustomerPayroll update; then the settling of the variation. Prisma and the
// ledger are mocks.

const HEADER = ['Staff ID', 'Amount', 'Full Name', 'Period', 'MDA', 'Grade', 'Step', 'Command', 'Employee Gross', 'Net Pay'];

interface World {
  /** staffId → the customer with it, and their payroll organization */
  customers?: Record<string, { id: string; organizationId: string | null }>;
  /** customer id → the AWAITING/PARTIAL deduction of their running loan in the voucher's variation */
  deductions?: Record<string, { id: string; loanId: string }>;
  /** loan id → what allocatePayment applies (and leaves over), or the error it throws */
  allocations?: Record<string, { applied: number; unapplied: number } | Error>;
  /** staff IDs whose row for the month is already imported */
  imported?: string[];
}

const SETTLEMENT = { variationId: 'VAR-1', label: 'NPF · JUNE 2026', settled: true, cleared: 0, failed: 2, partial: 1, penalties: 3, penaltyTotal: 4500, proposals: 1, errors: [] };

function voucherSheet(rows: unknown[][]): Buffer {
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
    deduction: {
      findFirst: jest.fn(async ({ where }: { where: { loan: { borrowerId: string } } }) => {
        return world.deductions?.[where.loan.borrowerId] ?? null;
      }),
    },
  };
  const prisma = {
    voucher: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'VC-1',
        fileHash: 'abc',
        filename: 'june.xlsx',
        uploadedById: 'AD-1',
        variation: {
          id: 'VAR-1',
          periodId: 'P-JUN',
          organizationId: 'ORG-NPF',
          organization: { name: 'NPF' },
          period: { year: 2026, month: 'JUNE' },
        },
      }),
    },
    customer: {
      findMany: jest.fn(async ({ where }: { where: { externalId: { in: string[] } } }) =>
        where.externalId.in
          .filter((staffId) => world.customers?.[staffId])
          .map((staffId) => ({
            userId: world.customers![staffId].id,
            externalId: staffId,
            payroll: { organizationId: world.customers![staffId].organizationId },
          })),
      ),
    },
    auditLog: { findFirst: jest.fn().mockResolvedValue(null) },
    paymentInflow: {
      groupBy: jest.fn().mockResolvedValue([
        { state: 'SETTLED', _count: 3 },
        { state: 'REVIEWING', _count: 1 },
        { state: 'UNMATCHED', _count: 1 },
      ]),
    },
  };
  const supabase = { downloadPrivate: jest.fn().mockResolvedValue(voucherSheet(rows)) };
  const ledgerTx = {
    transaction: jest.fn((work: (t: typeof tx) => Promise<unknown>) => work(tx)),
    audit: jest.fn().mockResolvedValue(undefined),
  };
  const ledger = {
    allocatePayment: jest.fn(async ({ loanId }: { loanId: string }) => {
      const result = world.allocations?.[loanId] ?? { applied: 0, unapplied: 0 };
      if (result instanceof Error) throw result;
      return { applied: money(result.applied), unapplied: money(result.unapplied) };
    }),
  };
  const locks = {
    settleVariation: jest.fn().mockResolvedValue(SETTLEMENT),
    afterLock: jest.fn().mockResolvedValue({ errors: [] }),
  };
  const notifier = { notify: jest.fn().mockResolvedValue(undefined) };
  const inapp = { messageUser: jest.fn().mockResolvedValue(undefined) };
  const consumer = new RepaymentsConsumer(
    prisma as never,
    supabase as never,
    ledgerTx as never,
    ledger as never,
    locks as never,
    notifier as never,
    inapp as never,
  );
  const job = {
    id: 'J-1',
    name: 'process_voucher',
    data: { voucherId: 'VC-1' },
    progress: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job<VoucherJob>;
  return { consumer, job, tx, prisma, supabase, ledgerTx, ledger, locks, notifier, inapp };
}

const row = (staffId: string, amount: number | string, extra: unknown[] = []) => [
  staffId,
  amount,
  'Ada Obi',
  'JUNE 2026',
  'NAVY',
  ...extra,
];

const NPF = 'ORG-NPF';

beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
beforeAll(() => jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined));

describe('RepaymentsConsumer: the voucher-row decision table', () => {
  it('UNMATCHED: no customer has the staff ID', async () => {
    const { consumer, job, tx, ledger, notifier } = buildConsumer([row('999', 50000)]);

    const summary = await consumer.processVoucher(job);

    expect(tx.paymentInflow.create).toHaveBeenCalledWith({
      data: {
        source: 'PAYROLL',
        periodId: 'P-JUN',
        voucherId: 'VC-1',
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

  it("REVIEWING: the customer has no deduction waiting in the voucher's variation", async () => {
    const { consumer, job, tx, ledger } = buildConsumer([row('111', 50000)], {
      customers: { '111': { id: 'MB-1', organizationId: NPF } },
    });

    const summary = await consumer.processVoucher(job);

    expect(tx.paymentInflow.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'MB-1', state: 'REVIEWING' }) }),
    );
    expect(tx.deduction.findFirst).toHaveBeenCalledWith({
      where: { variationId: 'VAR-1', status: { in: ['AWAITING', 'PARTIAL'] }, loan: { borrowerId: 'MB-1', status: 'DISBURSED' } },
      select: { id: true, loanId: true },
    });
    expect(ledger.allocatePayment).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ reviewing: 1 });
  });

  it('REVIEWING: a customer of another organization is left alone, details included', async () => {
    const { consumer, job, tx, ledger } = buildConsumer([row('111', 50000, ['GL 08', '', '', 250000, 180000])], {
      customers: { '111': { id: 'MB-1', organizationId: 'ORG-NAVY' } },
    });

    const summary = await consumer.processVoucher(job);

    expect(ledger.allocatePayment).not.toHaveBeenCalled();
    expect(tx.customerPayroll.updateMany).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ reviewing: 1, settled: 0 });
  });

  it('SETTLED: the payment is allocated against the deduction in the same transaction', async () => {
    const { consumer, job, tx, ledger, notifier } = buildConsumer([row('111', 50000)], {
      customers: { '111': { id: 'MB-1', organizationId: NPF } },
      deductions: { 'MB-1': { id: 'D-1', loanId: 'LN-1' } },
      allocations: { 'LN-1': { applied: 50000, unapplied: 0 } },
    });

    const summary = await consumer.processVoucher(job);

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

  it('a customer who moved organization after the variation was generated is still paid its deduction', async () => {
    const { consumer, job, tx, ledger } = buildConsumer([row('111', 50000, ['GL 08'])], {
      customers: { '111': { id: 'MB-1', organizationId: 'ORG-NAVY' } },
      deductions: { 'MB-1': { id: 'D-1', loanId: 'LN-1' } },
      allocations: { 'LN-1': { applied: 50000, unapplied: 0 } },
    });

    const summary = await consumer.processVoucher(job);

    expect(ledger.allocatePayment).toHaveBeenCalledTimes(1);
    expect(tx.customerPayroll.updateMany).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ settled: 1 });
  });

  it('overpayment: what could not be applied leaves the inflow REVIEWING for a refund', async () => {
    const { consumer, job, tx, notifier } = buildConsumer([row('111', 60000)], {
      customers: { '111': { id: 'MB-1', organizationId: NPF } },
      deductions: { 'MB-1': { id: 'D-1', loanId: 'LN-1' } },
      allocations: { 'LN-1': { applied: 45000, unapplied: 15000 } },
    });

    const summary = await consumer.processVoucher(job);

    expect(tx.paymentInflow.update).toHaveBeenCalledWith({ where: { id: 'IN-111' }, data: { state: 'REVIEWING' } });
    const [, notice] = notifier.notify.mock.calls[0] as [string, { message: string }];
    expect(notice.message).toMatch(/more than you owed was deducted; we will contact you about a refund/);
    expect(summary).toMatchObject({ reviewing: 1, settled: 0 });
  });

  it("duplicate: the employee's row for the month is already imported (P2002) and is skipped", async () => {
    const { consumer, job, ledger, notifier } = buildConsumer([row('111', 50000)], {
      customers: { '111': { id: 'MB-1', organizationId: NPF } },
      deductions: { 'MB-1': { id: 'D-1', loanId: 'LN-1' } },
      imported: ['111'],
    });

    const summary = await consumer.processVoucher(job);

    expect(ledger.allocatePayment).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ duplicate: 1, failed: 0 });
  });

  it('records nothing for a row with nothing deducted', async () => {
    const { consumer, job, tx } = buildConsumer([row('111', 0)], {
      customers: { '111': { id: 'MB-1', organizationId: NPF } },
    });

    const summary = await consumer.processVoucher(job);

    expect(tx.paymentInflow.create).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ skipped: 1 });
  });
});

describe('RepaymentsConsumer: CustomerPayroll from the row', () => {
  it("updates only the values the sheet has (non-empty / > 0), never the organization, for the organization's own customers", async () => {
    const { consumer, job, tx } = buildConsumer([row('111', 50000, ['GL 08', '', '', 250000, 0])], {
      customers: { '111': { id: 'MB-1', organizationId: NPF } },
    });

    await consumer.processVoucher(job);

    expect(tx.customerPayroll.updateMany).toHaveBeenCalledWith({
      where: { externalId: '111' },
      data: { grade: 'GL 08', employeeGross: money(250000) },
    });
  });
});

describe('RepaymentsConsumer: the job', () => {
  const world: World = {
    customers: {
      '111': { id: 'MB-1', organizationId: NPF },
      '222': { id: 'MB-2', organizationId: NPF },
      '333': { id: 'MB-3', organizationId: NPF },
    },
    deductions: { 'MB-1': { id: 'D-1', loanId: 'LN-1' }, 'MB-3': { id: 'D-3', loanId: 'LN-3' } },
    allocations: { 'LN-1': { applied: 50000, unapplied: 0 }, 'LN-3': new Error('database went away') },
    imported: ['444'],
  };
  const rows = [row('111', 50000), row('222', 40000), row('333', 30000), row('444', 20000), row('999', 10000)];

  it('reads the stored sheet of the voucher', async () => {
    const { consumer, job, supabase } = buildConsumer(rows, world);
    await consumer.processVoucher(job);
    expect(supabase.downloadPrivate).toHaveBeenCalledWith('payroll-uploads', '2026-06/abc.xlsx');
  });

  it('counts a row that throws as failed, reports it, and carries on with the rest', async () => {
    const { captureJobError } = jest.requireMock<{ captureJobError: jest.Mock }>('src/common/observability');
    captureJobError.mockClear();
    const { consumer, job } = buildConsumer(rows, world);

    const summary = await consumer.processVoucher(job);

    expect(summary).toEqual({
      voucherId: 'VC-1',
      variationId: 'VAR-1',
      organization: 'NPF',
      period: 'JUNE 2026',
      rows: 5,
      settled: 1,
      reviewing: 1,
      unmatched: 1,
      duplicate: 1,
      failed: 1,
      skipped: 0,
      settlement: { settled: true, failed: 2, partial: 1, penalties: 3, penaltyTotal: 4500, proposals: 1 },
    });
    expect(captureJobError).toHaveBeenCalledTimes(1);
    expect(captureJobError).toHaveBeenCalledWith(expect.any(Error), {
      queue: 'repayments',
      job: 'process_voucher',
      jobId: 'J-1',
    });
  });

  it('settles the variation as the uploader once every row is in, then opens next month and prunes files', async () => {
    const { consumer, job, tx, locks } = buildConsumer(rows, world);
    const order: string[] = [];
    const create = tx.paymentInflow.create.getMockImplementation() as (args: never) => Promise<{ id: string }>;
    tx.paymentInflow.create.mockImplementation(async (args) => {
      order.push('row');
      return create(args as never);
    });
    locks.settleVariation.mockImplementation(async () => {
      order.push('settle');
      return SETTLEMENT;
    });
    locks.afterLock.mockImplementation(async () => {
      order.push('after');
      return { errors: [] };
    });

    await consumer.processVoucher(job);

    expect(locks.settleVariation).toHaveBeenCalledWith('VAR-1', 'AD-1');
    expect(locks.afterLock).toHaveBeenCalledWith('VAR-1');
    expect(order.lastIndexOf('row')).toBeLessThan(order.indexOf('settle'));
    expect(order.indexOf('settle')).toBeLessThan(order.indexOf('after'));
  });

  it('audits VOUCHER_UPLOADED once, with the issues the voucher left', async () => {
    const { consumer, job, ledgerTx, prisma } = buildConsumer(rows, world);

    await consumer.processVoucher(job);

    expect(ledgerTx.audit).toHaveBeenCalledTimes(1);
    expect(ledgerTx.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'AD-1',
        action: 'VOUCHER_UPLOADED',
        entityType: 'VOUCHER',
        entityId: 'VC-1',
        note: expect.stringContaining('3 settled, 1 for review, 1 unmatched, 2 deductions failed, 1 short, 3 penalties'),
        meta: expect.objectContaining({ variationId: 'VAR-1', reviewing: 1, unmatched: 1 }),
      }),
    );

    // A second run of the job (a retry) finds the entry and writes no other.
    ledgerTx.audit.mockClear();
    prisma.auditLog.findFirst.mockResolvedValue({ id: 'AU-1' });
    await consumer.processVoucher(job);
    expect(ledgerTx.audit).not.toHaveBeenCalled();
  });

  it('fails the job, with nothing audited, when the settling did not finish (a run again redoes the rest)', async () => {
    const { consumer, job, ledgerTx, locks, inapp } = buildConsumer(rows, world);
    locks.settleVariation.mockResolvedValue({ ...SETTLEMENT, settled: false, errors: [{ deductionId: 'D-9', message: 'deadlock detected' }] });

    await expect(consumer.processVoucher(job)).rejects.toThrow('1 steps of settling the variation failed: deadlock detected');

    expect(ledgerTx.audit).not.toHaveBeenCalled();
    expect(inapp.messageUser).not.toHaveBeenCalled();
  });

  it('fails the job when next month could not be opened for some loans', async () => {
    const { consumer, job, locks, ledgerTx } = buildConsumer(rows, world);
    locks.afterLock.mockResolvedValue({ errors: ['Refreshing loans LN-1…: connection reset'] });

    await expect(consumer.processVoucher(job)).rejects.toThrow('connection reset');
    expect(ledgerTx.audit).not.toHaveBeenCalled();
  });

  it('notifies only customers whose payment was applied, and sends the uploader a summary', async () => {
    const { consumer, job, notifier, inapp } = buildConsumer(rows, world);

    await consumer.processVoucher(job);

    expect(notifier.notify).toHaveBeenCalledTimes(1);
    expect(notifier.notify).toHaveBeenCalledWith('MB-1', expect.objectContaining({ title: 'Repayment Received' }));
    expect(inapp.messageUser).toHaveBeenCalledWith({
      userId: 'AD-1',
      title: 'Voucher Processed With Errors',
      message: expect.stringContaining(
        'The NPF JUNE 2026 voucher (5 rows) is processed: 1 settled, 1 for review, 1 unmatched, 1 already imported, 1 failed.',
      ),
      callToActionUrl: '/repayments?tab=inflows&voucher=VC-1',
    });
  });

  it('is safe to run again: every row already in is a duplicate', async () => {
    const { consumer, job, ledger, notifier } = buildConsumer([row('111', 50000), row('999', 10000)], {
      ...world,
      imported: ['111', '999'],
    });

    const summary = await consumer.processVoucher(job);

    expect(summary).toMatchObject({ duplicate: 2, settled: 0, unmatched: 0 });
    expect(ledger.allocatePayment).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('fails the job when the voucher is gone', async () => {
    const { consumer, job, prisma, supabase } = buildConsumer(rows, world);
    prisma.voucher.findUnique.mockResolvedValue(null);
    await expect(consumer.processVoucher(job)).rejects.toThrow('Voucher VC-1 not found');
    expect(supabase.downloadPrivate).not.toHaveBeenCalled();
  });

  it('reports a failed job and tells the uploader', async () => {
    const { captureJobError } = jest.requireMock<{ captureJobError: jest.Mock }>('src/common/observability');
    captureJobError.mockClear();
    const { consumer, job, inapp, prisma } = buildConsumer(rows, world);
    prisma.voucher.findUnique.mockResolvedValue({
      uploadedById: 'AD-1',
      variation: { organization: { name: 'NPF' }, period: { year: 2026, month: 'JUNE' } },
    });
    const error = new Error('storage unavailable');

    await consumer.onFailed(job, error);

    expect(captureJobError).toHaveBeenCalledWith(error, { queue: 'repayments', job: 'process_voucher', jobId: 'J-1' });
    expect(inapp.messageUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'AD-1',
        title: 'Voucher Processing Failed',
        message: expect.stringContaining('Processing the NPF JUNE 2026 voucher stopped: storage unavailable'),
      }),
    );
  });
});
