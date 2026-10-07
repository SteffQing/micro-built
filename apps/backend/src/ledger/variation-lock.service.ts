import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { comparePeriods, nextPeriod, periodLabel, toYm, type Period } from '@microbuilt/shared';
import { Prisma, type DeductionStatus } from '@prisma/client';
import { captureJobError } from 'src/common/observability';
import type { EarlierUnlocked } from 'src/common/types/repayment.interface';
import { chunkArray } from 'src/common/utils';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { SettingsService } from 'src/settings/settings.service';
import { assertLedgerInvariants, loanBalances } from './balances';
import { DeductionsService } from './deductions.service';
import { LedgerClock } from './ledger.clock';
import { capExtension, penaltyFor } from './ledger.math';
import { LedgerService, type Allocation } from './ledger.service';
import { LedgerTx, type Tx } from './ledger.tx';
import { money, naira, sum, toNumber, ZERO, type Money } from './money';
import { lagosMonthOf } from './period';
import { TenureChangesService } from './tenure-changes.service';
import { variationFilePath } from './variation';
import { VARIATIONS_BUCKET } from './variation.service';

export interface SettleSummary {
  variationId: string;
  /** "NPF · OCTOBER 2026" */
  label: string;
  /** False when some deductions failed to settle; settle again (finished rows are skipped). */
  settled: boolean;
  /** Settled without a penalty: loan already repaid, or nothing was due. */
  cleared: number;
  /** Nothing arrived. */
  failed: number;
  /** Less than expected arrived. */
  partial: number;
  penalties: number;
  penaltyTotal: number;
  /** Tenure extensions proposed because the new monthly amount broke the net-pay cap. */
  proposals: number;
  errors: { deductionId: string; message: string }[];
}

export interface SettleContext {
  actorId: string;
  variationId: string;
  label: string;
  penaltyRate: Prisma.Decimal;
  maxDeductionRate: Prisma.Decimal | null;
}

export type SettleOutcome =
  | { kind: 'skipped' }
  | { kind: 'settled' }
  | { kind: 'charged'; status: DeductionStatus; penalty: Money; proposed: boolean };

/** What marking a variation No payroll did (R5). */
export interface NoPayrollSummary {
  variationId: string;
  /** "NPF · OCTOBER 2026" */
  label: string;
  failed: number;
  penalties: number;
  penaltyTotal: number;
  proposals: number;
}

/** What a revert (R6) removed. */
export interface RevertSummary {
  variationId: string;
  /** "NPF · OCTOBER 2026" */
  label: string;
  inflowsRemoved: number;
  penaltiesRemoved: number;
  proposalsWithdrawn: number;
}

/** A voucher revert also says which stored sheet to delete. */
export interface VoucherRevertSummary extends RevertSummary {
  stored: { period: Period; fileHash: string };
}

export interface RematchInput {
  inflowId: string;
  loanId: string;
  amount: Prisma.Decimal.Value;
  /** The voucher the inflow came from: its variation holds the deduction to pay. */
  voucherId: string | null;
  /** The inflow's month, used to find the deduction when it has no voucher. */
  periodId: string;
  actorId: string;
}

export interface Rematch {
  allocation: Allocation;
  /** The deduction the payment was paid against; null when it went to the loan alone. */
  deductionId: string | null;
  /** The penalty the lock charged for this loan, when the rematch cleared it. */
  penalty: Money | null;
  fallbackReason: string | null;
}

/** Loans refreshed per transaction after a lock. */
const REFRESH_BATCH = 25;
/** A revert refreshes every loan of a variation in one transaction. */
const UNDO_TIMEOUT = 240_000;
/** A voucher with no VOUCHER_UPLOADED entry is still being processed for this long (a failed job never writes one). */
const PROCESSING_WINDOW_MS = 15 * 60 * 1000;

interface LockedVariation {
  id: string;
  version: number;
  noPayrollReason: string | null;
  organizationId: string;
  organization: { name: string };
  period: Period;
  voucher: { id: string; filename: string; fileHash: string; createdAt: Date } | null;
}

