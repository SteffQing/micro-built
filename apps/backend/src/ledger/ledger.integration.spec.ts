import 'dotenv/config';
import type { Period } from '@microbuilt/shared';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type Month, type Settings } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from 'src/database/prisma.service';
import type { SupabaseService } from 'src/database/supabase.service';
import { SettingsService } from 'src/settings/settings.service';
import { DeductionsService } from './deductions.service';
import type { LedgerClock } from './ledger.clock';
import { LedgerService } from './ledger.service';
import { LedgerTx } from './ledger.tx';
import { LiquidationsService } from './liquidations.service';
import { PeriodCloseService } from './period-close.service';
import { PeriodsService } from './periods.service';
import { StatementService } from './statement.service';
import { TenureChangesService } from './tenure-changes.service';
import { VariationService } from './variation.service';

// Whole payroll cycles against the dev database, in 2099 so no real payroll month is touched.
// Everything created is deleted afterwards (and any leftovers of an earlier crashed run first).
//
//   LEDGER_IT=1 pnpm exec jest src/ledger/ledger.integration.spec.ts
const RUN = process.env.LEDGER_IT === '1';
const describeIT = RUN ? describe : describe.skip;
if (RUN) jest.setTimeout(300_000);

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
  const periodIds = (await prisma.payrollPeriod.findMany({ where: { year: YEAR }, select: { id: true } })).map((p) => p.id);
  const [microLoans, changes, inflows] = await Promise.all([
    prisma.microLoan.findMany({ where: { loanId: { in: loanIds } }, select: { id: true } }),
    prisma.tenureChange.findMany({ where: { loanId: { in: loanIds } }, select: { id: true } }),
    prisma.paymentInflow.findMany({
      where: { OR: [{ customerId: { in: customerIds } }, { periodId: { in: periodIds } }] },
      select: { id: true },
    }),
  ]);
  const entityIds = [...loanIds, ...periodIds, ...[...microLoans, ...changes, ...inflows].map((row) => row.id)];
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } }),
    prisma.repaymentBreakdown.deleteMany({ where: { repayment: { loanId: { in: loanIds } } } }),
    prisma.repayment.deleteMany({ where: { loanId: { in: loanIds } } }),
    prisma.deduction.deleteMany({ where: { OR: [{ loanId: { in: loanIds } }, { periodId: { in: periodIds } }] } }),
    prisma.tenureChange.deleteMany({ where: { loanId: { in: loanIds } } }),
    prisma.commodityLoan.deleteMany({ where: { loanId: { in: loanIds } } }),
    prisma.microLoan.deleteMany({ where: { loanId: { in: loanIds } } }),
    prisma.paymentInflow.deleteMany({ where: { id: { in: inflows.map((i) => i.id) } } }),
    prisma.loan.deleteMany({ where: { id: { in: loanIds } } }),
    prisma.payrollPeriod.deleteMany({ where: { id: { in: periodIds } } }),
    prisma.customerPayroll.deleteMany({ where: { externalId: { startsWith: PREFIX } } }),
    prisma.user.deleteMany({ where: { id: { in: customerIds } } }),
  ]);
}

