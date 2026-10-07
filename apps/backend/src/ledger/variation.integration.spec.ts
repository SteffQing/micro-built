import 'dotenv/config';
import type { Period } from '@microbuilt/shared';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type Month } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from 'src/database/prisma.service';
import type { SupabaseService } from 'src/database/supabase.service';
import { findOrCreateOrganization } from 'src/organizations/organizations';
import { DeductionsService } from './deductions.service';
import type { LedgerClock } from './ledger.clock';
import { LedgerService } from './ledger.service';
import { LedgerTx } from './ledger.tx';
import { PeriodsService } from './periods.service';
import { TenureChangesService } from './tenure-changes.service';
import { VARIATION_COLUMNS, VARIATION_SHEET } from './variation';
import { VariationService } from './variation.service';

// Per-organization variations (PLAN_V2 R1–R3) against a real database, in 2099 so no real payroll month is
// touched. Everything created is deleted afterwards (and any leftovers of an earlier crashed run first).
//
//   LEDGER_IT=1 pnpm exec jest src/ledger/variation.integration.spec.ts
const RUN = process.env.LEDGER_IT === '1';
const describeIT = RUN ? describe : describe.skip;
if (RUN) jest.setTimeout(300_000);

const YEAR = 2099;
const PREFIX = 'MB-VIT';
/** Every organization this spec creates starts with this (names are matched lower-case). */
const ORG_PREFIX = 'vit ';
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
  const organizationIds = (
    await prisma.organization.findMany({ where: { normalizedName: { startsWith: ORG_PREFIX } }, select: { id: true } })
  ).map((o) => o.id);
  const variationIds = (
    await prisma.variation.findMany({
      where: { OR: [{ periodId: { in: periodIds } }, { organizationId: { in: organizationIds } }] },
      select: { id: true },
    })
  ).map((v) => v.id);
  const [microLoans, changes, inflows] = await Promise.all([
    prisma.microLoan.findMany({ where: { loanId: { in: loanIds } }, select: { id: true } }),
    prisma.tenureChange.findMany({ where: { loanId: { in: loanIds } }, select: { id: true } }),
    prisma.paymentInflow.findMany({
      where: { OR: [{ customerId: { in: customerIds } }, { periodId: { in: periodIds } }] },
      select: { id: true },
    }),
  ]);
  const inflowIds = inflows.map((i) => i.id);
  const entityIds = [
    ...loanIds,
    ...periodIds,
    ...variationIds,
    ...[...microLoans, ...changes, ...inflows].map((row) => row.id),
  ];
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } }),
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
    prisma.voucher.deleteMany({ where: { variationId: { in: variationIds } } }),
    prisma.variation.deleteMany({ where: { id: { in: variationIds } } }),
    prisma.loan.deleteMany({ where: { id: { in: loanIds } } }),
    prisma.period.deleteMany({ where: { id: { in: periodIds } } }),
    prisma.customerPayroll.deleteMany({ where: { externalId: { startsWith: PREFIX } } }),
    prisma.organization.deleteMany({ where: { id: { in: organizationIds } } }),
    prisma.user.deleteMany({ where: { id: { in: customerIds } } }),
  ]);
}

interface Borrower {
  customerId: string;
  externalId: string;
}

