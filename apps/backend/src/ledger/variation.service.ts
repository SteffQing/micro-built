import { ConflictException, Injectable } from '@nestjs/common';
import { MONTHS, monthNumber, nextPeriod, periodLabel, toYm } from '@microbuilt/shared';
import { Prisma, type PayrollPeriod } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { loanBalancesMany } from './balances';
import { DeductionsService } from './deductions.service';
import { LedgerClock } from './ledger.clock';
import { openExpected } from './ledger.math';
import { LedgerTx, type Tx } from './ledger.tx';
import { money } from './money';
import { PeriodsService } from './periods.service';
import {
  buildVariationWorkbook,
  classifyVariation,
  variationDates,
  XLSX_MIME,
  type VariationAction,
  type VariationReason,
  type VariationRow,
} from './variation';

export const VARIATIONS_BUCKET = 'variations';

export interface VariationFilter {
  action?: VariationAction;
  reason?: VariationReason;
}

export interface VariationPreview {
  period: {
    id: string;
    label: string;
    ym: string;
    submittedAt: Date | null;
    closedAt: Date | null;
    filePath: string | null;
    /** Why the submission can't be reverted, or null when it can (only a submitted month has an answer). */
    revertBlockedBy: string | null;
  };
  rows: VariationRow[];
  /** Over every row, before the filter. */
  counts: Record<VariationAction, number>;
}

function countActions(rows: VariationRow[]): Record<VariationAction, number> {
  const counts = { START: 0, AMEND: 0, STOP: 0 };
  for (const row of rows) counts[row.action]++;
  return counts;
}

