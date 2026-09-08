import { GenerateReports } from 'src/queue/bull/queue.reports';
import * as XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
jest.mock('src/notifications/templates/CustomerReportPDF', () => ({
  __esModule: true,
  default: jest.fn(),
}));
import { PrismaService } from 'src/database/prisma.service';
import { RepaymentObligationService } from './repayment-obligation.service';
import { PayrollVariationService } from './payroll-variation.service';
import { canonicalPeriod, nextPayrollPeriod } from './repayment-plan.logic';
import {
  VariationScheduleMode,
  PayrollVariationFilter,
} from 'src/common/types/report.interface';

// Explicit opt-in. Never use the application's DATABASE_URL for these tests.
const url = process.env.PAYROLL_VARIATION_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('Payroll variation lifecycle (isolated PostgreSQL)', () => {
  let prisma: PrismaService;
  let obligations: RepaymentObligationService;
  let variations: PayrollVariationService;
  const date = canonicalPeriod(new Date());
  const period = (offset = 0) => {
    let value = date;
    for (let i = 0; i < offset; i++) value = nextPayrollPeriod(value);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Lagos',
    })
      .format(value)
      .toUpperCase();
  };
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.pathname !== '/variation_test'
    )
      throw new Error('Use an isolated local database named variation_test');
    prisma = new PrismaService({ datasources: { db: { url } } });
    await prisma.$connect();
    obligations = new RepaymentObligationService(prisma);
    variations = new PayrollVariationService(prisma, obligations);
  });
  beforeEach(async () => {
    const tables = await prisma.$queryRaw<
      { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map(({ tablename }) => '"' + tablename.replace(/"/g, '""') + '"').join(',')} CASCADE`,
    );
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function loan(userId: string, loanId: string, topup = false) {
    if (!topup)
      await prisma.user.create({
        data: {
          id: userId,
          name: `Customer ${userId}`,
          password: 'test-only',
          externalId: `000${userId}`,
          payroll: { create: { command: 'LAGOS', organization: 'TEST' } },
        },
      });
    await prisma.loan.create({
      data: {
        id: loanId,
        borrowerId: userId,
        principal: 120000,
        managementFeeRate: 0,
        interestRate: 0.02,
        tenure: 12,
        category: 'PERSONAL',
        status: 'APPROVED',
        type: topup ? 'Topup' : 'New',
      },
    });
    return obligations.disburseAdvance(loanId, 'TEST-ADMIN');
  }
  async function prepare(
    month: string,
    mode = VariationScheduleMode.SUBMIT,
    changeFilter = PayrollVariationFilter.ALL,
  ) {
    const preview = await variations.preview(month, changeFilter);
    return variations.prepare(
      {
        period: month,
        email: 'test@example.com',
        mode,
        previewHash: preview.previewHash,
        changeFilter,
        submissionNote: 'Test submission',
      },
      'TEST-ADMIN',
    );
  }
  async function confirm(id: string) {
    const delivered: Buffer[] = [];
    const worker = new GenerateReports(
      prisma,
      {
        sendLoanScheduleReport: async (
          _to: string,
          _details: unknown,
          buffer: Buffer,
        ) => {
          delivered.push(buffer);
        },
      } as any,
      {
        uploadVariationScheduleDoc: async () => 'isolated-test-file.xlsx',
      } as any,
      variations,
    );
    await worker.generateScheduleVariation({
      data: { variationBatchId: id, email: 'test@example.com' },
      progress: jest.fn(),
    } as any);
    expect(delivered).toHaveLength(1);
    const saved = await variations.getBatch(id);
    const workbook = XLSX.read(delivered[0], { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets['Payroll changes'],
    );
    expect(
      rows.map((row) => [row['IPPIS NO.'], row.ACTION, row.AMOUNT]),
    ).toEqual(
      saved.rows.map((row) => [
        row.externalId,
        row.action,
        row.amount.toNumber(),
      ]),
    );
    if (process.env.PAYROLL_VARIATION_TEST_ARTIFACT_DIR) {
      mkdirSync(process.env.PAYROLL_VARIATION_TEST_ARTIFACT_DIR, {
        recursive: true,
      });
      writeFileSync(
        join(
          process.env.PAYROLL_VARIATION_TEST_ARTIFACT_DIR,
          `${variations.serialize(saved).period}-${id}.xlsx`,
        ),
        delivered[0],
      );
    }
    await variations.confirmSent(id, 'Test FG receipt', 'TEST-ADMIN');
    return { workbook, rows, buffer: delivered[0] };
  }

  it('sends starts once, preserves all recurring expectations, merges reviews and stops once', async () => {
    const first = await loan('ONE', 'LOAN-1');
    await loan('TWO', 'LOAN-2');
    await variations.initialize(
      { noPriorInstructions: true, reference: 'No existing FG instructions' },
      'TEST-ADMIN',
    );
    expect((await variations.preview(period())).counts.start).toBe(2);
    const draft = await prepare(period(), VariationScheduleMode.DRAFT);
    expect(draft.status).toBe('DRAFT');
    expect(await prisma.payrollSchedule.count()).toBe(0);
    expect((await variations.preview(period())).counts.start).toBe(2);
    const official = await prepare(period());
    expect(official.status).toBe('PREPARED');
    await expect(
      variations.confirmSent(official.id, 'Sent', 'TEST-ADMIN'),
    ).rejects.toThrow('Generate and deliver');
    await expect(variations.preview(period(1))).rejects.toThrow(
      'before preparing another',
    );
    await confirm(official.id);
    await variations.confirmSent(official.id, 'Duplicate click', 'TEST-ADMIN');
    const next = await variations.preview(period(1));
    expect(next.rows).toHaveLength(0);
    expect(next.unchangedCount).toBe(2);
    expect(await obligations.createCompatibilityExpectations(period(1))).toBe(
      2,
    );
    const noChanges = await prepare(period(1));
    expect(noChanges).toMatchObject({
      status: 'SENT',
      kind: 'NO_CHANGES',
      rows: [],
    });
    expect(
      await prisma.payrollScheduleRow.count({
        where: { scheduleId: noChanges.internalScheduleId! },
      }),
    ).toBe(2);

    await loan('ONE', 'TOPUP-1', true);
    const current = await prisma.repaymentObligation.findUniqueOrThrow({
      where: { id: first.obligationId },
    });
    const request = await obligations.requestTenureChange(
      first.obligationId,
      {
        termMonths: 18,
        reasonCode: 'TEST',
        expectedObligationVersion: current.version,
      },
      'TEST-ADMIN',
    );
    await obligations.approveTenureChange(request.id, 'TEST-ADMIN');
    await obligations.applyUnscheduledPayment({
      userId: 'ONE',
      amount: 20000,
      source: 'LIQUIDATION',
      externalReference: 'PARTIAL-1',
      actorId: 'TEST-ADMIN',
    });
    const amended = await variations.preview(period(2));
    expect(amended.rows).toHaveLength(1);
    expect(amended.rows[0]).toMatchObject({
      borrowerId: 'ONE',
      action: 'AMEND',
    });
    expect(amended.rows[0].reasons).toEqual(
      expect.arrayContaining([
        'Top-up disbursed',
        'Tenure changed',
        'Liquidation applied',
      ]),
    );
    await confirm((await prepare(period(2))).id);
    const debt = await prisma.repaymentObligation.findUniqueOrThrow({
      where: { id: first.obligationId },
    });
    await obligations.applyUnscheduledPayment({
      userId: 'ONE',
      amount: debt.contractualOutstanding.add(debt.penaltyOutstanding),
      source: 'LIQUIDATION',
      externalReference: 'FULL-1',
      actorId: 'TEST-ADMIN',
    });
    const stop = await variations.preview(period(3));
    expect(stop.rows).toHaveLength(1);
    expect(stop.rows[0]).toMatchObject({
      borrowerId: 'ONE',
      action: 'STOP',
      amount: '0.00',
    });
    await confirm((await prepare(period(3))).id);
    expect((await variations.preview(period(4))).rows).toHaveLength(0);
  }, 30000);

  it('adopts an explicitly confirmed old full schedule without resending its unchanged customers', async () => {
    await loan('ONE', 'LOAN-1');
    const schedule = await obligations.prepareVariationSchedule(
      period(),
      'TEST-ADMIN',
      VariationScheduleMode.SUBMIT,
      'Historical submission',
    );
    await variations.initialize(
      {
        scheduleId: schedule.scheduleId,
        reference: 'Previously sent FG receipt',
      },
      'TEST-ADMIN',
    );
    expect((await variations.preview(period(1))).rows).toHaveLength(0);
    await expect(
      variations.initialize(
        { noPriorInstructions: true, reference: 'Duplicate' },
        'TEST-ADMIN',
      ),
    ).rejects.toThrow('already initialized');
  });

  it('rejects stale previews atomically and carries unsent changes into the next month', async () => {
    await loan('ONE', 'LOAN-1');
    await variations.initialize(
      { noPriorInstructions: true, reference: 'First run' },
      'TEST-ADMIN',
    );
    const stale = await variations.preview(period());
    await loan('ONE', 'TOPUP-1', true);
    await expect(
      variations.prepare(
        {
          period: period(),
          email: 'test@example.com',
          mode: VariationScheduleMode.SUBMIT,
          submissionNote: 'Review',
          previewHash: stale.previewHash,
        },
        'TEST-ADMIN',
      ),
    ).rejects.toThrow('changed after preview');
    expect(await prisma.payrollSchedule.count()).toBe(0);
    expect(await prisma.payrollVariationBatch.count()).toBe(0);
    expect((await variations.preview(period(1))).counts.start).toBe(1);
  });

  it('can prepare a stop-only month with no active obligations', async () => {
    const first = await loan('ONE', 'LOAN-1');
    await variations.initialize(
      { noPriorInstructions: true, reference: 'First run' },
      'TEST-ADMIN',
    );
    await confirm((await prepare(period())).id);
    const debt = await prisma.repaymentObligation.findUniqueOrThrow({
      where: { id: first.obligationId },
    });
    await obligations.applyUnscheduledPayment({
      userId: 'ONE',
      amount: debt.contractualOutstanding,
      source: 'LIQUIDATION',
      externalReference: 'FULL',
      actorId: 'TEST-ADMIN',
    });
    expect(
      await prisma.repaymentObligation.count({ where: { status: 'ACTIVE' } }),
    ).toBe(0);
    const stop = await prepare(period(1));
    expect(stop.rows[0].action).toBe('STOP');
    expect(
      await prisma.payrollScheduleRow.count({
        where: { scheduleId: stop.internalScheduleId! },
      }),
    ).toBe(0);
  });
  it.each(['topup', 'tenure', 'partial liquidation'] as const)(
    'generates an amendment for a standalone %s and defers it after the current month is frozen',
    async (change) => {
      const first = await loan('ONE', 'LOAN-1');
      await variations.initialize(
        { noPriorInstructions: true, reference: 'First run' },
        'TEST-ADMIN',
      );
      await confirm((await prepare(period())).id);
      if (change === 'topup') await loan('ONE', 'TOPUP-1', true);
      else if (change === 'tenure') {
        const current = await prisma.repaymentObligation.findUniqueOrThrow({
          where: { id: first.obligationId },
        });
        const request = await obligations.requestTenureChange(
          first.obligationId,
          {
            termMonths: 18,
            reasonCode: 'TEST',
            expectedObligationVersion: current.version,
          },
          'TEST-ADMIN',
        );
        expect((await variations.preview(period(1))).rows).toHaveLength(0); // Pending reviews are not instructions.
        await obligations.approveTenureChange(request.id, 'TEST-ADMIN');
      } else
        await obligations.applyUnscheduledPayment({
          userId: 'ONE',
          amount: 20000,
          source: 'LIQUIDATION',
          externalReference: 'PARTIAL',
          actorId: 'TEST-ADMIN',
        });
      expect((await variations.preview(period())).rows).toHaveLength(0);
      const next = await variations.preview(period(1));
      expect(next.rows).toHaveLength(1);
      expect(next.rows[0].action).toBe('AMEND');
      await confirm((await prepare(period(1))).id);
      expect((await variations.preview(period(2))).rows).toHaveLength(0);
    },
  );

  it('omits loans borrowed and completely liquidated before FG ever received an instruction', async () => {
    const first = await loan('ONE', 'LOAN-1');
    await variations.initialize(
      { noPriorInstructions: true, reference: 'First run' },
      'TEST-ADMIN',
    );
    const debt = await prisma.repaymentObligation.findUniqueOrThrow({
      where: { id: first.obligationId },
    });
    await obligations.applyUnscheduledPayment({
      userId: 'ONE',
      amount: debt.contractualOutstanding,
      source: 'LIQUIDATION',
      externalReference: 'FULL',
      actorId: 'TEST-ADMIN',
    });
    expect((await variations.preview(period())).rows).toHaveLength(0);
  });

  it('blocks missing payroll identity before freezing deductions', async () => {
    await loan('ONE', 'LOAN-1');
    await variations.initialize(
      { noPriorInstructions: true, reference: 'First run' },
      'TEST-ADMIN',
    );
    await prisma.userPayroll.delete({ where: { userId: '000ONE' } });
    const preview = await variations.preview(period());
    expect(preview.issues[0].message).toContain('Missing IPPIS');
    await expect(
      variations.prepare(
        {
          period: period(),
          email: 'test@example.com',
          mode: VariationScheduleMode.SUBMIT,
          submissionNote: 'Review',
          previewHash: preview.previewHash,
        },
        'TEST-ADMIN',
      ),
    ).rejects.toThrow('Resolve the payroll issues');
    expect(await prisma.payrollSchedule.count()).toBe(0);
  });

  it('allows only one official batch under concurrent preparation', async () => {
    await loan('ONE', 'LOAN-1');
    await variations.initialize(
      { noPriorInstructions: true, reference: 'First run' },
      'TEST-ADMIN',
    );
    const preview = await variations.preview(period());
    const input = {
      period: period(),
      email: 'test@example.com',
      mode: VariationScheduleMode.SUBMIT,
      submissionNote: 'Review',
      previewHash: preview.previewHash,
    };
    const results = await Promise.allSettled([
      variations.prepare(input, 'ADMIN-1'),
      variations.prepare(input, 'ADMIN-2'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      await prisma.payrollVariationBatch.count({
        where: { status: 'PREPARED' },
      }),
    ).toBe(1);
    expect(await prisma.payrollSchedule.count()).toBe(1);
  });
  it('filters real loan reviews, preserves excluded customers and consumes a combined customer only once', async () => {
    const original = new Map<string, string>();
    for (const user of [
      'COMBO',
      'TOP',
      'TENURE',
      'PARTIAL',
      'FULL',
      'UNCHANGED',
    ])
      original.set(user, (await loan(user, `LOAN-${user}`)).obligationId);
    await variations.initialize(
      { noPriorInstructions: true, reference: 'Filter test baseline' },
      'TEST-ADMIN',
    );
    await confirm((await prepare(period())).id);
    await loan('NEW', 'LOAN-NEW');
    await loan('TOP', 'TOPUP-TOP', true);
    await loan('COMBO', 'TOPUP-COMBO', true);
    for (const user of ['TENURE', 'COMBO']) {
      const obligation = await prisma.repaymentObligation.findUniqueOrThrow({
        where: { id: original.get(user)! },
      });
      const request = await obligations.requestTenureChange(
        obligation.id,
        {
          termMonths: 18,
          reasonCode: 'FILTER-TEST',
          expectedObligationVersion: obligation.version,
        },
        'TEST-ADMIN',
      );
      await obligations.approveTenureChange(request.id, 'TEST-ADMIN');
    }
    for (const user of ['COMBO', 'FULL', 'PARTIAL']) {
      const obligation = await prisma.repaymentObligation.findUniqueOrThrow({
        where: { id: original.get(user)! },
      });
      await obligations.applyUnscheduledPayment({
        userId: user,
        amount: user === 'PARTIAL' ? 20000 : obligation.contractualOutstanding,
        source: 'LIQUIDATION',
        externalReference: `LIQ-${user}`,
        actorId: 'TEST-ADMIN',
      });
    }
    const expected = {
      ALL: ['COMBO', 'FULL', 'NEW', 'PARTIAL', 'TENURE', 'TOP'],
      NEW_LOAN: ['NEW'],
      TOPUP: ['COMBO', 'TOP'],
      LIQUIDATION: ['COMBO', 'FULL', 'PARTIAL'],
      TENURE_CHANGE: ['COMBO', 'TENURE'],
      COMBINED: ['COMBO'],
    };
    for (const filter of Object.values(PayrollVariationFilter)) {
      const preview = await variations.preview(period(1), filter);
      expect(preview.rows.map((row) => row.borrowerId).sort()).toEqual(
        expected[filter],
      );
      expect(preview.totalChangeCount).toBe(6);
      expect(preview.excludedCount).toBe(6 - expected[filter].length);
      expect(preview.unchangedCount).toBe(1);
    }
    // Future effective reviews are excluded from the already frozen month.
    expect(
      (await variations.preview(period(), PayrollVariationFilter.TOPUP)).rows,
    ).toHaveLength(0);
    const combined = await prepare(
      period(1),
      VariationScheduleMode.SUBMIT,
      PayrollVariationFilter.COMBINED,
    );
    expect(combined).toMatchObject({
      changeFilter: 'COMBINED',
      excludedCount: 5,
    });
    expect(combined.rows[0]).toMatchObject({ action: 'STOP', amount: '0.00' });
    const generated = await confirm(combined.id);
    const metadata = XLSX.utils.sheet_to_json(
      generated.workbook.Sheets['Variation details'],
      { header: 1 },
    );
    expect(metadata).toContainEqual([
      'Customer change filter',
      'All three: top-up, liquidation and tenure change',
    ]);
    expect(metadata).toContainEqual(['Other customer changes excluded', 5]);
    // A top-up match included every change for COMBO, so it never repeats in another category.
    expect(
      (
        await variations.preview(period(1), PayrollVariationFilter.TOPUP)
      ).rows.map((row) => row.borrowerId),
    ).toEqual(['TOP']);
    expect((await variations.preview(period(1))).rows).toHaveLength(5);
    const topup = await prepare(
      period(1),
      VariationScheduleMode.SUBMIT,
      PayrollVariationFilter.TOPUP,
    );
    expect(topup.internalScheduleId).toBe(combined.internalScheduleId);
    await confirm(topup.id);
    expect(
      (await variations.preview(period(1))).rows
        .map((row) => row.borrowerId)
        .sort(),
    ).toEqual(['FULL', 'NEW', 'PARTIAL', 'TENURE']);
    const remaining = await prepare(period(1));
    await confirm(remaining.id);
    expect((await variations.preview(period(1))).rows).toHaveLength(0);
    expect((await variations.preview(period(2))).rows).toHaveLength(0);
    expect(await prisma.payrollSchedule.count()).toBe(2);
    // Previously reported tenure changes must not turn two new changes into an all-three match.
    await loan('TENURE', 'LATER-TOPUP', true);
    await obligations.applyUnscheduledPayment({
      userId: 'TENURE',
      amount: 10000,
      source: 'LIQUIDATION',
      externalReference: 'LATER-LIQ',
      actorId: 'TEST-ADMIN',
    });
    expect(
      (await variations.preview(period(2), PayrollVariationFilter.COMBINED))
        .rows,
    ).toHaveLength(0);
    expect(
      (await variations.preview(period(2), PayrollVariationFilter.TOPUP))
        .rows[0].changeTypes,
    ).toEqual(['LIQUIDATION', 'TOPUP']);
  }, 30000);

  it('does not freeze or save a month when the selected filter has no matches', async () => {
    await loan('ONE', 'LOAN-1');
    await variations.initialize(
      { noPriorInstructions: true, reference: 'First run' },
      'TEST-ADMIN',
    );
    for (const mode of [
      VariationScheduleMode.DRAFT,
      VariationScheduleMode.SUBMIT,
    ]) {
      await expect(
        prepare(period(), mode, PayrollVariationFilter.TOPUP),
      ).rejects.toThrow('No customers match this filter');
    }
    expect(await prisma.payrollSchedule.count()).toBe(0);
    expect(await prisma.payrollVariationBatch.count()).toBe(0);
    expect((await variations.preview(period())).rows).toHaveLength(1);
  });

  it('rejects a changed filter even when the selected customer rows happen to be identical', async () => {
    await loan('ONE', 'LOAN-1');
    await variations.initialize(
      { noPriorInstructions: true, reference: 'First run' },
      'TEST-ADMIN',
    );
    const preview = await variations.preview(
      period(),
      PayrollVariationFilter.NEW_LOAN,
    );
    await expect(
      variations.prepare(
        {
          period: period(),
          email: 'test@example.com',
          mode: VariationScheduleMode.SUBMIT,
          submissionNote: 'Review',
          previewHash: preview.previewHash,
          changeFilter: PayrollVariationFilter.ALL,
        },
        'TEST-ADMIN',
      ),
    ).rejects.toThrow('changed after preview');
    expect(await prisma.payrollSchedule.count()).toBe(0);
    await expect(
      variations.preview(period(), 'UNKNOWN' as PayrollVariationFilter),
    ).rejects.toThrow('Invalid payroll change filter');
  });
});