describeIT('variations per organization (integration)', () => {
  const tag = Date.now().toString(36).toUpperCase();

  let now = new Date(`${YEAR}-01-10T09:00:00Z`);
  const clock = { now: () => now } as LedgerClock;
  const prisma = new PrismaService();
  const events = new EventEmitter2();
  const uploads: { bucket: string; path: string; body: Buffer }[] = [];
  const removed: string[] = [];
  const supabase = {
    uploadPrivate: async (bucket: string, path: string, body: Buffer) => {
      uploads.push({ bucket, path, body });
      return path;
    },
    removePrivate: async (_bucket: string, path: string) => void removed.push(path),
  } as unknown as SupabaseService;

  const ledgerTx = new LedgerTx(prisma, events, clock);
  const periods = new PeriodsService(prisma, clock);
  const deductions = new DeductionsService(prisma, periods, clock);
  const tenureChanges = new TenureChangesService(prisma, ledgerTx, deductions);
  const ledger = new LedgerService(prisma, ledgerTx, deductions, tenureChanges, periods, clock);
  const variation = new VariationService(prisma, ledgerTx, periods, supabase, clock);

  const at = (iso: string) => (now = new Date(iso));
  let sequence = 0;
  let loansMade: string[] = [];

  /** A new organization: the spec's prefix keeps it apart from real ones and lets the purge find it. */
  const organization = (label: string) => findOrCreateOrganization(prisma, `VIT ${label} ${tag}`, null);

  async function borrower(organizationId: string, label: string): Promise<Borrower> {
    const customerId = `${PREFIX}${tag}${++sequence}`;
    const externalId = `${customerId}-IPPIS`;
    await prisma.user.create({
      data: {
        id: customerId,
        name: `${label} ${tag}`,
        email: `${customerId.toLowerCase()}@it.microbuiltprime.com`,
        status: 'ACTIVE',
        customer: { create: { externalId } },
      },
    });
    await prisma.customerPayroll.create({
      data: { externalId, netPay: '200000', command: 'IT COMMAND', organizationId },
    });
    return { customerId, externalId };
  }

  /** A ₦100,000 loan over 6 months at 6 %: ₦136,000 owed, ₦22,666.67 a month. Disbursed at the clock's `iso`. */
  async function disbursed(organizationId: string, label: string, iso: string) {
    const who = await borrower(organizationId, label);
    const loanId = `LN-VIT${tag}${++sequence}`;
    await prisma.loan.create({
      data: {
        id: loanId,
        borrowerId: who.customerId,
        category: 'PERSONAL',
        status: 'APPROVED',
        interestRate: '0.06',
        managementFeeRate: '0.025',
        tenure: 6,
        principal: '100000',
      },
    });
    loansMade.push(loanId);
    at(iso);
    await ledger.disburseLoan(loanId, ACTOR);
    return { ...who, loanId };
  }

  async function topUp(loanId: string, amount: string) {
    const request = await ledger.requestTopup({ loanId, amount, requestedById: ACTOR });
    await ledger.approveTopup(request.id, ACTOR);
    await ledger.disburseTopup(request.id, ACTOR);
  }

  const deductionIn = (loanId: string, month: Month) =>
    prisma.deduction.findFirst({ where: { loanId, period: { year: YEAR, month } } });
  const variationOf = (organizationId: string, month: Month) =>
    prisma.variation.findFirst({ where: { organizationId, period: { year: YEAR, month } } });
  const keptVersions = async (organizationId: string, month: Month) =>
    (await variation.preview(organizationId, period(month))).variation?.versions;

  /** A stored file, row by row (the header first), as the last upload to that path wrote it. */
  function sheetRows(path: string): unknown[][] {
    const upload = [...uploads].reverse().find((u) => u.path === path);
    if (!upload) throw new Error(`Nothing was uploaded to ${path}`);
    const book = XLSX.read(upload.body, { type: 'buffer' });
    return XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[VARIATION_SHEET], { header: 1, defval: '' });
  }
  const columns = [...VARIATION_COLUMNS];

  beforeAll(async () => {
    await prisma.$connect();
    await purge(prisma);
  });

  afterAll(async () => {
    await purge(prisma);
    await prisma.$disconnect();
  });

  beforeEach(() => {
    loansMade = [];
  });

  afterEach(async () => {
    for (const loanId of loansMade) await ledger.assertInvariants(loanId);
  });

  it("PLAN_V2's example: a month already generated moves later loans to the next one, until it is generated again", async () => {
    const navy = await organization('Navy');
    // C was disbursed before October's variation; its first deduction is in October.
    const c = await disbursed(navy.id, 'Loan C', `${YEAR}-10-02T09:00:00Z`);
    expect(fixed((await deductionIn(c.loanId, 'OCTOBER'))!.expected)).toBe('22666.67');

    // Navy's October is generated on 15 Oct.
    at(`${YEAR}-10-15T09:00:00Z`);
    const first = await variation.generate(navy.id, period('OCTOBER'), ACTOR);
    expect(first).toMatchObject({
      organization: navy.name,
      period: `OCTOBER ${YEAR}`,
      version: 1,
      rows: 1,
      frozen: 1,
      filePath: `${navy.id}/${YEAR}-10/v1.xlsx`,
    });
    expect(await deductionIn(c.loanId, 'OCTOBER')).toMatchObject({ status: 'AWAITING', variationId: first.variationId });
    // Frozen, and nothing yet for next month.
    expect(await deductionIn(c.loanId, 'NOVEMBER')).toBeNull();
    const v1 = sheetRows(first.filePath);
    expect(v1[0]).toEqual(columns);
    expect(v1).toHaveLength(2);

    // Loan A is disbursed on 20 Oct → its first deduction opens in November, because October already has a variation.
    const a = await disbursed(navy.id, 'Loan A', `${YEAR}-10-20T09:00:00Z`);
    expect(await deductionIn(a.loanId, 'OCTOBER')).toBeNull();
    expect(await deductionIn(a.loanId, 'NOVEMBER')).toMatchObject({ status: 'OPEN', variationId: null });

    // A top-up on 21 Oct to loan C, whose October deduction is AWAITING → C gets an OPEN November row.
    at(`${YEAR}-10-21T09:00:00Z`);
    await topUp(c.loanId, '50000');
    expect(await deductionIn(c.loanId, 'OCTOBER')).toMatchObject({ status: 'AWAITING' });
    expect(fixed((await deductionIn(c.loanId, 'OCTOBER'))!.expected)).toBe('22666.67');
    expect(await deductionIn(c.loanId, 'NOVEMBER')).toMatchObject({ status: 'OPEN' });
    expect(fixed((await deductionIn(c.loanId, 'NOVEMBER'))!.expected)).toBe('35666.67');

    // October is regenerated on 28 Oct → A is pulled into October (disbursed in October, so October's salary can
    // carry it); C's November row is folded back into October and recomputed: ₦201,000 over its 6 months.
    at(`${YEAR}-10-28T09:00:00Z`);
    const preview = await variation.preview(navy.id, period('OCTOBER'));
    expect(preview).toMatchObject({ frozen: 2, skipped: false, generateBlockedBy: null });
    expect(preview.variation).toMatchObject({ version: 1, lock: null, versions: [1] });
    const second = await variation.generate(navy.id, period('OCTOBER'), ACTOR);
    expect(second).toMatchObject({ variationId: first.variationId, version: 2, rows: 2, frozen: 2 });
    expect(fixed(second.amount)).toBe('56166.67');
    expect(await deductionIn(c.loanId, 'NOVEMBER')).toBeNull();
    expect(await deductionIn(a.loanId, 'NOVEMBER')).toBeNull();
    expect(await deductionIn(c.loanId, 'OCTOBER')).toMatchObject({ status: 'AWAITING', variationId: first.variationId });
    expect(fixed((await deductionIn(c.loanId, 'OCTOBER'))!.expected)).toBe('33500.00');
    expect(await deductionIn(a.loanId, 'OCTOBER')).toMatchObject({ status: 'AWAITING', variationId: first.variationId });
    expect(fixed((await deductionIn(a.loanId, 'OCTOBER'))!.expected)).toBe('22666.67');
    const v2 = sheetRows(second.filePath);
    expect(v2).toHaveLength(3);
    expect(v2.slice(1).map((row) => [row[1], row[5]]).sort()).toEqual(
      [
        [a.externalId, 22666.67],
        [c.externalId, 33500],
      ].sort(),
    );

    // Loan B is disbursed on 2 Nov, while October still waits for its voucher: its first month is November.
    const b = await disbursed(navy.id, 'Loan B', `${YEAR}-11-02T09:00:00Z`);
    expect(await deductionIn(b.loanId, 'OCTOBER')).toBeNull();
    expect(await deductionIn(b.loanId, 'NOVEMBER')).toMatchObject({ status: 'OPEN' });

    // A regeneration of October on 3 Nov does not pull B in.
    at(`${YEAR}-11-03T09:00:00Z`);
    const third = await variation.generate(navy.id, period('OCTOBER'), ACTOR);
    expect(third).toMatchObject({ version: 3, rows: 2, frozen: 2 });
    expect(await deductionIn(b.loanId, 'NOVEMBER')).toMatchObject({ status: 'OPEN', variationId: null });
    expect(await deductionIn(b.loanId, 'OCTOBER')).toBeNull();

    // November has B waiting, and October being unlocked doesn't stop it going out. C and A, which October froze,
    // are frozen into it too at the amounts payroll already has: they stay off the file.
    const november = await variation.preview(navy.id, period('NOVEMBER'));
    expect(november).toMatchObject({ frozen: 3, generateBlockedBy: null, counts: { START: 1, AMEND: 0, STOP: 0 } });
    expect(november.rows.map((row) => row.loanId)).toEqual([b.loanId]);

    expect((await variation.history(navy.id)).map((h) => [h.period.ym, h.version, h.lock])).toEqual([
      [`${YEAR}-10`, 3, null],
    ]);
    expect(removed).toEqual([]);
  });

  it("counts a loan's prior only within the organization", async () => {
    const x = await organization('Prior X');
    const y = await organization('Prior Y');
    const l = await disbursed(x.id, 'Loan L', `${YEAR}-03-05T09:00:00Z`);
    const m = await disbursed(x.id, 'Loan M', `${YEAR}-03-06T09:00:00Z`);
    // H is history from before variations: its March row was settled with no variation, in organization Y.
    const h = await disbursed(y.id, 'Loan H', `${YEAR}-03-07T09:00:00Z`);
    await prisma.deduction.updateMany({
      where: { loanId: h.loanId, status: 'OPEN' },
      data: { status: 'FULFILLED', settledAt: now, penalizedAt: now },
    });

    at(`${YEAR}-03-15T09:00:00Z`);
    const march = await variation.generate(x.id, period('MARCH'), ACTOR);
    expect(march).toMatchObject({ rows: 2, frozen: 2 });

    // L's borrower moves to Y (an approved switch). March stays with X; the next month goes with Y.
    await prisma.customerPayroll.update({ where: { externalId: l.externalId }, data: { organizationId: y.id } });
    // Regenerating X's March keeps L on the file: its March deduction stays with the variation it was sent in.
    const marchAgain = await variation.generate(x.id, period('MARCH'), ACTOR);
    expect(marchAgain).toMatchObject({ version: 2, rows: 2, frozen: 2 });
    expect(sheetRows(marchAgain.filePath).slice(1).map((row) => row[1]).sort()).toEqual([l.externalId, m.externalId].sort());
    at(`${YEAR}-04-02T09:00:00Z`);
    for (const loanId of [l.loanId, m.loanId, h.loanId]) await deductions.refreshOpen(loanId);
    expect(await deductionIn(l.loanId, 'APRIL')).toMatchObject({ status: 'OPEN' });
    expect(await deductionIn(l.loanId, 'MARCH')).toMatchObject({ status: 'AWAITING', variationId: march.variationId });

    // X: M's April amount equals what X's payroll was sent, so it is frozen but not on the file. L is no longer X's,
    // but X's payroll still deducts it: April, X's first variation since, stops it (nothing frozen for it).
    const forX = await variation.preview(x.id, period('APRIL'));
    expect(forX).toMatchObject({ frozen: 1, counts: { START: 0, AMEND: 0, STOP: 1 }, skipped: false, generateBlockedBy: null });
    expect(forX.rows).toEqual([
      expect.objectContaining({ loanId: l.loanId, action: 'STOP', tenure: 0, reasons: ['TRANSFER'] }),
    ]);
    expect(fixed(forX.rows[0].amount)).toBe('0.00');
    const aprilForX = await variation.generate(x.id, period('APRIL'), ACTOR);
    expect(aprilForX).toMatchObject({ rows: 1, frozen: 1, counts: { STOP: 1 } });
    expect(await deductionIn(l.loanId, 'APRIL')).toMatchObject({ status: 'OPEN', variationId: null });
    // Once April is generated it keeps showing the STOP it sent; May no longer lists it.
    expect((await variation.preview(x.id, period('APRIL'))).counts).toMatchObject({ STOP: 1 });
    at(`${YEAR}-05-02T09:00:00Z`);
    await deductions.refreshOpen(m.loanId);
    expect((await variation.preview(x.id, period('MAY'))).rows.map((row) => row.loanId)).not.toContain(l.loanId);
    at(`${YEAR}-04-02T09:00:00Z`);

    // Y: L's March row belongs to X's variation, so for Y it starts afresh; H's history row (no variation) counts
    // as Y's prior, so H is an amendment and not a start.
    const forY = await variation.preview(y.id, period('APRIL'));
    expect(forY).toMatchObject({ frozen: 2, counts: { START: 1, AMEND: 1, STOP: 0 }, generateBlockedBy: null });
    const byLoan = new Map(forY.rows.map((row) => [row.loanId, row]));
    expect(byLoan.get(l.loanId)).toMatchObject({ action: 'START', reasons: ['NEW_LOAN'] });
    expect(fixed(byLoan.get(l.loanId)!.amount)).toBe('22666.67');
    expect(byLoan.get(h.loanId)).toMatchObject({ action: 'AMEND' });
    expect(fixed(byLoan.get(h.loanId)!.amount)).toBe('27200.00');

    // Y has no variation for March (X sent it), and generating its April is not held up by it.
    const aprilForY = await variation.generate(y.id, period('APRIL'), ACTOR);
    expect(aprilForY).toMatchObject({ version: 1, rows: 2, frozen: 2 });
    expect(await deductionIn(l.loanId, 'MARCH')).toMatchObject({ variationId: march.variationId });
  });

  it('keeps the older file versions until the variation locks', async () => {
    const org = await organization('Versions');
    const loan = await disbursed(org.id, 'Loan V', `${YEAR}-06-02T09:00:00Z`);

    at(`${YEAR}-06-10T09:00:00Z`);
    const first = await variation.generate(org.id, period('JUNE'), ACTOR);
    at(`${YEAR}-06-20T09:00:00Z`);
    const second = await variation.generate(org.id, period('JUNE'), ACTOR);
    expect([first.version, second.version]).toEqual([1, 2]);
    expect(first.variationId).toBe(second.variationId);
    expect(await keptVersions(org.id, 'JUNE')).toEqual([1, 2]);
    expect(uploads.filter((u) => u.path.startsWith(`${org.id}/`)).map((u) => u.path)).toEqual([
      `${org.id}/${YEAR}-06/v1.xlsx`,
      `${org.id}/${YEAR}-06/v2.xlsx`,
    ]);
    expect(removed).toEqual([]);
    expect(await variation.file(first.variationId)).toMatchObject({ version: 2, path: `${org.id}/${YEAR}-06/v2.xlsx` });
    expect(await variation.file(first.variationId, 1)).toMatchObject({
      version: 1,
      path: `${org.id}/${YEAR}-06/v1.xlsx`,
      fileName: expect.stringMatching(/^variation-vit-versions-.*-2099-06-v1\.xlsx$/),
    });
    await expect(variation.file(first.variationId, 3)).rejects.toThrow("Version 3 of this variation isn't stored");

    // The voucher locks it: only the current version is kept, and it can't be generated again.
    await prisma.voucher.create({
      data: { variationId: first.variationId, fileHash: `vit-${tag}-voucher`, filename: 'JUNE.xlsx', uploadedById: ACTOR },
    });
    const locked = await variation.preview(org.id, period('JUNE'));
    expect(locked.variation).toMatchObject({
      version: 2,
      versions: [2],
      lock: { kind: 'VOUCHER', filename: 'JUNE.xlsx' },
    });
    // What a locked variation shows is its frozen rows, whatever happens to the loans after.
    expect(locked.rows.map((row) => [row.loanId, row.action])).toEqual([[loan.loanId, 'START']]);
    await expect(variation.file(first.variationId, 1)).rejects.toThrow("Version 1 of this variation isn't stored");
    expect(await variation.file(first.variationId)).toMatchObject({ version: 2 });
    await expect(variation.generate(org.id, period('JUNE'), ACTOR)).rejects.toThrow('is locked: its voucher is in');
    expect((await variation.generationCheck(org.id, period('JUNE'))).blockedBy).toMatch(/locked/);
    expect((await variation.history(org.id)).map((h) => [h.version, h.lock?.kind])).toEqual([[2, 'VOUCHER']]);
  });

  it('locks a variation with a no payroll as well', async () => {
    const org = await organization('No payroll');
    await disbursed(org.id, 'Loan N', `${YEAR}-06-02T09:00:00Z`);
    at(`${YEAR}-06-10T09:00:00Z`);
    const generated = await variation.generate(org.id, period('JUNE'), ACTOR);
    await variation.generate(org.id, period('JUNE'), ACTOR);
    await prisma.variation.update({ where: { id: generated.variationId }, data: { noPayrollReason: 'Payroll sent nothing' } });

    const { variation: state } = await variation.preview(org.id, period('JUNE'));
    expect(state).toMatchObject({ version: 2, versions: [2], lock: { kind: 'NO_PAYROLL', reason: 'Payroll sent nothing' } });
    await expect(variation.generate(org.id, period('JUNE'), ACTOR)).rejects.toThrow('marked No payroll');
  });

  it('freezes the unchanged loans but keeps them off the file', async () => {
    const org = await organization('Unchanged');
    const p1 = await disbursed(org.id, 'Loan P1', `${YEAR}-07-02T09:00:00Z`);
    const p2 = await disbursed(org.id, 'Loan P2', `${YEAR}-07-03T09:00:00Z`);
    at(`${YEAR}-07-10T09:00:00Z`);
    const july = await variation.generate(org.id, period('JULY'), ACTOR);
    expect(july).toMatchObject({ rows: 2, frozen: 2 });

    // Payroll keeps what it was sent. P2 is topped up, P1 isn't; each opens August's row.
    at(`${YEAR}-07-20T09:00:00Z`);
    await topUp(p2.loanId, '50000');
    await deductions.refreshOpen(p1.loanId);
    expect(fixed((await deductionIn(p1.loanId, 'AUGUST'))!.expected)).toBe('22666.67');
    expect(fixed((await deductionIn(p2.loanId, 'AUGUST'))!.expected)).toBe('35666.67');

    // July is still unlocked: August goes out anyway.
    at(`${YEAR}-08-05T09:00:00Z`);
    const august = await variation.generate(org.id, period('AUGUST'), ACTOR);
    expect(august).toMatchObject({ version: 1, rows: 1, frozen: 2 });
    expect(await deductionIn(p1.loanId, 'AUGUST')).toMatchObject({ status: 'AWAITING', variationId: august.variationId });
    expect(await deductionIn(p2.loanId, 'AUGUST')).toMatchObject({ status: 'AWAITING', variationId: august.variationId });
    const file = sheetRows(august.filePath);
    expect(file).toHaveLength(2);
    // [S/NO, IPPIS, name, command, balance, amount, tenure, start, end]
    expect(file[1]).toEqual([1, p2.externalId, expect.any(String), 'IT COMMAND', 201000, 35666.67, 5, `01/08/${YEAR}`, `31/12/${YEAR}`]);
    expect(file.flat()).not.toContain(p1.externalId);

    // Both months are generated and neither is locked.
    expect((await variation.history(org.id)).map((h) => [h.period.ym, h.version, h.lock])).toEqual([
      [`${YEAR}-08`, 1, null],
      [`${YEAR}-07`, 1, null],
    ]);
    const preview = await variation.preview(org.id, period('AUGUST'));
    expect(preview).toMatchObject({ frozen: 2, counts: { START: 0, AMEND: 1, STOP: 0 } });
    expect(preview.rows.map((row) => [row.loanId, row.action, row.reasons])).toEqual([[p2.loanId, 'AMEND', ['TOPUP']]]);
  });

  it('writes a header-only file when nothing changed', async () => {
    const org = await organization('Header only');
    const q1 = await disbursed(org.id, 'Loan Q1', `${YEAR}-07-02T09:00:00Z`);
    const q2 = await disbursed(org.id, 'Loan Q2', `${YEAR}-07-03T09:00:00Z`);
    at(`${YEAR}-07-10T09:00:00Z`);
    await variation.generate(org.id, period('JULY'), ACTOR);
    for (const loanId of [q1.loanId, q2.loanId]) await deductions.refreshOpen(loanId);

    at(`${YEAR}-08-05T09:00:00Z`);
    const august = await variation.generate(org.id, period('AUGUST'), ACTOR);
    expect(august).toMatchObject({ version: 1, rows: 0, frozen: 2 });
    expect(fixed(august.amount)).toBe('0.00');
    expect(sheetRows(august.filePath)).toEqual([columns]);
    for (const loanId of [q1.loanId, q2.loanId]) {
      expect(await deductionIn(loanId, 'AUGUST')).toMatchObject({ status: 'AWAITING', variationId: august.variationId });
    }
    const preview = await variation.preview(org.id, period('AUGUST'));
    expect(preview).toMatchObject({ rows: [], counts: { START: 0, AMEND: 0, STOP: 0 }, frozen: 2, skipped: false });
  });

  it('skips an organization with no deductions, and one whose first loans start later', async () => {
    const empty = await organization('Empty');
    await borrower(empty.id, 'Nobody borrowed');
    const check = await variation.generationCheck(empty.id, period('OCTOBER'));
    expect(check).toMatchObject({ skipped: true, blockedBy: `${empty.name} has no deductions for OCTOBER ${YEAR}` });
    expect(await variation.preview(empty.id, period('OCTOBER'))).toMatchObject({
      variation: null,
      rows: [],
      frozen: 0,
      skipped: true,
    });
    const uploadsBefore = uploads.length;
    await expect(variation.generate(empty.id, period('OCTOBER'), ACTOR)).rejects.toThrow('has no deductions');
    expect(await variationOf(empty.id, 'OCTOBER')).toBeNull();
    expect(uploads).toHaveLength(uploadsBefore);

    // Late's first loan starts in November: October is skipped, and November doesn't wait for it.
    const late = await organization('Late');
    const loan = await disbursed(late.id, 'Loan late', `${YEAR}-11-03T09:00:00Z`);
    expect((await variation.generationCheck(late.id, period('OCTOBER'))).skipped).toBe(true);
    const november = await variation.generate(late.id, period('NOVEMBER'), ACTOR);
    expect(november).toMatchObject({ version: 1, rows: 1, frozen: 1 });
    expect(await deductionIn(loan.loanId, 'NOVEMBER')).toMatchObject({ status: 'AWAITING' });
  });

  it('generates nothing for an organization waiting for a super admin, until it is approved', async () => {
    at(`${YEAR}-09-25T09:00:00Z`);
    // Named by an admin (the system actor stands in: the column points at an admin row).
    const pending = await findOrCreateOrganization(prisma, `VIT Pending ${tag}`, { id: ACTOR, role: 'ADMIN' });
    expect(pending).toMatchObject({ status: 'PENDING', requestedById: ACTOR, created: true });
    await disbursed(pending.id, 'Loan P', `${YEAR}-09-02T09:00:00Z`);

    const reason = `${pending.name} is waiting for a super admin to approve it (or merge it into the organization it misspelt)`;
    expect((await variation.generationCheck(pending.id, period('SEPTEMBER'))).blockedBy).toBe(reason);
    await expect(variation.generate(pending.id, period('SEPTEMBER'), ACTOR)).rejects.toThrow(reason);
    // The name reused later, by anyone, is the same organization, still waiting.
    expect(await findOrCreateOrganization(prisma, ` vit  pending ${tag} `, null)).toMatchObject({
      id: pending.id,
      status: 'PENDING',
      created: false,
    });

    await prisma.organization.update({ where: { id: pending.id }, data: { status: 'ACTIVE' } });
    expect((await variation.generationCheck(pending.id, period('SEPTEMBER'))).blockedBy).toBeNull();
  });

  describe('month order', () => {
    // One organization through the three rules, in order: P−1 never generated, P allowed once it is, P−1 closed to
    // changes once P exists.
    let org: { id: string; name: string };
    let loanId: string;

    beforeAll(async () => {
      org = await organization('Order');
      loanId = (await disbursed(org.id, 'Loan Z', `${YEAR}-09-02T09:00:00Z`)).loanId;
    });

    it('refuses a month while the one before it was never generated', async () => {
      at(`${YEAR}-10-05T09:00:00Z`);
      const reason = `Generate ${org.name}'s SEPTEMBER ${YEAR} variation first`;
      expect(await variation.generationCheck(org.id, period('OCTOBER'))).toMatchObject({ skipped: false, blockedBy: reason });
      expect((await variation.preview(org.id, period('OCTOBER'))).generateBlockedBy).toBe(reason);
      const uploadsBefore = uploads.length;
      await expect(variation.generate(org.id, period('OCTOBER'), ACTOR)).rejects.toThrow(reason);
      expect(await variationOf(org.id, 'OCTOBER')).toBeNull();
      expect(uploads).toHaveLength(uploadsBefore);
      // September's own row is untouched.
      expect(await deductionIn(loanId, 'SEPTEMBER')).toMatchObject({ status: 'OPEN', variationId: null });
    });

    it('generates a month while the one before it is generated but unlocked', async () => {
      at(`${YEAR}-09-25T09:00:00Z`);
      const september = await variation.generate(org.id, period('SEPTEMBER'), ACTOR);
      expect(september).toMatchObject({ version: 1, rows: 1, frozen: 1 });

      at(`${YEAR}-10-05T09:00:00Z`);
      expect((await variation.generationCheck(org.id, period('OCTOBER'))).blockedBy).toBeNull();
      const october = await variation.generate(org.id, period('OCTOBER'), ACTOR);
      // The loan had no October row (September froze it): generating makes it, at the amount payroll already has.
      expect(october).toMatchObject({ version: 1, rows: 0, frozen: 1 });
      expect(await deductionIn(loanId, 'OCTOBER')).toMatchObject({ status: 'AWAITING', variationId: october.variationId });
      expect(fixed((await deductionIn(loanId, 'OCTOBER'))!.expected)).toBe('22666.67');
      expect((await variation.history(org.id)).map((h) => [h.period.ym, h.lock])).toEqual([
        [`${YEAR}-10`, null],
        [`${YEAR}-09`, null],
      ]);
    });

    it('refuses a month once the one after it exists', async () => {
      const reason = `${org.name}'s OCTOBER ${YEAR} variation already exists, so SEPTEMBER ${YEAR} can't change any more`;
      expect((await variation.generationCheck(org.id, period('SEPTEMBER'))).blockedBy).toBe(reason);
      await expect(variation.generate(org.id, period('SEPTEMBER'), ACTOR)).rejects.toThrow(reason);
      // It still shows what was sent: its current version's rows.
      const preview = await variation.preview(org.id, period('SEPTEMBER'));
      expect(preview).toMatchObject({ generateBlockedBy: reason, frozen: 1 });
      expect(preview.rows.map((row) => row.action)).toEqual(['START']);
      expect((await variation.preview(org.id, period('SEPTEMBER'))).variation).toMatchObject({ version: 1, versions: [1] });
    });
  });

  it('rolls back a generation that fails, and removes the file it had stored', async () => {
    const org = await organization('Rollback');
    const loan = await disbursed(org.id, 'Loan R', `${YEAR}-02-02T09:00:00Z`);
    at(`${YEAR}-02-10T09:00:00Z`);

    const failing = jest.spyOn(ledgerTx, 'audit').mockRejectedValueOnce(new Error('audit down'));
    await expect(variation.generate(org.id, period('FEBRUARY'), ACTOR)).rejects.toThrow('audit down');
    expect(removed).toContain(`${org.id}/${YEAR}-02/v1.xlsx`);
    expect(await variationOf(org.id, 'FEBRUARY')).toBeNull();
    expect(await deductionIn(loan.loanId, 'FEBRUARY')).toMatchObject({ status: 'OPEN', variationId: null });

    const generated = await variation.generate(org.id, period('FEBRUARY'), ACTOR);
    expect(generated.version).toBe(1);

    // A failed regeneration removes only its own file: the last version stays, and stays current.
    const removedBefore = removed.length;
    failing.mockRejectedValueOnce(new Error('audit down'));
    await expect(variation.generate(org.id, period('FEBRUARY'), ACTOR)).rejects.toThrow('audit down');
    expect(removed.slice(removedBefore)).toEqual([`${org.id}/${YEAR}-02/v2.xlsx`]);
    expect(await variationOf(org.id, 'FEBRUARY')).toMatchObject({ version: 1, filePath: generated.filePath });
    expect(await deductionIn(loan.loanId, 'FEBRUARY')).toMatchObject({ status: 'AWAITING', variationId: generated.variationId });
    failing.mockRestore();
  });

  it('runs two generations at once one after the other', async () => {
    const org = await organization('Concurrent');
    await disbursed(org.id, 'Loan K', `${YEAR}-04-02T09:00:00Z`);
    at(`${YEAR}-04-10T09:00:00Z`);
    const results = await Promise.all([
      variation.generate(org.id, period('APRIL'), ACTOR),
      variation.generate(org.id, period('APRIL'), ACTOR),
    ]);
    expect(results.map((result) => result.version).sort()).toEqual([1, 2]);
    expect(await variationOf(org.id, 'APRIL')).toMatchObject({ version: 2 });
    expect(await prisma.variation.count({ where: { organizationId: org.id } })).toBe(1);
    expect(await keptVersions(org.id, 'APRIL')).toEqual([1, 2]);
  });

  it("moves a switched borrower's OPEN deduction past what the new organization has already generated", async () => {
    const from = await organization('Switch From');
    const to = await organization('Switch To');
    // S's first deduction is OPEN in July; its organization never generated July.
    const s = await disbursed(from.id, 'Loan S', `${YEAR}-07-03T09:00:00Z`);
    // The new organization already sent July and August.
    await disbursed(to.id, 'Loan T', `${YEAR}-07-04T09:00:00Z`);
    at(`${YEAR}-07-20T09:00:00Z`);
    await variation.generate(to.id, period('JULY'), ACTOR);
    at(`${YEAR}-08-05T09:00:00Z`);
    await variation.generate(to.id, period('AUGUST'), ACTOR);

    // The approved switch (ChangeRequestsService.applyOrganization).
    await ledgerTx.transaction(async (tx) => {
      await tx.customerPayroll.update({ where: { externalId: s.externalId }, data: { organizationId: to.id } });
      await ledgerTx.lockLoan(tx, s.loanId);
      await deductions.rehomeOpen(s.loanId, tx);
    });
    expect(await deductionIn(s.loanId, 'JULY')).toBeNull();
    expect(await deductionIn(s.loanId, 'SEPTEMBER')).toMatchObject({ status: 'OPEN', variationId: null });
    expect(fixed((await deductionIn(s.loanId, 'SEPTEMBER'))!.expected)).toBe('22666.67');

    // So the new organization's next month isn't blocked, and lists S as a START.
    const september = await variation.preview(to.id, period('SEPTEMBER'));
    expect(september).toMatchObject({ generateBlockedBy: null, counts: { START: 1 } });
    expect(september.rows.map((row) => row.loanId)).toEqual([s.loanId]);

    // Nothing moves when the OPEN month is still ahead of the organization.
    await ledgerTx.transaction((tx) => deductions.rehomeOpen(s.loanId, tx));
    expect(await deductionIn(s.loanId, 'SEPTEMBER')).toMatchObject({ status: 'OPEN' });
  });
});
