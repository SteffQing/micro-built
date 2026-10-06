import { Injectable, NotFoundException } from '@nestjs/common';
import { nextPeriod, type Period } from '@microbuilt/shared';
import type { PayrollPeriod } from '@prisma/client';
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
   * The row for a payroll month, created on first use. INSERT … ON CONFLICT so two
   * transactions creating the same month never fail (a unique violation would abort the
   * surrounding transaction).
   */
  async ensure(period: Period, tx?: Tx): Promise<PayrollPeriod> {
    const db = tx ?? this.prisma;
    await db.$executeRaw`
      INSERT INTO "PayrollPeriod" ("id", "year", "month")
      VALUES (${randomUUID()}, ${period.year}, ${period.month}::"Month")
      ON CONFLICT ("year", "month") DO NOTHING`;
    return db.payrollPeriod.findUniqueOrThrow({
      where: { year_month: { year: period.year, month: period.month } },
    });
  }

  /** The payroll month it is now in Lagos. */
  current(tx?: Tx): Promise<PayrollPeriod> {
    return this.ensure(lagosMonthOf(this.clock.now()), tx);
  }

  async findOrThrow(periodId: string, tx?: Tx): Promise<PayrollPeriod> {
    const period = await (tx ?? this.prisma).payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Payroll period not found');
    return period;
  }

  /**
   * The month the next variation is for: the earliest holding OPEN deductions (they all sit in the first month not
   * yet generated). With none open, the first month from now that hasn't been generated.
   */
  async openVariationPeriod(): Promise<Period> {
    const open = await this.prisma.deduction.findFirst({
      where: { status: 'OPEN' },
      orderBy: [{ period: { year: 'asc' } }, { period: { month: 'asc' } }],
      select: { period: { select: { year: true, month: true } } },
    });
    return open?.period ?? (await this.firstUnsubmittedFrom(this.clock.now()));
  }

  /**
   * The earliest month whose variation went to payroll and whose deductions still wait on the payroll file
   * (AWAITING); null when payroll owes no file.
   */
  async awaitingPayrollPeriod(): Promise<Period | null> {
    const awaiting = await this.prisma.deduction.findFirst({
      where: { status: 'AWAITING' },
      orderBy: [{ period: { year: 'asc' } }, { period: { month: 'asc' } }],
      select: { period: { select: { year: true, month: true } } },
    });
    return awaiting?.period ?? null;
  }

  /**
   * The first month from `date`'s Lagos month whose variation hasn't gone to payroll: where a
   * newly disbursed loan's first deduction belongs. Variations are submitted in month order, so
   * every month before it has been sent.
   */
  async firstUnsubmittedFrom(date: Date, tx?: Tx): Promise<PayrollPeriod> {
    const db = tx ?? this.prisma;
    let period = lagosMonthOf(date);
    for (let months = 0; months < 120; months++) {
      const row = await db.payrollPeriod.findUnique({
        where: { year_month: { year: period.year, month: period.month } },
      });
      if (!row) return this.ensure(period, tx);
      if (!row.variationSubmittedAt) return row;
      period = nextPeriod(period);
    }
    throw new Error('No unsubmitted payroll period in the next ten years');
  }
}
