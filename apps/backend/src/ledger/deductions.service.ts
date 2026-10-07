import { Injectable } from '@nestjs/common';
import { comparePeriods, nextPeriod } from '@microbuilt/shared';
import type { Deduction } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { loanBalances } from './balances';
import { LedgerClock } from './ledger.clock';
import { openExpected, remainingMonths } from './ledger.math';
import type { Tx } from './ledger.tx';
import { ZERO, type Money } from './money';
import { PeriodsService } from './periods.service';

// A loan has at most one OPEN deduction (invariants.sql): the month still being worked out.
// Its amount follows every change to what is owed, what was paid or the tenure, until its
// organization's variation for that month is generated and it freezes (AWAITING). After that the
// loan has no OPEN row until something changes it again (PLAN_V2 R1): refreshOpen then opens the
// next month, which a regeneration folds back in.
@Injectable()
export class DeductionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periods: PeriodsService,
    private readonly clock: LedgerClock,
  ) {}

  remainingMonths(tenure: number, frozenCount: number): number {
    return remainingMonths(tenure, frozenCount);
  }

  /**
   * Recomputes the OPEN deduction (V2.MD §0.5). Call after every change to owed, repaid or
   * tenure. A loan that is no longer DISBURSED keeps 0 — the STOP row. When the loan has no OPEN
   * row (its last one was frozen into a variation), one is opened in the month PLAN_V2 R1 gives:
   * for a running loan, and for one no longer running that payroll still deducts a non-zero amount
   * from, so its organization's next variation sends the STOP. Returns the new amount, or null when
   * the loan has no OPEN deduction and needs none.
   */
  async refreshOpen(loanId: string, tx?: Tx): Promise<Money | null> {
    const db = tx ?? this.prisma;
    const open = await db.deduction.findFirst({
      where: { loanId, status: 'OPEN' },
      select: { id: true, expected: true },
    });

    const balances = await loanBalances(db, loanId);
    const expected =
      balances.status === 'DISBURSED'
        ? openExpected(balances.outstanding, balances.committed, balances.remainingMonths, balances.lastSent)
        : ZERO;
    if (!open) {
      const running = balances.status === 'DISBURSED';
      const stillDeducted = balances.status === 'REPAID' && balances.lastSent !== null && !balances.lastSent.isZero();
      if (!running && !stillDeducted) return null;
      const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId }, select: { disbursementDate: true } });
      const period = await this.periods.firstOpenMonthFor(loanId, loan.disbursementDate ?? this.clock.now(), tx);
      await db.deduction.create({ data: { loanId, periodId: period.id, expected } });
      return expected;
    }
    if (!expected.equals(open.expected)) {
      // Guarded by status: if a generation froze it meanwhile, payroll keeps the amount it was sent.
      await db.deduction.updateMany({ where: { id: open.id, status: 'OPEN' }, data: { expected } });
    }
    return expected;
  }

  /**
   * After its borrower moves organization (PLAN_V2 P12): an OPEN deduction in a month the new
   * organization already has a variation for, or one before it, can never be generated (P9), and
   * would block the organization's next generation (R3). It moves to the month after the new
   * organization's latest variation. Locks the loan's OPEN row; call inside the move's transaction.
   */
  async rehomeOpen(loanId: string, tx: Tx): Promise<void> {
    const open = await tx.deduction.findFirst({
      where: { loanId, status: 'OPEN' },
      select: { id: true, period: { select: { year: true, month: true } } },
    });
    if (!open) return;
    const loan = await tx.loan.findUniqueOrThrow({
      where: { id: loanId },
      select: { borrower: { select: { payroll: { select: { organizationId: true } } } } },
    });
    const organizationId = loan.borrower.payroll?.organizationId;
    if (!organizationId) return;
    const latest = await tx.variation.findFirst({
      where: { organizationId },
      orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
      select: { period: { select: { year: true, month: true } } },
    });
    if (!latest || comparePeriods(open.period, latest.period) > 0) return;
    const target = await this.periods.ensure(nextPeriod(latest.period), tx);
    await tx.deduction.update({ where: { id: open.id }, data: { periodId: target.id } });
    await this.refreshOpen(loanId, tx);
  }

  /**
   * A newly disbursed loan's first deduction, in its disbursement month unless its organization's
   * variation for that month has already gone to payroll (PLAN_V2 R1). `from` replaces the
   * disbursement: an imported loan disbursed long ago starts now.
   */
  async openFirst(loanId: string, tx?: Tx, from?: Date): Promise<Deduction> {
    const db = tx ?? this.prisma;
    const loan = await db.loan.findUniqueOrThrow({
      where: { id: loanId },
      select: { disbursementDate: true },
    });
    const period = await this.periods.firstOpenMonthFor(loanId, from ?? loan.disbursementDate ?? this.clock.now(), tx);
    const balances = await loanBalances(db, loanId);
    return db.deduction.create({
      data: {
        loanId,
        periodId: period.id,
        expected: openExpected(balances.outstanding, balances.committed, balances.remainingMonths, balances.lastSent),
      },
    });
  }
}