// A variation locks when its voucher lands or it is marked No payroll (PLAN_V2 §0.2). Locking settles it (R4 step 2;
// what closing a month used to do): whatever payroll didn't pay is final. A deduction that got nothing becomes FAILED,
// a short one stays PARTIAL, and each shortfall is charged a penalty that flows into the months still open. The
// penalty and any cap proposal carry the variationId, which is what a revert (R6) or a rematch (R4b) undoes. One
// transaction per loan, so one bad row can't undo the rest, and a re-run skips every row already done (penalizedAt).
@Injectable()
export class VariationLockService {
  private readonly logger = new Logger(VariationLockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly ledger: LedgerService,
    private readonly deductions: DeductionsService,
    private readonly tenureChanges: TenureChangesService,
    private readonly settings: SettingsService,
    private readonly supabase: SupabaseService,
    private readonly clock: LedgerClock,
  ) {}

  // ── Settling ──────────────────────────────────────────────────────────────

  /** The settle context of a variation: its label and the rates at settlement time. */
  async settleContext(variationId: string, actorId: string, db: Tx = this.prisma): Promise<SettleContext> {
    const variation = await db.variation.findUniqueOrThrow({
      where: { id: variationId },
      select: { organization: { select: { name: true } }, period: { select: { year: true, month: true } } },
    });
    const penaltyRate = await this.settings.requirePenaltyRate();
    const { maxDeductionRate } = await this.settings.get();
    return {
      actorId,
      variationId,
      label: `${variation.organization.name} · ${periodLabel(variation.period)}`,
      penaltyRate,
      maxDeductionRate,
    };
  }

  /**
   * Settles every deduction of the variation not settled yet (AWAITING or PARTIAL, no penalizedAt), each in its own
   * transaction. The caller has locked the variation (voucher or noPayrollReason); this only settles.
   */
  async settleVariation(variationId: string, actorId: string): Promise<SettleSummary> {
    const context = await this.settleContext(variationId, actorId);
    const open = await this.prisma.deduction.findMany({
      where: { variationId, penalizedAt: null, status: { in: ['AWAITING', 'PARTIAL'] } },
      select: { id: true },
      orderBy: { loanId: 'asc' },
    });

    const summary: SettleSummary = {
      variationId,
      label: context.label,
      settled: false,
      cleared: 0,
      failed: 0,
      partial: 0,
      penalties: 0,
      penaltyTotal: 0,
      proposals: 0,
      errors: [],
    };
    const charged: Money[] = [];
    for (const { id } of open) {
      try {
        const outcome = await this.ledgerTx.transaction((tx) => this.settleDeduction(id, context, tx));
        if (outcome.kind === 'settled') summary.cleared++;
        if (outcome.kind !== 'charged') continue;
        if (outcome.status === 'FAILED') summary.failed++;
        else summary.partial++;
        if (outcome.penalty.gt(0)) {
          summary.penalties++;
          charged.push(outcome.penalty);
        }
        if (outcome.proposed) summary.proposals++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        summary.errors.push({ deductionId: id, message });
        this.logger.error(`Settling deduction ${id} of ${context.label} failed: ${message}`);
        captureJobError(error, { job: 'variation.settle', jobId: id });
      }
    }
    summary.penaltyTotal = toNumber(sum(charged));
    summary.settled = summary.errors.length === 0;
    return summary;
  }

