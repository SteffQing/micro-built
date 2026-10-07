import { Injectable, NotFoundException } from '@nestjs/common';
import { comparePeriods, nextPeriod, type Period } from '@microbuilt/shared';
import type { Period as PeriodRow } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerClock } from './ledger.clock';
import type { Tx } from './ledger.tx';
import { lagosMonthOf } from './period';

@Injectable()
export class PeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: LedgerClock,
  ) {}

  /**
   * The row for a month, created on first use. INSERT … ON CONFLICT so two transactions creating
   * the same month never fail (a unique violation would abort the surrounding transaction).
   */
  async ensure(period: Period, tx?: Tx): Promise<PeriodRow> {
    const db = tx ?? this.prisma;
    await db.$executeRaw`
      INSERT INTO "Period" ("id", "year", "month")
      VALUES (${randomUUID()}, ${period.year}, ${period.month}::"Month")
      ON CONFLICT ("year", "month") DO NOTHING`;
    return db.period.findUniqueOrThrow({
      where: { year_month: { year: period.year, month: period.month } },
    });
  }

  /** The month it is now in Lagos. */
  current(tx?: Tx): Promise<PeriodRow> {
    return this.ensure(lagosMonthOf(this.clock.now()), tx);
  }

  async findOrThrow(periodId: string, tx?: Tx): Promise<PeriodRow> {
    const period = await (tx ?? this.prisma).period.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Payroll period not found');
    return period;
  }

  /**
   * Where a loan's OPEN deduction goes (PLAN_V2 R1): the Lagos month of `from` (its disbursement), or the month
   * after its latest frozen deduction when that is later, moved past every month its borrower's organization already
   * has a variation for: that month's file has gone to payroll without it.
   */
  async firstOpenMonthFor(loanId: string, from: Date, tx?: Tx): Promise<PeriodRow> {
    const db = tx ?? this.prisma;
    const loan = await db.loan.findUniqueOrThrow({
      where: { id: loanId },
      select: { borrower: { select: { payroll: { select: { organizationId: true } } } } },
    });
    const latest = await db.deduction.findFirst({
      where: { loanId, status: { not: 'OPEN' } },
      orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
      select: { period: { select: { year: true, month: true } } },
    });
    let period = lagosMonthOf(from);
    if (latest && comparePeriods(nextPeriod(latest.period), period) > 0) period = nextPeriod(latest.period);

    const organizationId = loan.borrower.payroll?.organizationId;
    for (let months = 0; months < 120; months++) {
      const sent =
        organizationId &&
        (await db.variation.findFirst({
          where: { organizationId, period: { year: period.year, month: period.month } },
          select: { id: true },
        }));
      if (!sent) return this.ensure(period, tx);
      period = nextPeriod(period);
    }
    throw new Error('No month without a variation in the next ten years');
  }
}
