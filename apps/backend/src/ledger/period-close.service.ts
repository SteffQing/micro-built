import { ConflictException, Injectable, Logger } from '@nestjs/common';
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
import { money, sum, toNumber, ZERO, type Money } from './money';
import { PeriodsService } from './periods.service';
import { TenureChangesService } from './tenure-changes.service';

export interface CloseSummary {
  periodId: string;
  label: string;
  /** False when some deductions failed to close; run the close again (finished rows are skipped). */
  closed: boolean;
  /** Settled without a penalty: loan already repaid, or nothing was due. */
  settled: number;
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

interface CloseContext {
  actorId: string;
  label: string;
  penaltyRate: Prisma.Decimal;
  maxDeductionRate: Prisma.Decimal | null;
}

type Outcome =
  | { kind: 'skipped' }
  | { kind: 'settled' }
  | { kind: 'charged'; status: DeductionStatus; penalty: Money; proposed: boolean };

// Closing a payroll month (V2.MD §0.5): whatever payroll didn't pay is final. A deduction that
// got nothing becomes FAILED, a short one stays PARTIAL, and each shortfall is charged a penalty
// that flows into the months still open. One transaction per loan, so one bad row can't undo the
// rest, and a re-run skips every row already done (penalizedAt).
@Injectable()
export class PeriodCloseService {
  private readonly logger = new Logger(PeriodCloseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly ledger: LedgerService,
    private readonly deductions: DeductionsService,
    private readonly tenureChanges: TenureChangesService,
    private readonly periods: PeriodsService,
    private readonly settings: SettingsService,
    private readonly clock: LedgerClock,
  ) {}

  async close(periodId: string, actorId: string): Promise<CloseSummary> {
    const period = await this.periods.findOrThrow(periodId);
    const label = periodLabel(period);
    if (!period.variationSubmittedAt) throw new ConflictException(`Submit the ${label} variation before closing it`);
    if (period.closedAt) throw new ConflictException(`${label} is already closed`);
    const penaltyRate = await this.settings.requirePenaltyRate();
    const { maxDeductionRate } = await this.settings.get();
    const context: CloseContext = { actorId, label, penaltyRate, maxDeductionRate };

    const open = await this.prisma.deduction.findMany({
      where: { periodId, penalizedAt: null, status: { in: ['AWAITING', 'PARTIAL'] } },
      select: { id: true },
      orderBy: { loanId: 'asc' },
    });

    const summary: CloseSummary = {
      periodId,
      label,
      closed: false,
      settled: 0,
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
        const outcome = await this.closeDeduction(id, context);
        if (outcome.kind === 'settled') summary.settled++;
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
        this.logger.error(`Closing deduction ${id} of ${label} failed: ${message}`);
        captureJobError(error, { job: 'period.close', jobId: id });
      }
    }
    summary.penaltyTotal = toNumber(sum(charged));

    if (summary.errors.length === 0) {
      const { count } = await this.prisma.payrollPeriod.updateMany({
        where: { id: periodId, closedAt: null },
        data: { closedAt: this.clock.now() },
      });
      if (count > 0) {
        await this.prisma.auditLog.create({
          data: {
            actorId,
            action: 'PERIOD_CLOSED',
            entityType: 'PAYROLL_PERIOD',
            entityId: periodId,
            note: `${summary.failed} failed, ${summary.partial} short, ₦${summary.penaltyTotal} in penalties`,
            createdAt: this.clock.now(),
          },
        });
      }
      summary.closed = true;
    }
    return summary;
  }

  private closeDeduction(id: string, context: CloseContext): Promise<Outcome> {
    return this.ledgerTx.transaction(async (tx) => {
      const { loanId } = await tx.deduction.findUniqueOrThrow({ where: { id }, select: { loanId: true } });
      await this.ledgerTx.lockLoan(tx, loanId);
      // Read again under the lock: a concurrent close may have finished it, a payment may have landed.
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
        const note = `${context.label}: ₦${shortfall.toFixed(2)} short × ${rate}%`;
        await this.ledger.addPenalty(loanId, penalty, context.actorId, note, tx);
      } else {
        // Its expected no longer counts as committed, so the OPEN month takes up the shortfall.
        await this.deductions.refreshOpen(loanId, tx);
      }

      const netPay = loan.borrower.payroll?.netPay ?? null;
      const proposed = await this.proposeIfOverCap(loanId, netPay, context.maxDeductionRate, tx);
      return { kind: 'charged', status, penalty, proposed };
    });
  }

  /**
   * V2.MD §0.4-1: when the OPEN deduction is now more than `netPay × maxDeductionRate`, propose
   * the smallest tenure extension that brings it back under — once (never with a change pending),
   * and never applied without an admin.
   */
  private async proposeIfOverCap(
    loanId: string,
    netPay: Prisma.Decimal | null,
    maxDeductionRate: Prisma.Decimal | null,
    tx: Tx,
  ): Promise<boolean> {
    if (!maxDeductionRate || !netPay || netPay.lte(0)) return false;
    const cap = money(netPay.mul(maxDeductionRate));
    const open = await tx.deduction.findFirst({ where: { loanId, status: 'OPEN' }, select: { expected: true } });
    if (!open || open.expected.lte(cap)) return false;
    if (await tx.tenureChange.findFirst({ where: { loanId, status: 'PENDING' }, select: { id: true } })) return false;

    const balances = await loanBalances(tx, loanId);
    const base = money(Prisma.Decimal.max(0, balances.outstanding.minus(balances.committed)));
    const monthsDelta = capExtension(base, cap, balances.tenure, balances.frozenCount);
    if (monthsDelta < 1) return false;
    await this.tenureChanges.propose({ loanId, monthsDelta, reason: 'DEFAULT', requestedById: null }, tx);
    return true;
  }
}