  /**
   * Settles one deduction inside the caller's transaction (also used by a rematch, R4b, for the one loan it undid).
   * Locks the loan, then reads the deduction again: a concurrent settle may have finished it.
   */
  async settleDeduction(id: string, context: SettleContext, tx: Tx): Promise<SettleOutcome> {
    const { loanId } = await tx.deduction.findUniqueOrThrow({ where: { id }, select: { loanId: true } });
    await this.ledgerTx.lockLoan(tx, loanId);
    const deduction = await tx.deduction.findUniqueOrThrow({ where: { id } });
    if (deduction.penalizedAt || (deduction.status !== 'AWAITING' && deduction.status !== 'PARTIAL')) {
      return { kind: 'skipped' };
    }

    const loan = await tx.loan.findUniqueOrThrow({
      where: { id: loanId },
      select: { status: true, borrower: { select: { payroll: { select: { netPay: true } } } } },
    });
    const now = this.clock.now();
    const settledAt = deduction.settledAt ?? now;

    if (loan.status !== 'DISBURSED' || deduction.expected.isZero()) {
      await tx.deduction.update({ where: { id }, data: { status: 'FULFILLED', penalizedAt: now, settledAt } });
      return { kind: 'settled' };
    }

    const paid = await tx.repayment.aggregate({ where: { deductionId: id }, _sum: { amount: true } });
    const shortfall = money(Prisma.Decimal.max(0, deduction.expected.minus(paid._sum.amount ?? 0)));
    const status: DeductionStatus = deduction.status === 'AWAITING' ? 'FAILED' : 'PARTIAL';
    await tx.deduction.update({ where: { id }, data: { status, penalizedAt: now, settledAt } });

    const penalty = shortfall.gt(0) ? penaltyFor(shortfall, context.penaltyRate) : ZERO;
    if (penalty.gt(0)) {
      const rate = context.penaltyRate.mul(100).toString();
      const note = `${context.label}: ${naira(shortfall)} short × ${rate}%`;
      await this.ledger.addPenalty(loanId, penalty, context.actorId, note, tx, context.variationId);
    } else {
      // Its expected no longer counts as committed, so the OPEN month takes up the shortfall.
      await this.deductions.refreshOpen(loanId, tx);
    }

    const netPay = loan.borrower.payroll?.netPay ?? null;
    const proposed = await this.proposeIfOverCap(loanId, netPay, context, tx);
    return { kind: 'charged', status, penalty, proposed };
  }