@Injectable()
export class VariationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly periods: PeriodsService,
    private readonly supabase: SupabaseService,
    private readonly clock: LedgerClock,
    private readonly deductions: DeductionsService,
  ) {}

  async preview(periodId: string, filter: VariationFilter = {}): Promise<VariationPreview> {
    const period = await this.periods.findOrThrow(periodId);
    const rows = await this.rowsFor(period, this.prisma);
    return {
      period: {
        id: period.id,
        label: periodLabel(period),
        ym: toYm(period),
        submittedAt: period.variationSubmittedAt,
        closedAt: period.closedAt,
        filePath: period.variationFilePath,
        revertBlockedBy: period.variationSubmittedAt ? await this.revertBlocker(period, this.prisma) : null,
      },
      rows: rows.filter(
        (row) =>
          (!filter.action || row.action === filter.action) &&
          (!filter.reason || row.reasons.includes(filter.reason)),
      ),
      counts: countActions(rows),
    };
  }

  buildWorkbook(rows: VariationRow[]): Buffer {
    return buildVariationWorkbook(rows);
  }

  /**
   * Sends period P to payroll, once and in month order: the file goes to the private bucket,
   * then in one transaction every OPEN(P) deduction freezes (AWAITING) at exactly the amount in
   * the file, and each loan still being repaid gets its OPEN(P+1). The loans are locked first,
   * so a payment landing meanwhile waits and then counts against the new month.
   */
  async submit(periodId: string, actorId: string) {
    const period = await this.periods.findOrThrow(periodId);
    const label = periodLabel(period);
    if (period.variationSubmittedAt) throw new ConflictException(`${label} has already been submitted`);
    await this.assertEarlierSubmitted(period);

    return this.ledgerTx.transaction(
      async (tx) => {
        const [locked] = await tx.$queryRaw<{ variationSubmittedAt: Date | null }[]>`
          SELECT "variationSubmittedAt" FROM "PayrollPeriod" WHERE "id" = ${periodId} FOR UPDATE`;
        if (locked?.variationSubmittedAt) throw new ConflictException(`${label} has already been submitted`);
        await tx.$queryRaw`
          SELECT l."id" FROM "Loan" l JOIN "Deduction" d ON d."loanId" = l."id"
          WHERE d."periodId" = ${periodId} AND d."status" = 'OPEN'
          ORDER BY l."id" FOR UPDATE OF l`;

        const rows = await this.rowsFor(period, tx);
        const filePath = `${toYm(period)}.xlsx`;
        await this.supabase.uploadPrivate(VARIATIONS_BUCKET, filePath, buildVariationWorkbook(rows), XLSX_MIME);

        const frozen = await tx.deduction.findMany({
          where: { periodId, status: 'OPEN' },
          select: { loanId: true },
        });
        await tx.deduction.updateMany({ where: { periodId, status: 'OPEN' }, data: { status: 'AWAITING' } });

        const next = await this.periods.ensure(nextPeriod(period), tx);
        const live = await tx.loan.findMany({
          where: { id: { in: frozen.map((d) => d.loanId) }, status: 'DISBURSED' },
          select: { id: true },
        });
        const balances = await loanBalancesMany(
          tx,
          live.map((loan) => loan.id),
        );
        await tx.deduction.createMany({
          data: [...balances.values()].map((b) => ({
            loanId: b.loanId,
            periodId: next.id,
            expected: openExpected(b.outstanding, b.committed, b.remainingMonths, b.lastSent),
          })),
        });

        const counts = countActions(rows);
        await tx.payrollPeriod.update({
          where: { id: periodId },
          data: { variationSubmittedAt: this.clock.now(), variationFilePath: filePath },
        });
        await this.ledgerTx.audit(tx, {
          actorId,
          action: 'VARIATION_SUBMITTED',
          entityType: 'PAYROLL_PERIOD',
          entityId: periodId,
          note: `${rows.length} changes (${counts.START} start, ${counts.AMEND} amend, ${counts.STOP} stop)`,
        });
        return { periodId, label, filePath, counts, frozen: frozen.length, opened: balances.size };
      },
      { timeout: 120_000 },
    );
  }

  /**
   * Undoes a submission sent by mistake, while nothing has happened on top of it: the month goes back to unsubmitted,
   * its deductions back to OPEN (recomputed), and the next month's OPEN deductions that the submit opened are deleted.
   * A loan disbursed after the submit (first deduction in the next month) moves back to this month. Only the latest
   * submitted month, before any payroll upload, payment or close touches it.
   */
  async revert(periodId: string, actorId: string, reason: string) {
    const period = await this.periods.findOrThrow(periodId);
    const label = periodLabel(period);

    return this.ledgerTx.transaction(
      async (tx) => {
        const [locked] = await tx.$queryRaw<PayrollPeriod[]>`
          SELECT * FROM "PayrollPeriod" WHERE "id" = ${periodId} FOR UPDATE`;
        const blocker = await this.revertBlocker(locked, tx);
        if (blocker) throw new ConflictException(blocker);

        const next = await tx.payrollPeriod.findUnique({
          where: { year_month: nextPeriod(period) },
          select: { id: true },
        });
        const frozen = await tx.deduction.findMany({ where: { periodId }, select: { loanId: true } });
        const opened = next
          ? await tx.deduction.findMany({ where: { periodId: next.id, status: 'OPEN' }, select: { id: true, loanId: true } })
          : [];
        const loanIds = [...new Set([...frozen, ...opened].map((d) => d.loanId))].sort();
        for (const loanId of loanIds) await this.ledgerTx.lockLoan(tx, loanId);

        const inPeriod = new Set(frozen.map((d) => d.loanId));
        const stale = opened.filter((d) => inPeriod.has(d.loanId)).map((d) => d.id);
        const moved = opened.filter((d) => !inPeriod.has(d.loanId)).map((d) => d.id);
        // Their only rows are the OPEN ones the submit (or a disbursement after it) created: nothing is paid on them.
        await tx.deduction.deleteMany({ where: { id: { in: stale }, status: 'OPEN' } });
        if (moved.length) await tx.deduction.updateMany({ where: { id: { in: moved } }, data: { periodId } });
        await tx.deduction.updateMany({ where: { periodId, status: 'AWAITING' }, data: { status: 'OPEN' } });
        for (const loanId of loanIds) await this.deductions.refreshOpen(loanId, tx);

        await tx.payrollPeriod.update({
          where: { id: periodId },
          data: { variationSubmittedAt: null, variationFilePath: null },
        });
        await this.ledgerTx.audit(tx, {
          actorId,
          action: 'VARIATION_REVERTED',
          entityType: 'PAYROLL_PERIOD',
          entityId: periodId,
          note: `${reason} (${frozen.length} deductions reopened, ${stale.length} next-month deductions removed)`,
        });
        return { periodId, label, filePath: locked.variationFilePath, reopened: frozen.length, removed: stale.length };
      },
      { timeout: 120_000 },
    );
  }

  /** Why a submitted month can't be reverted, or null. */
  private async revertBlocker(period: PayrollPeriod, db: Tx): Promise<string | null> {
    const label = periodLabel(period);
    if (!period.variationSubmittedAt) return `${label} hasn't been submitted`;
    if (period.closedAt) return `${label} is closed`;
    const later = await db.payrollPeriod.findFirst({
      where: {
        variationSubmittedAt: { not: null },
        OR: [
          { year: { gt: period.year } },
          { year: period.year, month: { in: MONTHS.slice(monthNumber(period.month)) } },
        ],
      },
      select: { year: true, month: true },
    });
    if (later) return `${periodLabel(later)} was submitted after it: revert that month first`;
    const uploads = await db.payrollUpload.count({ where: { periodId: period.id } });
    if (uploads) return `A payroll file has been uploaded for ${label}`;
    const settled = await db.deduction.count({ where: { periodId: period.id, status: { not: 'AWAITING' } } });
    const next = await db.payrollPeriod.findUnique({ where: { year_month: nextPeriod(period) }, select: { id: true } });
    const paid = await db.repayment.count({
      where: { deduction: { periodId: { in: next ? [period.id, next.id] : [period.id] } } },
    });
    if (settled || paid) return `Payments have been applied to ${label}'s deductions`;
    return null;
  }

  private async assertEarlierSubmitted(period: PayrollPeriod): Promise<void> {
    const earlier = await this.prisma.deduction.findFirst({
      where: {
        status: 'OPEN',
        period: {
          OR: [
            { year: { lt: period.year } },
            { year: period.year, month: { in: MONTHS.slice(0, monthNumber(period.month) - 1) } },
          ],
        },
      },
      orderBy: [{ period: { year: 'asc' } }, { period: { month: 'asc' } }],
      select: { period: { select: { year: true, month: true } } },
    });
    if (earlier) {
      throw new ConflictException(`Submit ${periodLabel(earlier.period)} first; variations go to payroll in month order`);
    }
  }

  /** Every loan whose deduction for this period differs from what payroll was last sent. */
  private async rowsFor(period: PayrollPeriod, db: Tx): Promise<VariationRow[]> {
    const open = await db.deduction.findMany({
      where: { periodId: period.id, status: 'OPEN' },
      select: {
        loanId: true,
        expected: true,
        loan: {
          select: {
            borrowerId: true,
            borrower: {
              select: {
                externalId: true,
                user: { select: { name: true } },
                payroll: { select: { command: true } },
              },
            },
          },
        },
      },
    });
    if (open.length === 0) return [];
    const loanIds = open.map((d) => d.loanId);

    // What each loan was last sent: its latest frozen deduction, and when that month went out.
    const priors = await db.$queryRaw<{ loanId: string; expected: Prisma.Decimal; frozenAt: Date }[]>`
      SELECT DISTINCT ON (d."loanId") d."loanId", d."expected",
             COALESCE(p."variationSubmittedAt", d."createdAt") AS "frozenAt"
      FROM "Deduction" d JOIN "PayrollPeriod" p ON p."id" = d."periodId"
      WHERE d."loanId" IN (${Prisma.join(loanIds)}) AND d."status" <> 'OPEN'
      ORDER BY d."loanId", p."year" DESC, p."month" DESC`;
    const priorByLoan = new Map(priors.map((prior) => [prior.loanId, prior]));
    const balances = await loanBalancesMany(db, loanIds);
    const activity = await this.activitySince(db, priors);

    const rows: VariationRow[] = [];
    for (const deduction of open) {
      const prior = priorByLoan.get(deduction.loanId) ?? null;
      const amount = money(deduction.expected);
      const action = classifyVariation(amount, prior ? money(prior.expected) : null);
      if (!action) continue;

      const b = balances.get(deduction.loanId);
      if (!b) continue;
      const tenure = action === 'STOP' ? 0 : b.remainingMonths;
      const { start, end } = variationDates(period, tenure);
      const borrower = deduction.loan.borrower;
      rows.push({
        loanId: deduction.loanId,
        customerId: deduction.loan.borrowerId,
        externalId: borrower.externalId,
        name: borrower.user.name,
        command: borrower.payroll?.command ?? null,
        balance: b.outstanding,
        amount,
        tenure,
        action,
        reasons: prior ? (activity.get(deduction.loanId) ?? []) : ['NEW_LOAN'],
        start,
        end,
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name) || (a.externalId ?? '').localeCompare(b.externalId ?? ''));
  }

  /** Why each loan's deduction moved: what happened to it after its last amount went to payroll. */
  private async activitySince(
    db: Tx,
    priors: { loanId: string; frozenAt: Date }[],
  ): Promise<Map<string, VariationReason[]>> {
    const result = new Map<string, VariationReason[]>();
    if (priors.length === 0) return result;
    const since = new Map(priors.map((p) => [p.loanId, p.frozenAt]));
    const earliest = new Date(Math.min(...priors.map((p) => p.frozenAt.getTime())));
    const loanIds = [...since.keys()];

    const [microLoans, liquidations, changes] = await Promise.all([
      db.microLoan.findMany({
        where: {
          loanId: { in: loanIds },
          status: 'DISBURSED',
          purpose: { in: ['TOPUP', 'PENALTY'] },
          disbursedAt: { gt: earliest },
        },
        select: { loanId: true, purpose: true, disbursedAt: true },
      }),
      db.repayment.findMany({
        where: { loanId: { in: loanIds }, createdAt: { gt: earliest }, paymentInflow: { source: 'LIQUIDATION' } },
        select: { loanId: true, createdAt: true },
      }),
      db.tenureChange.findMany({
        where: { loanId: { in: loanIds }, status: 'APPROVED', microLoanId: null },
        select: { id: true, loanId: true },
      }),
    ]);
    const approvals = changes.length
      ? await db.auditLog.findMany({
          where: {
            action: 'TENURE_CHANGE_APPROVED',
            entityId: { in: changes.map((c) => c.id) },
            createdAt: { gt: earliest },
          },
          select: { entityId: true, createdAt: true },
        })
      : [];
    const changeLoan = new Map(changes.map((c) => [c.id, c.loanId]));

    const add = (loanId: string, at: Date | null, reason: VariationReason) => {
      const from = since.get(loanId);
      if (!from || !at || at <= from) return;
      const reasons = result.get(loanId) ?? [];
      if (!reasons.includes(reason)) reasons.push(reason);
      result.set(loanId, reasons);
    };
    for (const m of microLoans) add(m.loanId, m.disbursedAt, m.purpose === 'TOPUP' ? 'TOPUP' : 'DEFAULT');
    for (const r of liquidations) add(r.loanId, r.createdAt, 'LIQUIDATION');
    for (const a of approvals) {
      const loanId = changeLoan.get(a.entityId);
      if (loanId) add(loanId, a.createdAt, 'TENURE_CHANGE');
    }
    return result;
  }
}