describeIT('ledger (integration, dev database)', () => {
  const tag = Date.now().toString(36).toUpperCase();
  const customerId = `${PREFIX}${tag}`;
  const externalId = `${customerId}-IPPIS`;
  const loanId = `LN-IT${tag}`;

  let now = new Date(`${YEAR}-01-10T09:00:00Z`);
  const clock = { now: () => now } as LedgerClock;
  const prisma = new PrismaService();
  const events = new EventEmitter2();
  const heard: { name: string; payload: Record<string, unknown> }[] = [];
  events.onAny((name, payload) => heard.push({ name: String(name), payload: payload as Record<string, unknown> }));
  const uploads: { bucket: string; path: string; body: Buffer }[] = [];
  const supabase = {
    uploadPrivate: async (bucket: string, path: string, body: Buffer) => {
      uploads.push({ bucket, path, body });
      return path;
    },
  } as unknown as SupabaseService;

  const settings = new SettingsService(prisma);
  const ledgerTx = new LedgerTx(prisma, events, clock);
  const periods = new PeriodsService(prisma, clock);
  const deductions = new DeductionsService(prisma, periods, clock);
  const tenureChanges = new TenureChangesService(prisma, ledgerTx, deductions);
  const ledger = new LedgerService(prisma, ledgerTx, deductions, tenureChanges, clock);
  const liquidations = new LiquidationsService(ledgerTx, ledger, periods, clock);
  const closer = new PeriodCloseService(prisma, ledgerTx, ledger, deductions, tenureChanges, periods, settings, clock);
  const variation = new VariationService(prisma, ledgerTx, periods, supabase, clock);
  const statements = new StatementService(prisma);

  let savedSettings: Settings | null = null;
  const at = (iso: string) => (now = new Date(iso));
  const deductionIn = (month: Month) =>
    prisma.deduction.findFirstOrThrow({ where: { loanId, period: { year: YEAR, month } } });
  const payroll = async (month: Month, amount: string) => {
    const { id } = await periods.ensure(period(month));
    return prisma.paymentInflow.create({
      data: { source: 'PAYROLL', state: 'AWAITING', periodId: id, amount, customerId, externalUserId: externalId },
    });
  };

  beforeAll(async () => {
    await prisma.$connect();
    await purge(prisma);
    const blocking = await prisma.deduction.count({ where: { status: 'OPEN', period: { year: { lt: YEAR } } } });
    if (blocking > 0) {
      throw new Error(`${blocking} real OPEN deductions exist before ${YEAR}; variations must go in month order, so this test can't submit ${YEAR}`);
    }
    savedSettings = await prisma.settings.findUnique({ where: { id: 1 } });
    const itSettings = { interestRate: '0.06', managementFeeRate: '0.025', penaltyRate: '0.1', maxDeductionRate: '0.1' };
    await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1, ...itSettings }, update: itSettings });

    await prisma.user.create({
      data: {
        id: customerId,
        name: `Ada IT ${tag}`,
        email: `${customerId.toLowerCase()}@it.microbuiltprime.com`,
        status: 'ACTIVE',
        customer: { create: { externalId } },
      },
    });
    // Net pay ₦200,000 with a 10 % cap: the monthly deduction may be at most ₦20,000.
    await prisma.customerPayroll.create({
      data: { externalId, netPay: '200000', command: 'IT COMMAND', organization: 'IT' },
    });
    await prisma.loan.create({
      data: {
        id: loanId,
        borrowerId: customerId,
        category: 'PERSONAL',
        status: 'APPROVED',
        interestRate: '0.06',
        managementFeeRate: '0.025',
        tenure: 6,
        principal: '100000',
      },
    });
  });

  afterAll(async () => {
    await purge(prisma);
    if (savedSettings) {
      const { id, updatedAt, ...values } = savedSettings;
      void updatedAt;
      await prisma.settings.update({ where: { id }, data: values });
    } else {
      await prisma.settings.deleteMany({ where: { id: 1 } });
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await ledger.assertInvariants(loanId);
  });

  it('disburses: ₦100,000 at 6 % for 6 months owes ₦136,000, first deduction ₦22,666.67', async () => {
    const result = await ledger.disburseLoan(loanId, ACTOR);
    expect([fixed(result.interest), fixed(result.owed), fixed(result.monthly)]).toEqual(['36000.00', '136000.00', '22666.67']);

    const balances = await ledger.balances(loanId);
    expect(fixed(balances.managementFee)).toBe('2500.00');
    expect(balances.remainingMonths).toBe(6);
    expect(fixed((await deductionIn('JANUARY')).expected)).toBe('22666.67');
    expect(heard.map((e) => e.name)).toContain('loan.disbursed');
    await expect(ledger.disburseLoan(loanId, ACTOR)).rejects.toThrow('Only an approved loan can be disbursed');
  });

  it('submits January: one START row in the file, the month frozen, February opened', async () => {
    at(`${YEAR}-01-25T09:00:00Z`);
    const january = await periods.ensure(period('JANUARY'));
    const preview = await variation.preview(january.id);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({
      action: 'START',
      reasons: ['NEW_LOAN'],
      externalId,
      command: 'IT COMMAND',
      tenure: 6,
      start: `01/01/${YEAR}`,
      end: `30/06/${YEAR}`,
    });
    expect(fixed(preview.rows[0].amount)).toBe('22666.67');

    const result = await variation.submit(january.id, ACTOR);
    expect(result).toMatchObject({ filePath: `${YEAR}-01.xlsx`, frozen: 1, opened: 1 });
    const file = XLSX.read(uploads[0].body, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(file.Sheets['Payroll changes']);
    expect(rows).toEqual([
      expect.objectContaining({ 'IPPIS NO.': externalId, AMOUNT: 22666.67, 'LOAN BALANCE': 136000, TENURE: 6 }),
    ]);
    expect(uploads[0].bucket).toBe('variations');
    expect((await deductionIn('JANUARY')).status).toBe('AWAITING');
    expect(fixed((await deductionIn('FEBRUARY')).expected)).toBe('22666.67');
    await expect(variation.submit(january.id, ACTOR)).rejects.toThrow('already been submitted');
  });

  it('settles January from payroll by the booked ratio', async () => {
    at(`${YEAR}-02-05T09:00:00Z`);
    const inflow = await payroll('JANUARY', '22666.67');
    const january = await deductionIn('JANUARY');
    const allocation = await ledger.allocatePayment({ loanId, amount: '22666.67', inflowId: inflow.id, deductionId: january.id });
    expect([fixed(allocation.split.principal), fixed(allocation.split.interest)]).toEqual(['16666.67', '6000.00']);
    expect(allocation.deductionStatus).toBe('FULFILLED');
    expect(fixed((await deductionIn('FEBRUARY')).expected)).toBe('22666.67');
    await expect(
      ledger.allocatePayment({ loanId, amount: '1', inflowId: inflow.id }),
    ).rejects.toThrow('already been applied');
  });

  it('leaves an unchanged month out of the file; a short payment is charged at close', async () => {
    at(`${YEAR}-02-20T09:00:00Z`);
    const february = await periods.ensure(period('FEBRUARY'));
    expect((await variation.preview(february.id)).rows).toEqual([]);
    await variation.submit(february.id, ACTOR);
    expect(fixed((await deductionIn('MARCH')).expected)).toBe('22666.67');
    const january = await periods.ensure(period('JANUARY'));
    expect(await closer.close(january.id, ACTOR)).toMatchObject({ closed: true, failed: 0, partial: 0, penalties: 0 });

    at(`${YEAR}-03-05T09:00:00Z`);
    const inflow = await payroll('FEBRUARY', '10000');
    const februaryDeduction = await deductionIn('FEBRUARY');
    const allocation = await ledger.allocatePayment({ loanId, amount: '10000', inflowId: inflow.id, deductionId: februaryDeduction.id });
    expect(allocation.deductionStatus).toBe('PARTIAL');

    const summary = await closer.close(february.id, ACTOR);
    expect(summary).toMatchObject({ closed: true, partial: 1, penalties: 1, penaltyTotal: 1266.67, proposals: 1 });
    const balances = await ledger.balances(loanId);
    expect([fixed(balances.owed), fixed(balances.outstanding), balances.tenure]).toEqual(['137266.67', '104600.00', 6]);
    // ₦104,600 over the 4 months left: ₦26,150, over the ₦20,000 cap, so a +2 extension is proposed.
    expect(fixed((await deductionIn('MARCH')).expected)).toBe('26150.00');
    expect(heard.map((e) => e.name)).toEqual(expect.arrayContaining(['penalty.applied', 'tenure-change.proposed']));
  });

  it('re-running a close skips finished rows: one penalty, one proposal', async () => {
    const february = await periods.ensure(period('FEBRUARY'));
    // As if the first run died before marking the period closed.
    await prisma.payrollPeriod.update({ where: { id: february.id }, data: { closedAt: null } });
    expect(await closer.close(february.id, ACTOR)).toMatchObject({ closed: true, partial: 0, penalties: 0, proposals: 0 });
    expect(await prisma.microLoan.count({ where: { loanId, purpose: 'PENALTY' } })).toBe(1);
    expect(await prisma.tenureChange.count({ where: { loanId } })).toBe(1);
    await expect(closer.close(february.id, ACTOR)).rejects.toThrow('already closed');
  });

  it('approves the proposal once; a second approval is a 409', async () => {
    const proposal = await prisma.tenureChange.findFirstOrThrow({ where: { loanId, status: 'PENDING' } });
    expect(proposal).toMatchObject({ reason: 'DEFAULT', monthsDelta: 2, requestedById: null });
    await tenureChanges.approve(proposal.id, ACTOR);
    await expect(tenureChanges.approve(proposal.id, ACTOR)).rejects.toThrow('Already decided by another admin');
    expect((await ledger.balances(loanId)).tenure).toBe(8);
    expect(fixed((await deductionIn('MARCH')).expected)).toBe('17433.33');
  });

  it('amends March with the reasons the amount moved', async () => {
    at(`${YEAR}-03-20T09:00:00Z`);
    const march = await periods.ensure(period('MARCH'));
    const [row] = (await variation.preview(march.id)).rows;
    expect(row).toMatchObject({ action: 'AMEND', reasons: ['DEFAULT', 'TENURE_CHANGE'], tenure: 6, end: `31/08/${YEAR}` });
    expect([fixed(row.amount), fixed(row.balance)]).toEqual(['17433.33', '104600.00']);
    await variation.submit(march.id, ACTOR);
  });

  it('tops up with +2 months: interest on the months left after the change', async () => {
    at(`${YEAR}-03-22T09:00:00Z`);
    const topup = await ledger.requestTopup({ loanId, amount: '50000', requestedById: ACTOR, monthsDelta: 2 });
    await expect(ledger.requestTopup({ loanId, amount: '1000' })).rejects.toThrow('already has a top-up');
    await ledger.approveTopup(topup.id, ACTOR);
    const result = await ledger.disburseTopup(topup.id, ACTOR);
    // Tenure 8 → 10 with 3 months sent: 7 left, so 50,000 × 6 % × 7.
    expect([fixed(result.interest), result.remainingMonths, fixed(result.monthly)]).toEqual(['21000.00', 7, '22595.24']);
    const balances = await ledger.balances(loanId);
    expect([fixed(balances.booked.principal), fixed(balances.managementFee), balances.tenure]).toEqual([
      '150000.00',
      '3750.00',
      10,
    ]);
  });

  it('pays March, then a liquidation clears every component: REPAID, and April becomes a STOP', async () => {
    at(`${YEAR}-04-05T09:00:00Z`);
    const inflow = await payroll('MARCH', '17433.33');
    const march = await deductionIn('MARCH');
    const allocation = await ledger.allocatePayment({ loanId, amount: '17433.33', inflowId: inflow.id, deductionId: march.id });
    expect(fixed(allocation.split.penalty)).toBe('1266.67');

    const { outstanding } = await ledger.balances(loanId);
    const request = await liquidations.request({ customerId, amount: outstanding, proofPath: `proofs/${loanId}.pdf` });
    await expect(liquidations.request({ customerId, amount: outstanding.plus(1), proofPath: 'x' })).rejects.toThrow('more than');
    const { allocation: payoff } = await liquidations.decide(request.id, { approve: true }, ACTOR);
    expect(payoff?.repaid).toBe(true);
    await expect(liquidations.decide(request.id, { approve: false, note: 'late' }, ACTOR)).rejects.toThrow(
      'Already decided by another admin',
    );

    const balances = await ledger.balances(loanId);
    expect(balances.status).toBe('REPAID');
    expect(fixed(balances.outstanding)).toBe('0.00');
    for (const part of ['principal', 'interest', 'penalty'] as const) {
      expect(fixed(balances.collected[part])).toBe(fixed(balances.booked[part]));
    }
    expect(fixed((await deductionIn('APRIL')).expected)).toBe('0.00');
    expect(heard.map((e) => e.name)).toEqual(expect.arrayContaining(['liquidation.decided', 'loan.repaid']));

    const april = await periods.ensure(period('APRIL'));
    const [row] = (await variation.preview(april.id)).rows;
    expect(row).toMatchObject({ action: 'STOP', tenure: 0, reasons: ['TOPUP', 'LIQUIDATION'] });
    expect(fixed(row.amount)).toBe('0.00');
    expect(await variation.submit(april.id, ACTOR)).toMatchObject({ frozen: 1, opened: 0 });
  });

  it('keeps owed = Σ microloans and repaid = Σ repayments, and the statement balances', async () => {
    const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
    expect([fixed(loan.owed), fixed(loan.repaid)]).toEqual(['208266.67', '208266.67']);

    const statement = await statements.lines({ loanId }, { from: period('JANUARY'), to: period('DECEMBER') }, 'admin');
    expect(statement).toMatchObject({ opening: 0, debits: 208266.67, credits: 208266.67, closing: 0 });
    expect(statement.lines).toHaveLength(9);
    expect(statement.lines[0]).toMatchObject({ type: 'DISBURSEMENT', managementFee: 2500 });

    const customerCopy = await statements.lines({ customerId }, { from: period('JANUARY'), to: period('DECEMBER') }, 'customer');
    expect(customerCopy.closing).toBe(0);
    expect(customerCopy.lines.some((line) => 'managementFee' in line || 'split' in line)).toBe(false);
  });
});