  /**
   * R4 step 3, after the settling: `refreshOpen` on every loan of the variation (which opens next month's row, R1),
   * then the superseded variation files go (P4). Safe to run again. Returns what could not be done.
   */
  async afterLock(variationId: string): Promise<{ errors: string[] }> {
    const rows = await this.prisma.deduction.findMany({
      where: { variationId },
      select: { loanId: true },
      distinct: ['loanId'],
      orderBy: { loanId: 'asc' },
    });
    const errors: string[] = [];
    for (const loanIds of chunkArray(
      rows.map((row) => row.loanId),
      REFRESH_BATCH,
    )) {
      try {
        await this.ledgerTx.transaction(async (tx) => {
          await this.lockLoans(tx, loanIds);
          for (const loanId of loanIds) await this.deductions.refreshOpen(loanId, tx);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Refreshing loans ${loanIds[0]}…: ${message}`);
        this.logger.error(`Refreshing the loans of variation ${variationId} failed: ${message}`);
        captureJobError(error, { job: 'variation.refresh', jobId: variationId });
      }
    }
    await this.pruneVersions(variationId);
    return { errors };
  }

  /** P4: once a variation locks, every file version but the current one is deleted. */
  private async pruneVersions(variationId: string): Promise<void> {
    const variation = await this.prisma.variation.findUnique({
      where: { id: variationId },
      select: { version: true, organizationId: true, period: { select: { year: true, month: true } } },
    });
    if (!variation) return;
    for (let version = 1; version < variation.version; version++) {
      const path = variationFilePath(variation.organizationId, variation.period, version);
      await this.supabase.removePrivate(VARIATIONS_BUCKET, path).catch((error: unknown) => {
        this.logger.warn(`Removing ${path} failed: ${error instanceof Error ? error.message : error}`);
      });
    }
  }

  /**
   * V2.MD §0.4-1: when the OPEN deduction is now more than `netPay × maxDeductionRate`, propose
   * the smallest tenure extension that brings it back under — once (never with a change pending),
   * and never applied without an admin.
   */
  private async proposeIfOverCap(
    loanId: string,
    netPay: Prisma.Decimal | null,
    context: SettleContext,
    tx: Tx,
  ): Promise<boolean> {
    const { maxDeductionRate } = context;
    if (!maxDeductionRate || !netPay || netPay.lte(0)) return false;
    const cap = money(netPay.mul(maxDeductionRate));
    const open = await tx.deduction.findFirst({ where: { loanId, status: 'OPEN' }, select: { expected: true } });
    if (!open || open.expected.lte(cap)) return false;
    if (await tx.tenureChange.findFirst({ where: { loanId, status: 'PENDING' }, select: { id: true } })) return false;

    const balances = await loanBalances(tx, loanId);
    const base = money(Prisma.Decimal.max(0, balances.outstanding.minus(balances.committed)));
    const monthsDelta = capExtension(base, cap, balances.tenure, balances.frozenCount);
    if (monthsDelta < 1) return false;
    await this.tenureChanges.propose(
      { loanId, monthsDelta, reason: 'DEFAULT', requestedById: null, variationId: context.variationId },
      tx,
    );
    return true;
  }

  // ── Order ─────────────────────────────────────────────────────────────────

  /** The organization's variations for months before `period` that are neither voucher-locked nor No payroll (P8). */
  async earlierUnlocked(organizationId: string, period: Period, db: Tx = this.prisma): Promise<EarlierUnlocked[]> {
    const unlocked = await db.variation.findMany({
      where: { organizationId, version: { gt: 0 }, voucher: null, noPayrollReason: null },
      select: { id: true, period: { select: { year: true, month: true } } },
    });
    return unlocked
      .filter((variation) => comparePeriods(variation.period, period) < 0)
      .sort((a, b) => comparePeriods(a.period, b.period))
      .map((variation) => ({
        variationId: variation.id,
        ym: toYm(variation.period),
        label: periodLabel(variation.period),
      }));
  }

  /** The earliest month after `period` whose variation is locked, if any: nothing goes back before it (P8). */
  async lockedAfter(organizationId: string, period: Period, db: Tx = this.prisma): Promise<Period | null> {
    const locked = await db.variation.findMany({
      where: {
        organizationId,
        version: { gt: 0 },
        OR: [{ voucher: { isNot: null } }, { noPayrollReason: { not: null } }],
      },
      select: { period: { select: { year: true, month: true } } },
    });
    const later = locked.map((variation) => variation.period).filter((month) => comparePeriods(month, period) > 0);
    return later.sort(comparePeriods)[0] ?? null;
  }

  // ── No payroll (R5) ───────────────────────────────────────────────────────

  /**
   * The voucher for a month that has ended never came: everyone in the variation failed to pay. Locks it, then
   * settles it like a voucher would (FAILED, penalties, cap proposals) and opens next month's rows. Calling it again
   * on a variation whose settling stopped part way finishes the job.
   */
  async noPayroll(variationId: string, reason: string, actorId: string): Promise<NoPayrollSummary> {
    // Settling charges penalties: refuse before locking anything if there is no rate to charge them at.
    await this.settings.requirePenaltyRate();
    const label = await this.ledgerTx.transaction(async (tx) => {
      const variation = await this.lockVariation(tx, variationId);
      const name = variation.organization.name;
      const month = periodLabel(variation.period);
      const label = `${name} · ${month}`;
      if (variation.voucher) throw new ConflictException(`${name}'s ${month} variation already has a voucher`);
      if (variation.noPayrollReason !== null) {
        const unsettled = await tx.deduction.count({
          where: { variationId, penalizedAt: null, status: { in: ['AWAITING', 'PARTIAL'] } },
        });
        if (unsettled === 0) throw new ConflictException(`${name}'s ${month} variation is already marked No payroll`);
        return label;
      }
      if (comparePeriods(lagosMonthOf(this.clock.now()), variation.period) <= 0) {
        throw new ConflictException(`${month} hasn't ended yet`);
      }
      const earlier = await this.earlierUnlocked(variation.organizationId, variation.period, tx);
      if (earlier.length) {
        throw new ConflictException(
          `${name}'s ${earlier[0].label} variation has no voucher yet: upload it, or mark it No payroll, first`,
        );
      }

      await tx.variation.update({ where: { id: variationId }, data: { noPayrollReason: reason } });
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'NO_PAYROLL',
        entityType: 'VARIATION',
        entityId: variationId,
        note: `${label}: ${reason}`,
      });
      return label;
    });

    const summary = await this.settleVariation(variationId, actorId);
    const refreshed = await this.afterLock(variationId);
    if (!summary.settled || refreshed.errors.length) {
      throw new ServiceUnavailableException(
        `${label} is marked No payroll, but ${summary.errors.length + refreshed.errors.length} steps of settling it failed. Mark it again to finish.`,
      );
    }
    return {
      variationId,
      label,
      failed: summary.failed,
      penalties: summary.penalties,
      penaltyTotal: summary.penaltyTotal,
      proposals: summary.proposals,
    };
  }

