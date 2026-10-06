import { Injectable, Logger } from '@nestjs/common';
import { periodLabel } from '@microbuilt/shared';
import { Prisma, type DeductionStatus } from '@prisma/client';
import { captureJobError } from 'src/common/observability';
import { PrismaService } from 'src/database/prisma.service';
import { SettingsService } from 'src/settings/settings.service';
import { loanBalances } from './balances';
import { DeductionsService } from './deductions.service';
import { LedgerClock } from './ledger.clock';
import { capExtension, penaltyFor } from './ledger.math';
import { LedgerService } from './ledger.service';
import { LedgerTx, type Tx } from './ledger.tx';
import { money, naira, sum, toNumber, ZERO, type Money } from './money';
import { TenureChangesService } from './tenure-changes.service';

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

// Settling a locked variation (PLAN_V2 R4 step 2; what closing a month used to do): whatever payroll didn't pay is
// final. A deduction that got nothing becomes FAILED, a short one stays PARTIAL, and each shortfall is charged a
// penalty that flows into the months still open. The penalty and any cap proposal carry the variationId, which is
// what a revert (R6) or a rematch (R4b) undoes. One transaction per loan, so one bad row can't undo the rest, and a
// re-run skips every row already done (penalizedAt).
//
// Stage C adds no payroll (R5), revert (R6) and rematch (R4b) here.
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
    private readonly clock: LedgerClock,
  ) {}

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
}
