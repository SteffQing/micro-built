import 'dotenv/config';
import type { Period } from '@microbuilt/shared';
import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type Month, type Settings } from '@prisma/client';
import type { Job } from 'bull';
import * as XLSX from 'xlsx';
import { RepaymentsService } from 'src/admin/repayments/repayments.service';
import { VouchersService } from 'src/admin/repayments/vouchers.service';
import { AuditService } from 'src/audit/audit.service';
import type { VoucherJob } from 'src/common/types/queue.interface';
import { PrismaService } from 'src/database/prisma.service';
import type { SupabaseService } from 'src/database/supabase.service';
import type { QueueProducer } from 'src/queue/bull/queue.producer';
import { RepaymentsConsumer } from 'src/queue/bull/queue.repayments';
import { SettingsService } from 'src/settings/settings.service';
import { DeductionsService } from './deductions.service';
import type { Components } from './ledger.math';
import type { LedgerClock } from './ledger.clock';
import { LedgerService } from './ledger.service';
import { LedgerTx } from './ledger.tx';
import { LiquidationsService } from './liquidations.service';
import { PeriodsService } from './periods.service';
import { TenureChangesService } from './tenure-changes.service';
import { VariationLockService } from './variation-lock.service';
import { variationFilePath } from './variation';
import { VariationService } from './variation.service';

// Whole payroll cycles against the scratch database, in 2099 so no real payroll month is touched: generate an
// organization's variation, take its voucher, settle it, no payroll, revert, rematch (PLAN_V2 Stage C). Everything
// created is deleted afterwards (and any leftovers of an earlier crashed run first).
//
//   LEDGER_IT=1 ./node_modules/.bin/jest src/ledger/ledger.integration.spec.ts      (DATABASE_URL: a scratch database)
const RUN = process.env.LEDGER_IT === '1';
const describeIT = RUN ? describe : describe.skip;
if (RUN) jest.setTimeout(900_000);

// The producer pulls in the other queues' contracts; the voucher service only calls queueVoucher.
jest.mock('src/queue/bull/queue.producer', () => ({ QueueProducer: class {} }));

const YEAR = 2099;
const PREFIX = 'MB-IT';
const ACTOR = 'system';
const period = (month: Month): Period => ({ year: YEAR, month });
const fixed = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value).toFixed(2);

async function purge(prisma: PrismaService) {
  const customers = await prisma.customer.findMany({ where: { userId: { startsWith: PREFIX } }, select: { userId: true } });
  const customerIds = customers.map((c) => c.userId);
  const loanIds = (await prisma.loan.findMany({ where: { borrowerId: { in: customerIds } }, select: { id: true } })).map(
    (l) => l.id,
  );
  const periodIds = (await prisma.period.findMany({ where: { year: YEAR }, select: { id: true } })).map((p) => p.id);
  const variationIds = (await prisma.variation.findMany({ where: { periodId: { in: periodIds } }, select: { id: true } })).map(
    (v) => v.id,
  );
  const [microLoans, changes, inflows, vouchers] = await Promise.all([
    prisma.microLoan.findMany({ where: { loanId: { in: loanIds } }, select: { id: true } }),
    prisma.tenureChange.findMany({ where: { loanId: { in: loanIds } }, select: { id: true } }),
    prisma.paymentInflow.findMany({
      where: { OR: [{ customerId: { in: customerIds } }, { periodId: { in: periodIds } }] },
      select: { id: true },
    }),
    prisma.voucher.findMany({ where: { variationId: { in: variationIds } }, select: { id: true } }),
  ]);
  const inflowIds = inflows.map((i) => i.id);
  const entityIds = [
    ...loanIds,
    ...periodIds,
    ...variationIds,
    ...[...microLoans, ...changes, ...inflows, ...vouchers].map((row) => row.id),
  ];
  await prisma.$transaction([
    // Everything the ledger audits is stamped by the fake clock, so it is dated 2099 (reverted rows included).
    prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entityId: { in: entityIds } },
          { createdAt: { gte: new Date(`${YEAR}-01-01T00:00:00Z`), lt: new Date(`${YEAR + 1}-01-01T00:00:00Z`) } },
        ],
      },
    }),
    // Repayments on its inflows too: another spec's 2099 loans may have been paid from them.
    prisma.repaymentBreakdown.deleteMany({
      where: { repayment: { OR: [{ loanId: { in: loanIds } }, { paymentInflowId: { in: inflowIds } }] } },
    }),
    prisma.repayment.deleteMany({ where: { OR: [{ loanId: { in: loanIds } }, { paymentInflowId: { in: inflowIds } }] } }),
    prisma.deduction.deleteMany({ where: { OR: [{ loanId: { in: loanIds } }, { periodId: { in: periodIds } }] } }),
    prisma.tenureChange.deleteMany({ where: { loanId: { in: loanIds } } }),
    prisma.commodityLoan.deleteMany({ where: { loanId: { in: loanIds } } }),
    prisma.microLoan.deleteMany({ where: { loanId: { in: loanIds } } }),
    prisma.paymentInflow.deleteMany({ where: { id: { in: inflowIds } } }),
    prisma.voucher.deleteMany({ where: { id: { in: vouchers.map((v) => v.id) } } }),
    prisma.variation.deleteMany({ where: { id: { in: variationIds } } }),
    prisma.loan.deleteMany({ where: { id: { in: loanIds } } }),
    prisma.period.deleteMany({ where: { id: { in: periodIds } } }),
    prisma.customerPayroll.deleteMany({ where: { externalId: { startsWith: PREFIX } } }),
    prisma.user.deleteMany({ where: { id: { in: customerIds } } }),
    prisma.organization.deleteMany({ where: { name: { startsWith: 'IT ' } } }),
  ]);
}

