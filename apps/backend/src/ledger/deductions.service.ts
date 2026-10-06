import { Injectable } from '@nestjs/common';
import type { Deduction } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { loanBalances } from './balances';
import { LedgerClock } from './ledger.clock';
import { openExpected, remainingMonths } from './ledger.math';
import type { Tx } from './ledger.tx';
import { ZERO, type Money } from './money';
import { PeriodsService } from './periods.service';

// A loan has at most one OPEN deduction (invariants.sql): the month still being worked out.
// Its amount follows every change to what is owed, what was paid or the tenure, until the
// month's variation is submitted and it freezes (AWAITING).
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
   * tenure. A loan that is no longer DISBURSED keeps 0 — the STOP row. Returns the new amount,
   * or null when the loan has no OPEN deduction.
   */
  async refreshOpen(loanId: string, tx?: Tx): Promise<Money | null> {
    const db = tx ?? this.prisma;
    const open = await db.deduction.findFirst({
      where: { loanId, status: 'OPEN' },
      select: { id: true, expected: true },
    });
    if (!open) return null;

    const balances = await loanBalances(db, loanId);
    const expected =
      balances.status === 'DISBURSED'
        ? openExpected(balances.outstanding, balances.committed, balances.remainingMonths, balances.lastSent)
        : ZERO;
    if (!expected.equals(open.expected)) {
      // Guarded by status: if a submit froze it meanwhile, payroll keeps the amount it was sent.
      await db.deduction.updateMany({ where: { id: open.id, status: 'OPEN' }, data: { expected } });
    }
    return expected;
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