  /**
   * Undoes a No payroll while no later month of the organization is locked: penalties and pending cap proposals go,
   * the deductions wait for their voucher again. Refused once a payment has been applied to its loans since.
   */
  async revertNoPayroll(variationId: string, reason: string, actorId: string): Promise<RevertSummary> {
    return this.ledgerTx.transaction(
      async (tx) => {
        const variation = await this.lockVariation(tx, variationId);
        const name = variation.organization.name;
        const month = periodLabel(variation.period);
        const label = `${name} · ${month}`;
        if (variation.noPayrollReason === null) {
          throw new ConflictException(`${name}'s ${month} variation isn't marked No payroll`);
        }
        const later = await this.lockedAfter(variation.organizationId, variation.period, tx);
        if (later) {
          throw new ConflictException(
            `${name}'s ${periodLabel(later)} variation is locked: undo it first, since it was settled after ${month}`,
          );
        }

        const loanIds = await this.variationLoanIds(tx, variationId);
        await this.lockLoans(tx, loanIds);
        const locked = await tx.auditLog.findFirst({
          where: { action: 'NO_PAYROLL', entityType: 'VARIATION', entityId: variationId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });
        await this.assertNoPaymentSince(tx, loanIds, locked?.createdAt ?? new Date(0), null);
        await this.assertProposalsPending(tx, variationId);

        const undone = await this.undo(tx, { variationId, voucherId: null, loanIds });
        await tx.variation.update({ where: { id: variationId }, data: { noPayrollReason: null } });
        await this.ledgerTx.audit(tx, {
          actorId,
          action: 'NO_PAYROLL_REVERTED',
          entityType: 'VARIATION',
          entityId: variationId,
          note: `${label}: ${reason} (${undone.penaltiesRemoved} penalties removed, ${undone.proposalsWithdrawn} proposals withdrawn)`,
        });
        return { variationId, label, ...undone };
      },
      { timeout: UNDO_TIMEOUT },
    );
  }

  // ── Revert a voucher (R6) ─────────────────────────────────────────────────

  /**
   * Undoes a voucher while its month is still the current one and the organization has no variation for the next:
   * the voucher's inflows, repayments and breakdowns go (a loan they made REPAID is DISBURSED again), then the
   * penalties and pending cap proposals, and the deductions wait for a voucher again. Refused after a later payment
   * on the loans (an accepted liquidation) or a decided cap proposal. The caller deletes the stored sheet.
   */
  async revertVoucher(voucherId: string, reason: string, actorId: string): Promise<VoucherRevertSummary> {
    const owner = await this.prisma.voucher.findUnique({ where: { id: voucherId }, select: { variationId: true } });
    if (!owner) throw new NotFoundException('Voucher not found');

    return this.ledgerTx.transaction(
      async (tx) => {
        const variation = await this.lockVariation(tx, owner.variationId);
        const voucher = variation.voucher;
        if (!voucher || voucher.id !== voucherId) throw new NotFoundException('Voucher not found');
        const name = variation.organization.name;
        const month = periodLabel(variation.period);
        const label = `${name} · ${month}`;

        const current = lagosMonthOf(this.clock.now());
        if (comparePeriods(variation.period, current) !== 0) {
          throw new ConflictException(
            `Only a voucher for the current month (${periodLabel(current)}) can be reverted, and this one is for ${month}`,
          );
        }
        const next = nextPeriod(variation.period);
        const generated = await tx.variation.findFirst({
          where: { organizationId: variation.organizationId, period: { year: next.year, month: next.month } },
          select: { id: true },
        });
        if (generated) {
          throw new ConflictException(
            `${name}'s ${periodLabel(next)} variation exists: it was worked out from this voucher, so the voucher can't be reverted`,
          );
        }
        const finished = await tx.auditLog.findFirst({
          where: { action: 'VOUCHER_UPLOADED', entityType: 'VOUCHER', entityId: voucherId },
          select: { id: true },
        });
        if (!finished && this.clock.now().getTime() - voucher.createdAt.getTime() < PROCESSING_WINDOW_MS) {
          throw new ConflictException('This voucher is still being processed: try again in a few minutes');
        }

        const loanIds = [
          ...new Set([
            ...(await this.variationLoanIds(tx, variation.id)),
            ...(await this.voucherLoanIds(tx, voucherId)),
          ]),
        ].sort();
        await this.lockLoans(tx, loanIds);
        await this.assertNoPaymentSince(tx, loanIds, voucher.createdAt, voucherId);
        await this.assertProposalsPending(tx, variation.id);

        const undone = await this.undo(tx, { variationId: variation.id, voucherId, loanIds });
        await tx.voucher.delete({ where: { id: voucherId } });
        await this.ledgerTx.audit(tx, {
          actorId,
          action: 'VOUCHER_REVERTED',
          entityType: 'VARIATION',
          entityId: variation.id,
          note:
            `${label}: ${reason} (${undone.inflowsRemoved} payments removed, ${undone.penaltiesRemoved} penalties ` +
            `removed, ${undone.proposalsWithdrawn} proposals withdrawn)`,
          meta: { voucherId, filename: voucher.filename },
        });
        return {
          variationId: variation.id,
          label,
          ...undone,
          stored: { period: variation.period, fileHash: voucher.fileHash },
        };
      },
      { timeout: UNDO_TIMEOUT },
    );
  }

  /**
   * What a revert undoes, inside the caller's transaction with the variation and its loans locked: the voucher's
   * money, the penalties and cap proposals, and the settling of the deductions. Every loan it touched is recomputed
   * and checked against the ledger invariants.
   */
  private async undo(
    tx: Tx,
    input: { variationId: string; voucherId: string | null; loanIds: string[] },
  ): Promise<Omit<RevertSummary, 'variationId' | 'label'>> {
    const { variationId, voucherId, loanIds } = input;

    let inflowsRemoved = 0;
    if (voucherId) {
      await tx.$executeRaw`
        UPDATE "Loan" l SET "repaid" = l."repaid" - r."total"
        FROM (
          SELECT rp."loanId", SUM(rp."amount") AS "total"
          FROM "Repayment" rp JOIN "PaymentInflow" pi ON pi."id" = rp."paymentInflowId"
          WHERE pi."voucherId" = ${voucherId}
          GROUP BY rp."loanId"
        ) r
        WHERE l."id" = r."loanId"`;
      await tx.repaymentBreakdown.deleteMany({ where: { repayment: { paymentInflow: { voucherId } } } });
      await tx.repayment.deleteMany({ where: { paymentInflow: { voucherId } } });
      inflowsRemoved = (await tx.paymentInflow.deleteMany({ where: { voucherId } })).count;
    }

    await tx.$executeRaw`
      UPDATE "Loan" l SET "owed" = l."owed" - p."total"
      FROM (
        SELECT "loanId", SUM("amount") AS "total" FROM "MicroLoan"
        WHERE "variationId" = ${variationId} AND "purpose" = 'PENALTY' AND "status" = 'DISBURSED'
        GROUP BY "loanId"
      ) p
      WHERE l."id" = p."loanId"`;
    const penaltiesRemoved = (await tx.microLoan.deleteMany({ where: { variationId, purpose: 'PENALTY' } })).count;
    const proposalsWithdrawn = (await tx.tenureChange.deleteMany({ where: { variationId, status: 'PENDING' } })).count;
    await tx.deduction.updateMany({
      where: { variationId },
      data: { status: 'AWAITING', settledAt: null, penalizedAt: null },
    });

    for (const loanId of loanIds) {
      const balances = await loanBalances(tx, loanId);
      // What the voucher's payments cleared is owed again.
      if (balances.status === 'REPAID' && balances.outstanding.gt(0)) {
        await tx.loan.update({ where: { id: loanId }, data: { status: 'DISBURSED' } });
      }
      await this.deductions.refreshOpen(loanId, tx);
      await assertLedgerInvariants(tx, loanId);
    }
    return { inflowsRemoved, penaltiesRemoved, proposalsWithdrawn };
  }

  /** 409 when money reached these loans after `since` from anywhere but the voucher being reverted. */
  private async assertNoPaymentSince(
    tx: Tx,
    loanIds: string[],
    since: Date,
    voucherId: string | null,
  ): Promise<void> {
    if (loanIds.length === 0) return;
    const later = await tx.repayment.findFirst({
      where: {
        loanId: { in: loanIds },
        createdAt: { gt: since },
        ...(voucherId && { paymentInflow: { OR: [{ voucherId: null }, { voucherId: { not: voucherId } }] } }),
      },
      select: { id: true },
    });
    if (later) {
      throw new ConflictException(
        "A payment was applied to one of these loans after it was settled (for example an accepted liquidation), so it can't be undone",
      );
    }
  }

  /** 409 when a cap proposal this lock made has been decided: the loan's tenure may already have moved. */
  private async assertProposalsPending(tx: Tx, variationId: string): Promise<void> {
    const decided = await tx.tenureChange.findFirst({
      where: { variationId, status: { not: 'PENDING' } },
      select: { id: true },
    });
    if (decided) {
      throw new ConflictException("A tenure change proposed when it was settled has been decided, so it can't be undone");
    }
  }

  // ── Rematch (R4b) ─────────────────────────────────────────────────────────

  /**
   * Pays an issue row (UNMATCHED or REVIEWING) that an admin has matched to a loan, in the caller's transaction. The
   * deduction is the loan's in the voucher's variation. When the voucher's settling already failed or short-paid it
   * (penalizedAt set), the settling is undone for this loan alone: its penalty and pending cap proposal go, the
   * deduction is awaiting again, the payment is applied, and the deduction is settled again, with a penalty on
   * whatever is still short. When the penalty can't safely go (part of it was collected, or its tenure change was
   * decided) the payment pays the loan as before and `fallbackReason` says why. A deduction in another variation
   * isn't touched.
   */
  async rematch(input: RematchInput, tx: Tx): Promise<Rematch> {
    const { loanId, inflowId, actorId } = input;
    const amount = money(input.amount);
    await this.ledgerTx.lockLoan(tx, loanId);

    const variationId = input.voucherId
      ? ((await tx.voucher.findUnique({ where: { id: input.voucherId }, select: { variationId: true } }))
          ?.variationId ?? null)
      : null;
    const deduction = variationId
      ? await tx.deduction.findFirst({ where: { loanId, variationId } })
      : await tx.deduction.findFirst({
          where: { loanId, periodId: input.periodId, status: { in: ['AWAITING', 'PARTIAL'] } },
        });

    let payAgainst: string | null = null;
    let undone = false;
    let penalty: Money | null = null;
    let fallbackReason: string | null = null;
    if (deduction && variationId && deduction.penalizedAt && ['FAILED', 'PARTIAL'].includes(deduction.status)) {
      const plan = await this.penaltyUndoPlan(tx, loanId, variationId);
      if (plan.blockedBy === null) {
        undone = true;
        penalty = plan.penalty ? money(plan.penalty.amount) : null;
        if (plan.penalty) {
          await tx.microLoan.delete({ where: { id: plan.penalty.id } });
          await tx.loan.update({ where: { id: loanId }, data: { owed: { decrement: plan.penalty.amount } } });
        }
        if (plan.changeId) await tx.tenureChange.delete({ where: { id: plan.changeId } });
        await tx.deduction.update({
          where: { id: deduction.id },
          data: { status: 'AWAITING', settledAt: null, penalizedAt: null },
        });
        payAgainst = deduction.id;
      } else {
        fallbackReason = plan.blockedBy;
        // As before: a short deduction still takes the money, a failed one doesn't.
        payAgainst = deduction.status === 'PARTIAL' ? deduction.id : null;
      }
    } else if (deduction && (deduction.status === 'AWAITING' || deduction.status === 'PARTIAL')) {
      payAgainst = deduction.id;
    }

    const allocation = await this.ledger.allocatePayment(
      { loanId, amount, inflowId, deductionId: payAgainst ?? undefined },
      tx,
    );
    if (undone && deduction && variationId) {
      await this.settleDeduction(deduction.id, await this.settleContext(variationId, actorId, tx), tx);
    }
    await this.deductions.refreshOpen(loanId, tx);
    await assertLedgerInvariants(tx, loanId);
    return { allocation, deductionId: payAgainst, penalty, fallbackReason };
  }

  /** What undoing a loan's settling would remove, or why it can't be undone (the penalty stays). */
  private async penaltyUndoPlan(
    tx: Tx,
    loanId: string,
    variationId: string,
  ): Promise<{ blockedBy: string } | { blockedBy: null; penalty: { id: string; amount: Prisma.Decimal } | null; changeId: string | null }> {
    const [penalty, change] = await Promise.all([
      tx.microLoan.findFirst({
        where: { loanId, variationId, purpose: 'PENALTY' },
        select: { id: true, amount: true },
      }),
      tx.tenureChange.findFirst({ where: { loanId, variationId }, select: { id: true, status: true } }),
    ]);
    if (change && change.status !== 'PENDING') {
      return { blockedBy: 'The tenure change proposed with the penalty has already been decided, so the penalty stays' };
    }
    if (penalty) {
      const balances = await loanBalances(tx, loanId);
      if (balances.collected.penalty.gt(balances.booked.penalty.minus(penalty.amount))) {
        return { blockedBy: 'Part of the penalty has already been collected, so the penalty stays' };
      }
    }
    return { blockedBy: null, penalty, changeId: change?.id ?? null };
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  /** Locks the variation row, then reads it: whoever else is locking, generating or uploading waits. */
  private async lockVariation(tx: Tx, variationId: string): Promise<LockedVariation> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Variation" WHERE "id" = ${variationId} FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException('Variation not found');
    const variation = await tx.variation.findUniqueOrThrow({
      where: { id: variationId },
      select: {
        id: true,
        version: true,
        noPayrollReason: true,
        organizationId: true,
        organization: { select: { name: true } },
        period: { select: { year: true, month: true } },
        voucher: { select: { id: true, filename: true, fileHash: true, createdAt: true } },
      },
    });
    if (variation.version < 1) throw new NotFoundException('Variation not found');
    return variation;
  }

  private async lockLoans(tx: Tx, loanIds: string[]): Promise<void> {
    if (loanIds.length === 0) return;
    await tx.$queryRaw`SELECT "id" FROM "Loan" WHERE "id" IN (${Prisma.join(loanIds)}) ORDER BY "id" FOR UPDATE`;
  }

  /** The loans that hold a deduction of the variation, in id order. */
  private async variationLoanIds(tx: Tx, variationId: string): Promise<string[]> {
    const rows = await tx.deduction.findMany({
      where: { variationId },
      select: { loanId: true },
      distinct: ['loanId'],
      orderBy: { loanId: 'asc' },
    });
    return rows.map((row) => row.loanId);
  }

  /** The loans the voucher's payments reached: a manual resolution may have paid a loan outside the variation. */
  private async voucherLoanIds(tx: Tx, voucherId: string): Promise<string[]> {
    const rows = await tx.repayment.findMany({
      where: { paymentInflow: { voucherId } },
      select: { loanId: true },
      distinct: ['loanId'],
    });
    return rows.map((row) => row.loanId);
  }
}