describeIT('vouchers, no payroll, revert and rematch (integration, scratch database)', () => {
  const tag = Date.now().toString(36).toUpperCase();

  let now = new Date(`${YEAR}-01-10T09:00:00Z`);
  const clock = { now: () => now } as LedgerClock;
  const at = (iso: string) => (now = new Date(`${YEAR}-${iso}Z`));
  const prisma = new PrismaService();
  const events = new EventEmitter2();

  // The private buckets, in memory: what was stored and what was removed.
  const stored = new Map<string, Buffer>();
  const removed: string[] = [];
  const supabase = {
    uploadPrivate: async (bucket: string, path: string, body: Buffer) => {
      stored.set(`${bucket}/${path}`, body);
      return path;
    },
    downloadPrivate: async (bucket: string, path: string) => {
      const file = stored.get(`${bucket}/${path}`);
      if (!file) throw new Error(`File not found: ${bucket}/${path}`);
      return file;
    },
    removePrivate: async (bucket: string, path: string) => {
      stored.delete(`${bucket}/${path}`);
      removed.push(`${bucket}/${path}`);
    },
  } as unknown as SupabaseService;
  const queued: VoucherJob[] = [];
  const queue = { queueVoucher: async (job: VoucherJob) => void queued.push(job) } as unknown as QueueProducer;
  const notified: unknown[] = [];
  const notifier = { notify: async (...args: unknown[]) => void notified.push(args) };
  const inapp = { messageUser: async (...args: unknown[]) => void notified.push(args) };

  const settings = new SettingsService(prisma, new AuditService(prisma));
  const ledgerTx = new LedgerTx(prisma, events, clock);
  const periods = new PeriodsService(prisma, clock);
  const deductions = new DeductionsService(prisma, periods, clock);
  const tenureChanges = new TenureChangesService(prisma, ledgerTx, deductions);
  const ledger = new LedgerService(prisma, ledgerTx, deductions, tenureChanges, periods, clock);
  const liquidations = new LiquidationsService(ledgerTx, ledger, periods, clock);
  const locks = new VariationLockService(prisma, ledgerTx, ledger, deductions, tenureChanges, settings, supabase, clock);
  const variations = new VariationService(prisma, ledgerTx, periods, supabase, clock);
  const vouchers = new VouchersService(prisma, supabase, queue, ledgerTx, locks, settings, clock);
  const consumer = new RepaymentsConsumer(
    prisma,
    supabase,
    ledgerTx,
    ledger,
    locks,
    notifier as never,
    inapp as never,
  );
  const repayments = new RepaymentsService(prisma, ledgerTx, locks, liquidations, supabase, notifier as never, clock);

  let savedSettings: Settings | null = null;
  // Only what this run changed is put back: a run stopped before touching Settings must leave them alone.
  let settingsTouched = false;
  let seq = 0;
  let scenarioLoans: string[] = [];

  /** An organization of its own, so no scenario shares a variation with another. */
  const organization = (label: string) =>
    prisma.organization.create({
      data: { name: `IT ${label} ${tag}`, normalizedName: `it ${label} ${tag}`.toLowerCase() },
    });

  interface Borrower {
    customerId: string;
    externalId: string;
    loanId: string;
  }

  /**
   * A customer in the organization with a ₦100,000 loan over 6 months at 6 % (owed ₦136,000, ₦22,666.67 a month),
   * disbursed now. A net pay of ₦200,000 puts the 10 % cap at ₦20,000, so a default there proposes an extension.
   */
  async function borrower(
    organizationId: string,
    options: { principal?: string; tenure?: number; netPay?: string } = {},
  ): Promise<Borrower> {
    const n = ++seq;
    const customerId = `${PREFIX}${tag}${n}`;
    const externalId = `${customerId}-IPPIS`;
    const loanId = `LN-IT${tag}${n}`;
    await prisma.user.create({
      data: {
        id: customerId,
        name: `Ada IT ${n}`,
        email: `${customerId.toLowerCase()}@it.microbuiltprime.com`,
        status: 'ACTIVE',
        customer: { create: { externalId } },
      },
    });
    await prisma.customerPayroll.create({
      data: { externalId, netPay: options.netPay ?? '1000000', command: 'IT COMMAND', organizationId },
    });
    await prisma.loan.create({
      data: {
        id: loanId,
        borrowerId: customerId,
        category: 'PERSONAL',
        status: 'APPROVED',
        interestRate: '0.06',
        managementFeeRate: '0.025',
        tenure: options.tenure ?? 6,
        principal: options.principal ?? '100000',
      },
    });
    await ledger.disburseLoan(loanId, ACTOR);
    scenarioLoans.push(loanId);
    return { customerId, externalId, loanId };
  }

  const capped = { netPay: '200000' };

  /** A voucher sheet: each row a staff ID and the naira payroll deducted. */
  function sheetFile(month: Month, rows: [string, number | string, ...unknown[]][], name = 'voucher.xlsx') {
    const book = XLSX.utils.book_new();
    const header = ['Staff ID', 'Amount', 'Full Name', 'Period', 'MDA', 'Command', 'Grade'];
    const body = rows.map(([staffId, amount, grade]) => [staffId, amount, 'IT', `${month} ${YEAR}`, 'SOME MDA', 'ARMY CMD', grade ?? '']);
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([header, ...body]), 'Payroll');
    return {
      buffer: XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
      originalname: name,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as Express.Multer.File;
  }

  const jobFor = (voucherId: string) =>
    ({ id: `J-${voucherId}`, name: 'process_voucher', data: { voucherId }, progress: async () => undefined }) as unknown as Job<VoucherJob>;

  /** Uploads a voucher and runs its job, as the queue would. */
  async function voucher(organizationId: string, month: Month, rows: [string, number | string, ...unknown[]][]) {
    const receipt = await vouchers.upload(sheetFile(month, rows), organizationId, ACTOR);
    const summary = await consumer.processVoucher(jobFor(receipt.voucherId));
    return { receipt, summary };
  }

  const deductionIn = (loanId: string, month: Month) =>
    prisma.deduction.findFirstOrThrow({ where: { loanId, period: { year: YEAR, month } } });
  const part = (c: Components) => ({ principal: fixed(c.principal), interest: fixed(c.interest), penalty: fixed(c.penalty) });

  /** Everything the ledger holds about a loan that a revert or a rematch has to put right, to the kobo. */
  async function snapshot(loanId: string) {
    const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
    const balances = await ledger.balances(loanId);
    const rows = await prisma.deduction.findMany({
      where: { loanId },
      include: { period: true },
      orderBy: [{ period: { year: 'asc' } }, { period: { month: 'asc' } }],
    });
    const [penalties, proposals] = await Promise.all([
      prisma.microLoan.findMany({ where: { loanId, purpose: 'PENALTY' }, select: { amount: true } }),
      prisma.tenureChange.count({ where: { loanId, status: 'PENDING' } }),
    ]);
    return {
      status: loan.status,
      owed: fixed(loan.owed),
      repaid: fixed(loan.repaid),
      tenure: balances.tenure,
      booked: part(balances.booked),
      collected: part(balances.collected),
      penalties: penalties.map((p) => fixed(p.amount)),
      proposals,
      sent: rows
        .filter((r) => r.status !== 'OPEN')
        .map((r) => ({
          month: r.period.month,
          status: r.status,
          expected: fixed(r.expected),
          settled: r.settledAt !== null,
          penalized: r.penalizedAt !== null,
        })),
      open: rows.filter((r) => r.status === 'OPEN').map((r) => ({ month: r.period.month, expected: fixed(r.expected) })),
    };
  }
  /** The loan's figures without its OPEN rows (which a revert recomputes rather than restores). */
  const withoutOpen = ({ open, ...rest }: Awaited<ReturnType<typeof snapshot>>) => (void open, rest);

  const auditCount = (action: string, entityId: string) =>
    prisma.auditLog.count({ where: { action: action as never, entityId } });

  /** The 409 body of a refused call. */
  async function refusal(call: Promise<unknown>) {
    const error = await call.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ConflictException);
    return (error as ConflictException).getResponse() as { statusCode: number; message: string; earlierUnlocked?: unknown };
  }

  beforeAll(async () => {
    await prisma.$connect();
    await purge(prisma);
    savedSettings = await prisma.settings.findUnique({ where: { id: 1 } });
    const itSettings = { interestRate: '0.06', managementFeeRate: '0.025', penaltyRate: '0.1', maxDeductionRate: '0.1' };
    settingsTouched = true;
    await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1, ...itSettings }, update: itSettings });
  });

  afterAll(async () => {
    await purge(prisma);
    if (settingsTouched) {
      if (savedSettings) {
        const { id, updatedAt, ...values } = savedSettings;
        void updatedAt;
        await prisma.settings.update({ where: { id }, data: values });
      } else {
        await prisma.settings.deleteMany({ where: { id: 1 } });
      }
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    scenarioLoans = [];
    at('01-10T09:00:00');
  });

  afterEach(async () => {
    for (const loanId of scenarioLoans) await ledger.assertInvariants(loanId);
  });

  it('settles a voucher: full, short and missing; opens February and deletes the superseded files', async () => {
    const org = await organization('A');
    const [a1, a2, a3] = await Promise.all([borrower(org.id), borrower(org.id), borrower(org.id)]);

    at('01-24T09:00:00');
    const first = await variations.generate(org.id, period('JANUARY'), ACTOR);
    expect(first).toMatchObject({ version: 1, frozen: 3 });
    at('01-26T09:00:00');
    const second = await variations.generate(org.id, period('JANUARY'), ACTOR);
    expect(second.version).toBe(2);
    const v1 = `variations/${variationFilePath(org.id, period('JANUARY'), 1)}`;
    const v2 = `variations/${variationFilePath(org.id, period('JANUARY'), 2)}`;
    // Superseded versions stay until the variation locks (P4).
    expect([stored.has(v1), stored.has(v2)]).toEqual([true, true]);
    expect((await deductionIn(a1.loanId, 'JANUARY')).status).toBe('AWAITING');
    expect(await prisma.deduction.count({ where: { variationId: first.variationId } })).toBe(3);

    at('02-03T09:00:00');
    const { receipt, summary } = await voucher(org.id, 'JANUARY', [
      [a1.externalId, '22666.67', 'GL 09'],
      [a2.externalId, 10000],
    ]);
    expect(receipt).toMatchObject({ variationId: first.variationId, period: 'JANUARY 2099', rows: 2 });
    expect(receipt.organization).toEqual({ id: org.id, name: org.name });
    expect(queued).toContainEqual({ voucherId: receipt.voucherId });
    expect(summary).toMatchObject({
      rows: 2,
      settled: 2,
      reviewing: 0,
      unmatched: 0,
      settlement: { settled: true, failed: 1, partial: 1, penalties: 2, penaltyTotal: 3533.34, proposals: 0 },
    });

    // In full: FULFILLED, no penalty. Short: PARTIAL, charged on the shortfall. Missing: FAILED, charged on all of it.
    expect(await deductionIn(a1.loanId, 'JANUARY')).toMatchObject({ status: 'FULFILLED', penalizedAt: null });
    expect(await deductionIn(a2.loanId, 'JANUARY')).toMatchObject({ status: 'PARTIAL' });
    expect((await deductionIn(a2.loanId, 'JANUARY')).penalizedAt).toBeInstanceOf(Date);
    expect(await deductionIn(a3.loanId, 'JANUARY')).toMatchObject({ status: 'FAILED' });
    const penalties = await prisma.microLoan.findMany({
      where: { variationId: first.variationId },
      orderBy: { amount: 'asc' },
    });
    expect(penalties.map((p) => [p.loanId, fixed(p.amount), p.purpose])).toEqual([
      [a2.loanId, '1266.67', 'PENALTY'],
      [a3.loanId, '2266.67', 'PENALTY'],
    ]);
    const snapshots = await Promise.all([a1, a2, a3].map((b) => snapshot(b.loanId)));
    expect(snapshots.map((s) => [s.owed, s.repaid])).toEqual([
      ['136000.00', '22666.67'],
      ['137266.67', '10000.00'],
      ['138266.67', '0.00'],
    ]);
    // Each loan's next month is open now (R1), from what is still owed over the 5 months left.
    expect(snapshots.map((s) => s.open)).toEqual([
      [{ month: 'FEBRUARY', expected: '22666.67' }],
      [{ month: 'FEBRUARY', expected: '25453.33' }],
      [{ month: 'FEBRUARY', expected: '27653.33' }],
    ]);
    // The superseded file is gone, the current one stays.
    expect([stored.has(v1), stored.has(v2)]).toEqual([false, true]);
    expect(removed).toContain(v1);
    // The row's details update the customer, never the organization.
    expect(await prisma.customerPayroll.findUniqueOrThrow({ where: { externalId: a1.externalId } })).toMatchObject({
      grade: 'GL 09',
      command: 'ARMY CMD',
      organizationId: org.id,
    });
    expect(await auditCount('VOUCHER_UPLOADED', receipt.voucherId)).toBe(1);
    expect(await prisma.auditLog.findFirstOrThrow({ where: { entityId: receipt.voucherId } })).toMatchObject({
      entityType: 'VOUCHER',
      action: 'VOUCHER_UPLOADED',
    });

    // Running the job again finds every row in and every deduction settled: nothing is charged twice.
    const again = await consumer.processVoucher(jobFor(receipt.voucherId));
    expect(again).toMatchObject({ duplicate: 2, settled: 0, settlement: { penalties: 0, failed: 0, partial: 0 } });
    expect(await prisma.microLoan.count({ where: { variationId: first.variationId } })).toBe(2);
    expect(await Promise.all([a1, a2, a3].map((b) => snapshot(b.loanId)))).toEqual(snapshots);
    expect(await auditCount('VOUCHER_UPLOADED', receipt.voucherId)).toBe(1);
  });

  it('guards the upload: a variation first, one voucher each, and not while the job is still running', async () => {
    const org = await organization('Z');
    const z1 = await borrower(org.id);
    const file = () => sheetFile('JANUARY', [[z1.externalId, '22666.67']]);

    at('01-20T09:00:00');
    expect(await refusal(vouchers.upload(file(), org.id, ACTOR))).toMatchObject({
      statusCode: 409,
      message: `Generate ${org.name}'s JANUARY 2099 variation first`,
    });
    expect(await vouchers.validate(file(), org.id)).toMatchObject({ valid: false, variation: null });

    at('01-24T09:00:00');
    const generated = await variations.generate(org.id, period('JANUARY'), ACTOR);
    const report = await vouchers.validate(
      sheetFile('JANUARY', [
        [z1.externalId, '22666.67'],
        ['IT-NOBODY', 100],
      ]),
      org.id,
    );
    expect(report).toMatchObject({
      valid: true,
      variation: { id: generated.variationId, version: 1 },
      issues: { unmatched: 1, otherOrganization: 0, notInVariation: 0 },
      earlierUnlocked: [],
      conflicts: [],
    });

    // Uploaded but not processed: it can't be reverted yet, and nothing else goes into the variation.
    at('01-28T09:00:00');
    const receipt = await vouchers.upload(file(), org.id, ACTOR);
    const { fileHash } = await prisma.voucher.findUniqueOrThrow({ where: { id: receipt.voucherId } });
    const sheetPath = `payroll-uploads/2099-01/${fileHash}.xlsx`;
    expect(stored.has(sheetPath)).toBe(true);
    expect(await refusal(vouchers.revert(receipt.voucherId, 'Changed my mind', ACTOR))).toMatchObject({
      message: 'This voucher is still being processed: try again in a few minutes',
    });
    expect(await refusal(vouchers.upload(file(), org.id, ACTOR))).toMatchObject({
      message: `${org.name}'s JANUARY 2099 variation already has a voucher`,
    });
    expect(await refusal(vouchers.upload(sheetFile('JANUARY', [[z1.externalId, 1]], 'other.xlsx'), org.id, ACTOR))).toMatchObject({
      message: `${org.name}'s JANUARY 2099 variation already has a voucher`,
    });

    // A job that never finished leaves no VOUCHER_UPLOADED entry: after a while the voucher can go.
    at('01-28T10:00:00');
    const reverted = await vouchers.revert(receipt.voucherId, 'The job never ran', ACTOR);
    expect(reverted).toEqual({ variationId: generated.variationId, inflowsRemoved: 0, penaltiesRemoved: 0, proposalsWithdrawn: 0 });
    expect(stored.has(sheetPath)).toBe(false);
    expect(await prisma.voucher.findUnique({ where: { id: receipt.voucherId } })).toBeNull();
    expect(await auditCount('VOUCHER_REVERTED', generated.variationId)).toBe(1);

    // The same file can be uploaded again, and this time it is processed.
    const second = await voucher(org.id, 'JANUARY', [[z1.externalId, '22666.67']]);
    expect(second.summary).toMatchObject({ settled: 1, settlement: { settled: true, failed: 0, penalties: 0 } });
    expect((await deductionIn(z1.loanId, 'JANUARY')).status).toBe('FULFILLED');
  });

  it('refuses a later voucher while an earlier month is unlocked, and No payroll penalizes everyone in it', async () => {
    const org = await organization('C');
    const [c1, c2] = await Promise.all([borrower(org.id), borrower(org.id, capped)]);

    at('01-24T09:00:00');
    const january = await variations.generate(org.id, period('JANUARY'), ACTOR);
    // February goes to the organization before January's voucher is back.
    at('01-30T09:00:00');
    const february = await variations.generate(org.id, period('FEBRUARY'), ACTOR);
    expect(february).toMatchObject({ version: 1, frozen: 2 });

    // No payroll only for a month that has ended (Lagos time).
    at('01-31T12:00:00');
    expect(await refusal(locks.noPayroll(january.variationId, 'Never sent', ACTOR))).toMatchObject({
      message: "JANUARY 2099 hasn't ended yet",
    });

    // February's voucher can't go in ahead of January's: the refusal names January.
    at('02-03T09:00:00');
    const febRows: [string, number | string][] = [
      [c1.externalId, '22666.67'],
      [c2.externalId, '22666.67'],
    ];
    const refused = await refusal(vouchers.upload(sheetFile('FEBRUARY', febRows), org.id, ACTOR));
    expect(refused).toMatchObject({
      statusCode: 409,
      message: `${org.name} has no voucher yet for JANUARY 2099: upload it, or mark it No payroll, before this one`,
      earlierUnlocked: [{ variationId: january.variationId, ym: '2099-01', label: 'JANUARY 2099' }],
    });
    expect(await vouchers.validate(sheetFile('FEBRUARY', febRows), org.id)).toMatchObject({
      valid: false,
      earlierUnlocked: [{ variationId: january.variationId, ym: '2099-01', label: 'JANUARY 2099' }],
    });
    expect(await refusal(locks.noPayroll(february.variationId, 'Never sent', ACTOR))).toMatchObject({
      message: "FEBRUARY 2099 hasn't ended yet",
    });

    // No payroll on January: everyone in it failed and is charged; February's rows are left alone.
    const result = await locks.noPayroll(january.variationId, 'The organization never sent it', ACTOR);
    expect(result).toEqual({
      variationId: january.variationId,
      label: `${org.name} · JANUARY 2099`,
      failed: 2,
      penalties: 2,
      penaltyTotal: 4533.34,
      proposals: 1,
    });
    expect(await deductionIn(c1.loanId, 'JANUARY')).toMatchObject({ status: 'FAILED' });
    expect(await deductionIn(c2.loanId, 'JANUARY')).toMatchObject({ status: 'FAILED' });
    expect((await deductionIn(c1.loanId, 'FEBRUARY')).status).toBe('AWAITING');
    expect(await prisma.microLoan.count({ where: { variationId: january.variationId, purpose: 'PENALTY' } })).toBe(2);
    expect(await prisma.tenureChange.count({ where: { variationId: january.variationId, status: 'PENDING' } })).toBe(1);
    expect(await auditCount('NO_PAYROLL', january.variationId)).toBe(1);
    expect(await refusal(locks.noPayroll(january.variationId, 'Again', ACTOR))).toMatchObject({
      message: `${org.name}'s JANUARY 2099 variation is already marked No payroll`,
    });
    // A voucher for a month marked No payroll is refused too, until that is reverted.
    expect(await refusal(vouchers.upload(sheetFile('JANUARY', [[c1.externalId, '22666.67']]), org.id, ACTOR))).toMatchObject({
      message: `${org.name}'s JANUARY 2099 variation was marked No payroll: revert that before uploading its voucher`,
    });

    // A liquidation accepted since: how it was split depends on the penalties, so the No payroll stays.
    at('02-04T09:00:00');
    const request = await liquidations.request({ customerId: c1.customerId, amount: 5000, proofPath: 'proof.pdf' });
    await liquidations.decide(request.id, { approve: true }, ACTOR);
    expect(await refusal(locks.revertNoPayroll(january.variationId, 'Changed my mind', ACTOR))).toMatchObject({
      message: expect.stringContaining('after it was settled'),
    });

    // Now January is locked, February's voucher goes in.
    at('02-05T09:00:00');
    const { summary } = await voucher(org.id, 'FEBRUARY', febRows);
    expect(summary).toMatchObject({ settled: 2, settlement: { settled: true, failed: 0, partial: 0 } });
    expect(await deductionIn(c1.loanId, 'FEBRUARY')).toMatchObject({ status: 'FULFILLED' });
    // A later month is locked now: January's No payroll can't be undone.
    expect(await refusal(locks.revertNoPayroll(january.variationId, 'Too late', ACTOR))).toMatchObject({
      message: expect.stringContaining('FEBRUARY 2099 variation is locked'),
    });
  });

  it('reverts a No payroll with February generated, to the kobo; then January\'s late voucher goes in', async () => {
    const org = await organization('J');
    const j1 = await borrower(org.id, capped);

    at('01-24T09:00:00');
    const january = await variations.generate(org.id, period('JANUARY'), ACTOR);
    at('01-30T09:00:00');
    await variations.generate(org.id, period('FEBRUARY'), ACTOR);
    const before = await snapshot(j1.loanId);
    expect(before.sent.map((row) => row.status)).toEqual(['AWAITING', 'AWAITING']);

    at('02-03T09:00:00');
    await locks.noPayroll(january.variationId, 'Never sent', ACTOR);
    const during = await snapshot(j1.loanId);
    expect(during).toMatchObject({ owed: '138266.67', penalties: ['2266.67'], proposals: 1 });

    // February is generated but not locked: the No payroll can be undone.
    at('02-04T09:00:00');
    const result = await locks.revertNoPayroll(january.variationId, 'The voucher turned up', ACTOR);
    expect(result).toEqual({
      variationId: january.variationId,
      label: `${org.name} · JANUARY 2099`,
      inflowsRemoved: 0,
      penaltiesRemoved: 1,
      proposalsWithdrawn: 1,
    });
    expect(withoutOpen(await snapshot(j1.loanId))).toEqual(withoutOpen(before));
    expect(await prisma.variation.findUniqueOrThrow({ where: { id: january.variationId } })).toMatchObject({
      noPayrollReason: null,
    });
    expect(await auditCount('NO_PAYROLL_REVERTED', january.variationId)).toBe(1);
    expect(await refusal(locks.revertNoPayroll(january.variationId, 'Twice', ACTOR))).toMatchObject({
      message: `${org.name}'s JANUARY 2099 variation isn't marked No payroll`,
    });

    // The voucher that turned up goes into January.
    at('02-05T09:00:00');
    const { summary } = await voucher(org.id, 'JANUARY', [[j1.externalId, '22666.67']]);
    expect(summary).toMatchObject({ settled: 1, settlement: { settled: true, failed: 0, penalties: 0 } });
    expect((await deductionIn(j1.loanId, 'JANUARY')).status).toBe('FULFILLED');
    expect(await refusal(locks.noPayroll(january.variationId, 'Too late', ACTOR))).toMatchObject({
      message: `${org.name}'s JANUARY 2099 variation already has a voucher`,
    });
  });

  it('rematches an unmatched row: the penalty goes and the loan ends as if it had matched first time', async () => {
    const orgNavy = await organization('E1');
    const orgPolice = await organization('E2');
    const [e1, e2] = await Promise.all([borrower(orgNavy.id, capped), borrower(orgPolice.id, capped)]);

    at('01-24T09:00:00');
    const [navy, police] = await Promise.all([
      variations.generate(orgNavy.id, period('JANUARY'), ACTOR),
      variations.generate(orgPolice.id, period('JANUARY'), ACTOR),
    ]);

    at('01-28T09:00:00');
    // Navy's voucher: e1 matches (and pays short); e2 is not Navy's, so that row is left for review.
    const first = await voucher(orgNavy.id, 'JANUARY', [
      [e1.externalId, 10000],
      [e2.externalId, '22666.67', 'GL 99'],
    ]);
    expect(first.summary).toMatchObject({ settled: 1, reviewing: 1, unmatched: 0 });
    const other = await prisma.paymentInflow.findFirstOrThrow({
      where: { voucherId: first.receipt.voucherId, externalUserId: e2.externalId },
    });
    expect(other).toMatchObject({ state: 'REVIEWING', customerId: e2.customerId });
    expect(await prisma.repayment.count({ where: { paymentInflowId: other.id } })).toBe(0);
    expect((await prisma.customerPayroll.findUniqueOrThrow({ where: { externalId: e2.externalId } })).grade).toBeNull();
    expect((await deductionIn(e2.loanId, 'JANUARY')).status).toBe('AWAITING');

    // Police's voucher has e2's staff ID mistyped: unmatched, so e2 failed and was charged.
    const second = await voucher(orgPolice.id, 'JANUARY', [['IT-TYPO-' + tag, 10000]]);
    expect(second.summary).toMatchObject({ unmatched: 1, settlement: { failed: 1, penalties: 1, penaltyTotal: 2266.67 } });
    expect(await snapshot(e2.loanId)).toMatchObject({
      owed: '138266.67',
      repaid: '0.00',
      penalties: ['2266.67'],
      proposals: 1,
      sent: [{ month: 'JANUARY', status: 'FAILED', penalized: true }],
    });
    const typo = await prisma.paymentInflow.findFirstOrThrow({ where: { voucherId: second.receipt.voucherId } });
    expect(typo.state).toBe('UNMATCHED');

    // The admin matches the row to e2: its deduction is found through the voucher's variation.
    const result = await repayments.resolve(typo.id, { action: 'APPLY', customerId: e2.customerId }, ACTOR);
    expect(result).toEqual({
      id: typo.id,
      state: 'SETTLED',
      customerId: e2.customerId,
      loanId: e2.loanId,
      applied: 10000,
      unapplied: 0,
      deductionStatus: 'PARTIAL',
      penaltyCleared: true,
      fallbackReason: null,
    });
    const rematched = await snapshot(e2.loanId);
    expect(rematched).toMatchObject({ owed: '137266.67', repaid: '10000.00', penalties: ['1266.67'], proposals: 1 });
    // The same figures as e1, whose row matched first time: to the kobo.
    expect(rematched).toEqual(await snapshot(e1.loanId));
    expect(await prisma.microLoan.count({ where: { variationId: police.variationId, purpose: 'PENALTY' } })).toBe(1);
    expect(await prisma.tenureChange.count({ where: { variationId: police.variationId } })).toBe(1);

    // The row of another organization is not paid into e2's deduction in Police's variation: reject it.
    const rejected = await repayments.resolve(other.id, { action: 'REJECT', note: 'Wrong organization' }, ACTOR);
    expect(rejected).toMatchObject({ state: 'REJECTED', penaltyCleared: false, fallbackReason: null });
    expect(await snapshot(e2.loanId)).toEqual(rematched);

    // A cap proposal that has been decided can't be taken back: Navy's voucher stays.
    const proposal = await prisma.tenureChange.findFirstOrThrow({ where: { variationId: navy.variationId } });
    await tenureChanges.approve(proposal.id, ACTOR);
    at('01-29T09:00:00');
    expect(await refusal(vouchers.revert(first.receipt.voucherId, 'Wrong file', ACTOR))).toMatchObject({
      message: "A tenure change proposed when it was settled has been decided, so it can't be undone",
    });
  });

  it('falls back when a liquidation has collected part of the penalty: the loan is paid and the penalty stays', async () => {
    const org = await organization('F');
    const f1 = await borrower(org.id);

    at('01-24T09:00:00');
    const generated = await variations.generate(org.id, period('JANUARY'), ACTOR);
    at('01-28T09:00:00');
    const { receipt } = await voucher(org.id, 'JANUARY', [['IT-TYPO-F' + tag, 10000]]);
    expect(await snapshot(f1.loanId)).toMatchObject({ owed: '138266.67', penalties: ['2266.67'] });
    const typo = await prisma.paymentInflow.findFirstOrThrow({ where: { voucherId: receipt.voucherId } });

    // Penalties are paid first, so the liquidation collects part of it.
    at('01-29T09:00:00');
    const request = await liquidations.request({ customerId: f1.customerId, amount: 30000, proofPath: 'proof.pdf' });
    await liquidations.decide(request.id, { approve: true }, ACTOR);
    expect((await ledger.balances(f1.loanId)).collected.penalty.toFixed(2)).toBe('2266.67');

    // The voucher can't be reverted over it...
    expect(await refusal(vouchers.revert(receipt.voucherId, 'Wrong file', ACTOR))).toMatchObject({
      message: expect.stringContaining('after it was settled'),
    });
    // ...and a rematch can't take the penalty back: the money pays the loan, and the response says why.
    const before = await snapshot(f1.loanId);
    const result = await repayments.resolve(typo.id, { action: 'APPLY', customerId: f1.customerId }, ACTOR);
    expect(result).toMatchObject({
      state: 'SETTLED',
      applied: 10000,
      deductionStatus: null,
      penaltyCleared: false,
      fallbackReason: 'Part of the penalty has already been collected, so the penalty stays',
    });
    const after = await snapshot(f1.loanId);
    expect(after).toMatchObject({ owed: before.owed, penalties: ['2266.67'] });
    expect([before.repaid, after.repaid]).toEqual(['30000.00', '40000.00']);
    expect(after.sent).toEqual(before.sent);
    expect(await prisma.microLoan.count({ where: { variationId: generated.variationId, purpose: 'PENALTY' } })).toBe(1);
  });

  it('reverts a voucher to the kobo, then refuses once February is generated or the month has ended', async () => {
    const org = await organization('G');
    const [g2, g3, g4] = await Promise.all([
      borrower(org.id, capped),
      borrower(org.id, capped),
      // ₦10,000 over one month at 6 %: the voucher pays all ₦10,600, so the loan is REPAID.
      borrower(org.id, { principal: '10000', tenure: 1 }),
    ]);
    const all = [g2, g3, g4];

    at('01-24T09:00:00');
    const generated = await variations.generate(org.id, period('JANUARY'), ACTOR);
    const before = await Promise.all(all.map((b) => snapshot(b.loanId)));

    at('01-28T09:00:00');
    const rows: [string, number | string][] = [
      [g2.externalId, 10000],
      [g4.externalId, '10600'],
    ];
    const first = await voucher(org.id, 'JANUARY', rows);
    const { fileHash } = await prisma.voucher.findUniqueOrThrow({ where: { id: first.receipt.voucherId } });
    expect(first.summary).toMatchObject({ settled: 2, settlement: { failed: 1, partial: 1, penalties: 2, proposals: 2 } });
    const settled = await Promise.all(all.map((b) => snapshot(b.loanId)));
    expect(settled[2]).toMatchObject({ status: 'REPAID', owed: '10600.00', repaid: '10600.00' });
    expect(settled[0]).toMatchObject({ status: 'DISBURSED', repaid: '10000.00', penalties: ['1266.67'], proposals: 1 });
    expect(settled[1]).toMatchObject({ status: 'DISBURSED', repaid: '0.00', penalties: ['2266.67'], proposals: 1 });

    at('01-29T09:00:00');
    const reverted = await vouchers.revert(first.receipt.voucherId, 'Uploaded the wrong sheet', ACTOR);
    expect(reverted).toEqual({ variationId: generated.variationId, inflowsRemoved: 2, penaltiesRemoved: 2, proposalsWithdrawn: 2 });
    const restored = await Promise.all(all.map((b) => snapshot(b.loanId)));
    expect(restored.map(withoutOpen)).toEqual(before.map(withoutOpen));
    // g4 owes again: the payment that cleared it is gone.
    expect(restored[2]).toMatchObject({ status: 'DISBURSED', repaid: '0.00' });
    expect(await prisma.voucher.count({ where: { variationId: generated.variationId } })).toBe(0);
    expect(await prisma.paymentInflow.count({ where: { voucherId: first.receipt.voucherId } })).toBe(0);
    expect(await prisma.repayment.count({ where: { loanId: { in: all.map((b) => b.loanId) } } })).toBe(0);
    expect(await prisma.microLoan.count({ where: { variationId: generated.variationId } })).toBe(0);
    expect(stored.has(`payroll-uploads/2099-01/${fileHash}.xlsx`)).toBe(false);
    expect(await auditCount('VOUCHER_REVERTED', generated.variationId)).toBe(1);

    // The corrected voucher goes in, and the loans end up exactly where the first one left them.
    const second = await voucher(org.id, 'JANUARY', rows);
    expect(second.summary).toMatchObject({ settled: 2, settlement: { failed: 1, partial: 1, penalties: 2 } });
    expect(await Promise.all(all.map((b) => snapshot(b.loanId)))).toEqual(settled);

    // February has been generated from what this voucher left: it can't be reverted any more.
    at('01-30T09:00:00');
    await variations.generate(org.id, period('FEBRUARY'), ACTOR);
    expect(await refusal(vouchers.revert(second.receipt.voucherId, 'Late', ACTOR))).toMatchObject({
      message: expect.stringContaining('FEBRUARY 2099 variation exists'),
    });
    // And once the month has ended, whatever February holds.
    at('02-02T09:00:00');
    expect(await refusal(vouchers.revert(second.receipt.voucherId, 'Late', ACTOR))).toMatchObject({
      message: 'Only a voucher for the current month (FEBRUARY 2099) can be reverted, and this one is for JANUARY 2099',
    });
  });
});
