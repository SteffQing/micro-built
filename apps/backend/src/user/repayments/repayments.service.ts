import { Injectable, NotFoundException } from '@nestjs/common';
import { MONTHS, periodLabel, type Period } from '@microbuilt/shared';
import type { Prisma } from '@prisma/client';
import { parsePeriodRange, periodWhere } from 'src/common/dto/period.dto';
import { PrismaService } from 'src/database/prisma.service';
import { loanBalancesMany } from 'src/ledger/balances';
import { sum, toNumber, ZERO } from 'src/ledger/money';
import { lagosMonthOf } from 'src/ledger/period';
import type { UserRepaymentsQueryDto } from '../common/dto/repayments.dto';
import type { UserRepaymentDto, UserRepaymentsOverviewDto } from '../common/entities/repayments.entities';

export const REPAYMENT_NOT_FOUND = 'Repayment not found';

/** Months on the overview chart, ending with the current payroll month. */
const CHART_MONTHS = 12;

const REPAYMENT = {
  id: true,
  loanId: true,
  amount: true,
  createdAt: true,
  paymentInflow: { select: { source: true, period: { select: { month: true, year: true } } } },
  deduction: { select: { expected: true, status: true } },
} satisfies Prisma.RepaymentSelect;

type RepaymentRow = Prisma.RepaymentGetPayload<{ select: typeof REPAYMENT }>;

/** The `count` payroll months up to and including `last`, oldest first. */
export function monthsUpTo(last: Period, count: number): Period[] {
  const end = last.year * 12 + MONTHS.indexOf(last.month);
  return Array.from({ length: count }, (_, i) => {
    const index = end - (count - 1) + i;
    return { year: Math.floor(index / 12), month: MONTHS[index % 12] };
  });
}

// The customer's Repayment rows (money applied to their loans), each with the payroll month and
// source of the inflow it came on. No component split: the customer's copy leaves it out.
@Injectable()
export class RepaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(customerId: string): Promise<UserRepaymentsOverviewDto> {
    const mine = { loan: { borrowerId: customerId } };
    const months = monthsUpTo(lagosMonthOf(new Date()), CHART_MONTHS);
    const [totals, missedCount, last, liveLoans, open, chartRows] = await Promise.all([
      this.prisma.repayment.aggregate({ where: mine, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.deduction.count({ where: { ...mine, status: { in: ['FAILED', 'PARTIAL'] } } }),
      this.prisma.repayment.findFirst({ where: mine, orderBy: { createdAt: 'desc' }, select: REPAYMENT }),
      this.prisma.loan.findMany({ where: { borrowerId: customerId, status: 'DISBURSED' }, select: { id: true } }),
      this.prisma.deduction.findFirst({
        where: { status: 'OPEN', loan: { borrowerId: customerId, status: 'DISBURSED' } },
        select: { expected: true, period: { select: { month: true, year: true } } },
      }),
      this.prisma.repayment.findMany({
        where: {
          ...mine,
          paymentInflow: { period: periodWhere({ from: months[0], to: months[months.length - 1] }) },
        },
        select: { amount: true, paymentInflow: { select: { period: { select: { month: true, year: true } } } } },
      }),
    ]);

    const balances = await loanBalancesMany(
      this.prisma,
      liveLoans.map((loan) => loan.id),
    );
    const outstanding = sum([...balances.values()].map((loan) => loan.outstanding));

    const perMonth = new Map<string, Prisma.Decimal>();
    for (const row of chartRows) {
      const label = periodLabel(row.paymentInflow.period);
      perMonth.set(label, (perMonth.get(label) ?? ZERO).plus(row.amount));
    }

    return {
      totalRepaid: toNumber(totals._sum.amount ?? 0),
      outstanding: toNumber(outstanding),
      repaymentsCount: totals._count._all,
      missedCount,
      thisMonth: open && open.expected.gt(0) ? { amount: toNumber(open.expected), period: periodLabel(open.period) } : null,
      lastRepayment: last
        ? {
            amount: toNumber(last.amount),
            date: last.createdAt,
            period: periodLabel(last.paymentInflow.period),
            source: last.paymentInflow.source,
          }
        : null,
      chart: months.map((period) => {
        const label = periodLabel(period);
        return { period: label, amount: toNumber(perMonth.get(label) ?? 0) };
      }),
    };
  }

  /** Newest first; `from`/`to` (YYYY-MM) filter by the payroll month the money belongs to. */
  async getRepayments(customerId: string, query: UserRepaymentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const range = parsePeriodRange(query);
    const where: Prisma.RepaymentWhereInput = {
      loan: { borrowerId: customerId },
      ...((range.from || range.to) && { paymentInflow: { period: periodWhere(range) } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.repayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: REPAYMENT,
      }),
      this.prisma.repayment.count({ where }),
    ]);
    return { data: rows.map(toRepayment), meta: { total, page, limit } };
  }

  async getRepayment(customerId: string, id: string): Promise<UserRepaymentDto> {
    const row = await this.prisma.repayment.findFirst({
      where: { id, loan: { borrowerId: customerId } },
      select: REPAYMENT,
    });
    if (!row) throw new NotFoundException(REPAYMENT_NOT_FOUND);
    return toRepayment(row);
  }
}

function toRepayment(row: RepaymentRow): UserRepaymentDto {
  return {
    id: row.id,
    loanId: row.loanId,
    amount: toNumber(row.amount),
    date: row.createdAt,
    period: periodLabel(row.paymentInflow.period),
    source: row.paymentInflow.source,
    expected: row.deduction ? toNumber(row.deduction.expected) : null,
    deductionStatus: row.deduction?.status ?? null,
  };
}
