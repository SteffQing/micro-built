import { BadRequestException, Injectable } from '@nestjs/common';
import { comparePeriods, nextPeriod, periodLabel, toYm, type Period } from '@microbuilt/shared';
import { LoanCategory, LoanStatus, Prisma } from '@prisma/client';
import { instantRange, parsePeriodRange, periodWhere, type PeriodRange } from 'src/common/dto';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { PeriodsService } from 'src/ledger/periods.service';
import { money, toNumber, ZERO, type Money } from 'src/ledger/money';
import { lagosMonthOf, monthsBetween } from 'src/ledger/period';
import { toPercent } from 'src/settings/rates';
import { SettingsService } from 'src/settings/settings.service';
import type {
  DashboardDisbursementMonthDto,
  DashboardOpenLoanRequestsDto,
  DashboardOperationsDto,
  DashboardOverviewDto,
  LoanReportOverviewDto,
  LoanReportStatusDistributionDto,
} from '../common/entities/dashboard.entities';

// Platform-wide figures for the admin dashboard (V2.MD Stage 5 "Dashboard fields"). Everything
// is aggregated in SQL. Booked figures count DISBURSED microloans whose disbursedAt falls inside
// the Lagos bounds of from..to; collected figures count repayments whose payment belongs to a
// payroll month in from..to. Counts and `outstanding` are snapshots of now.

export type RangeQuery = { from?: string; to?: string };

/** The disbursement chart covers at most this many months. */
export const CHART_MAX_MONTHS = 60;

interface Booked {
  principal: Money;
  interest: Money;
  penalty: Money;
  managementFee: Money;
}

interface BookedRow {
  principal: Prisma.Decimal.Value | null;
  interest: Prisma.Decimal.Value | null;
  penalty: Prisma.Decimal.Value | null;
  managementFee: Prisma.Decimal.Value | null;
}

interface Collected {
  principal: Money;
  interest: Money;
  penalty: Money;
}

const BORROWER = { select: { userId: true, user: { select: { name: true } } } } as const;
const OPENING_STATUSES: LoanStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly clock: LedgerClock,
    private readonly periods: PeriodsService,
  ) {}

  async overview(query: RangeQuery = {}): Promise<DashboardOverviewDto> {
    const range = parsePeriodRange(query);
    const [counts, booked, collected, outstanding] = await Promise.all([
      this.counts(),
      this.booked(range),
      this.collected(range),
      this.outstanding(),
    ]);
    return {
      activeCount: counts.active,
      pendingCount: counts.pending,
      totalLoanAmount: toNumber(booked.principal.plus(booked.interest)),
      totalDisbursed: toNumber(booked.principal.minus(booked.managementFee)),
      managementFee: toNumber(booked.managementFee),
      interestBooked: toNumber(booked.interest),
      interestCollected: toNumber(collected.interest),
      penaltyCharged: toNumber(booked.penalty),
      penaltyCollected: toNumber(collected.penalty),
      grossProfit: toNumber(booked.managementFee.plus(booked.interest)),
      outstanding: toNumber(outstanding),
    };
  }

  async loanReportOverview(query: RangeQuery = {}): Promise<LoanReportOverviewDto> {
    const range = parsePeriodRange(query);
    const [counts, booked, collected, outstanding] = await Promise.all([
      this.counts(),
      this.booked(range),
      this.collected(range),
      this.outstanding(),
    ]);
    return {
      totalLoanAmount: toNumber(booked.principal.plus(booked.interest)),
      totalDisbursed: toNumber(booked.principal.minus(booked.managementFee)),
      outstanding: toNumber(outstanding),
      totalRepaid: toNumber(collected.principal.plus(collected.interest).plus(collected.penalty)),
      interestBooked: toNumber(booked.interest),
      interestCollected: toNumber(collected.interest),
      activeLoansCount: counts.active,
      pendingLoansCount: counts.pending,
    };
  }

  /**
   * Principal disbursed (new loans and top-ups) per Lagos month and loan category, one entry per
   * month of the range, empty months included. Defaults: `to` = the current month, `from` =
   * January of `to`'s year.
   */
  async disbursementChart(query: RangeQuery = {}): Promise<DashboardDisbursementMonthDto[]> {
    const parsed = parsePeriodRange(query);
    const to: Period = parsed.to ?? lagosMonthOf(this.clock.now());
    const from: Period = parsed.from ?? { year: to.year, month: 'JANUARY' };
    if (comparePeriods(from, to) > 0) throw new BadRequestException('`from` must not be after `to`');
    if (monthsBetween(from, to) + 1 > CHART_MAX_MONTHS) {
      throw new BadRequestException(`Pick at most ${CHART_MAX_MONTHS} months for the chart`);
    }

    const rows = await this.prisma.$queryRaw<{ ym: string; category: LoanCategory; total: Prisma.Decimal.Value }[]>`
      SELECT to_char((m."disbursedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos', 'YYYY-MM') AS "ym",
             l."category"::text AS "category",
             SUM(m."amount") AS "total"
      FROM "MicroLoan" m
      JOIN "Loan" l ON l."id" = m."loanId"
      WHERE m."status" = 'DISBURSED' AND m."purpose" IN ('NEW_LOAN', 'TOPUP')
        ${instantSql(Prisma.sql`m."disbursedAt"`, { from, to })}
      GROUP BY 1, 2`;

    const months = new Map<string, DashboardDisbursementMonthDto>();
    for (let period: Period = from; comparePeriods(period, to) <= 0; period = nextPeriod(period)) {
      months.set(toYm(period), { period: periodLabel(period), categories: {}, total: 0 });
    }
    for (const row of rows) {
      const month = months.get(row.ym);
      const amount = money(row.total);
      if (!month || amount.lte(0)) continue;
      month.categories[row.category] = amount.toNumber();
      month.total = toNumber(money(month.total).plus(amount));
    }
    return [...months.values()];
  }

  async openLoanRequests(): Promise<DashboardOpenLoanRequestsDto> {
    const [loans, topups, requests] = await Promise.all([
      // An asset loan is PENDING with principal 0 until its request is priced: it is listed
      // with the asset requests instead.
      this.prisma.loan.findMany({
        where: { status: 'PENDING', category: { not: 'ASSET_PURCHASE' } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, principal: true, category: true, createdAt: true, borrower: BORROWER },
      }),
      this.prisma.microLoan.findMany({
        where: { purpose: 'TOPUP', status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          loan: { select: { id: true, category: true, borrower: BORROWER } },
        },
      }),
      this.prisma.commodityLoan.findMany({
        where: { status: 'IN_REVIEW' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          commodity: { select: { name: true } },
          loan: { select: { id: true, category: true, status: true, borrower: BORROWER } },
        },
      }),
    ]);

    return {
      cashLoans: loans.map((loan) => ({
        id: loan.id,
        customerId: loan.borrower.userId,
        customerName: loan.borrower.user.name,
        amount: toNumber(loan.principal),
        category: loan.category,
        requestedAt: loan.createdAt,
      })),
      topups: topups.map((topup) => ({
        id: topup.id,
        loanId: topup.loan.id,
        customerId: topup.loan.borrower.userId,
        customerName: topup.loan.borrower.user.name,
        amount: toNumber(topup.amount),
        category: topup.loan.category,
        requestedAt: topup.createdAt,
      })),
      commodityLoans: requests.map((request) => ({
        id: request.id,
        loanId: request.loan.id,
        customerId: request.loan.borrower.userId,
        customerName: request.loan.borrower.user.name,
        name: request.commodity.name,
        // As in the loan lists: a request on an asset loan not yet disbursed opens it; any
        // other request tops up the running loan.
        kind:
          request.loan.category === 'ASSET_PURCHASE' && OPENING_STATUSES.includes(request.loan.status)
            ? 'NEW_LOAN'
            : 'TOPUP',
        category: LoanCategory.ASSET_PURCHASE,
        requestedAt: request.createdAt,
      })),
    };
  }

  async statusDistribution(): Promise<LoanReportStatusDistributionDto> {
    const groups = await this.prisma.loan.groupBy({ by: ['status'], _count: { _all: true } });
    const statusCounts = Object.fromEntries(Object.values(LoanStatus).map((status) => [status, 0])) as Record<
      LoanStatus,
      number
    >;
    for (const group of groups) statusCounts[group.status] = group._count._all;
    return { statusCounts };
  }

  /** The operational pulse: latest payroll upload, rates, work waiting on an admin, newest loans and customers. */
  async operations(): Promise<DashboardOperationsDto> {
    const [
      settings,
      lastUpload,
      manualResolutions,
      pendingLiquidations,
      flaggedCustomers,
      pendingTenureChanges,
      recentLoans,
      recentCustomers,
      awaiting,
      nextVariation,
    ] = await Promise.all([
      this.settings.get(),
      this.prisma.payrollUpload.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, period: { select: { year: true, month: true } } },
      }),
      this.prisma.paymentInflow.count({ where: { state: { in: ['UNMATCHED', 'REVIEWING'] } } }),
      this.prisma.paymentInflow.count({ where: { source: 'LIQUIDATION', state: 'AWAITING' } }),
      this.prisma.customer.count({ where: { user: { status: 'FLAGGED' } } }),
      this.prisma.tenureChange.count({ where: { status: 'PENDING' } }),
      this.prisma.loan.findMany({
        where: { disbursementDate: { not: null } },
        orderBy: { disbursementDate: 'desc' },
        take: 5,
        select: {
          id: true,
          principal: true,
          category: true,
          status: true,
          disbursementDate: true,
          borrower: BORROWER,
        },
      }),
      this.prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { userId: true, createdAt: true, user: { select: { name: true, status: true } } },
      }),
      this.periods.awaitingPayrollPeriod(),
      this.periods.openVariationPeriod(),
    ]);

    const now = lagosMonthOf(this.clock.now());
    return {
      lastRepaymentRun: lastUpload
        ? { period: periodLabel(lastUpload.period), date: lastUpload.createdAt, upToDate: awaiting === null }
        : null,
      currentPeriod: periodLabel(now),
      awaitingPayrollPeriod: awaiting ? periodLabel(awaiting) : null,
      nextVariationPeriod: periodLabel(nextVariation),
      rates: {
        interestRate: toPercent(settings.interestRate),
        managementFeeRate: toPercent(settings.managementFeeRate),
        penaltyRate: toPercent(settings.penaltyRate),
        maxDeductionRate: toPercent(settings.maxDeductionRate),
      },
      attention: { manualResolutions, pendingLiquidations, flaggedCustomers, pendingTenureChanges },
      recentLoans: recentLoans.map((loan) => ({
        id: loan.id,
        customerId: loan.borrower.userId,
        customerName: loan.borrower.user.name,
        amount: toNumber(loan.principal),
        category: loan.category,
        status: loan.status,
        disbursedAt: loan.disbursementDate as Date,
      })),
      recentCustomers: recentCustomers.map((customer) => ({
        id: customer.userId,
        name: customer.user.name,
        status: customer.user.status,
        createdAt: customer.createdAt,
      })),
    };
  }

  /** Loans running now, and requests waiting for a decision (loans and top-ups). */
  private async counts(): Promise<{ active: number; pending: number }> {
    const [active, pendingLoans, pendingTopups] = await Promise.all([
      this.prisma.loan.count({ where: { status: 'DISBURSED' } }),
      this.prisma.loan.count({ where: { status: 'PENDING' } }),
      this.prisma.microLoan.count({ where: { purpose: 'TOPUP', status: 'PENDING' } }),
    ]);
    return { active, pending: pendingLoans + pendingTopups };
  }

  /**
   * §0.5 booked components over DISBURSED microloans disbursed in the range. The management fee
   * is rounded per loan, as the ledger does (`managementFee(principalBooked, rate)`).
   */
  private async booked(range: PeriodRange): Promise<Booked> {
    const [row] = await this.prisma.$queryRaw<BookedRow[]>`
      WITH per_loan AS (
        SELECT "loanId",
               COALESCE(SUM("amount") FILTER (WHERE "purpose" IN ('NEW_LOAN', 'TOPUP')), 0) AS "principal",
               COALESCE(SUM("amount") FILTER (WHERE "purpose" = 'INTEREST'), 0) AS "interest",
               COALESCE(SUM("amount") FILTER (WHERE "purpose" = 'PENALTY'), 0) AS "penalty"
        FROM "MicroLoan"
        WHERE "status" = 'DISBURSED' ${instantSql(Prisma.sql`"disbursedAt"`, range)}
        GROUP BY "loanId"
      )
      SELECT COALESCE(SUM(p."principal"), 0) AS "principal",
             COALESCE(SUM(p."interest"), 0) AS "interest",
             COALESCE(SUM(p."penalty"), 0) AS "penalty",
             COALESCE(SUM(ROUND(p."principal" * l."managementFeeRate", 2)), 0) AS "managementFee"
      FROM per_loan p
      JOIN "Loan" l ON l."id" = p."loanId"`;
    return {
      principal: money(row?.principal ?? 0),
      interest: money(row?.interest ?? 0),
      penalty: money(row?.penalty ?? 0),
      managementFee: money(row?.managementFee ?? 0),
    };
  }

  /** Repayment components of payments whose payroll month is in the range. */
  private async collected(range: PeriodRange): Promise<Collected> {
    const bounded = range.from !== undefined || range.to !== undefined;
    const groups = await this.prisma.repaymentBreakdown.groupBy({
      by: ['component'],
      where: bounded ? { repayment: { paymentInflow: { period: periodWhere(range) } } } : undefined,
      _sum: { amount: true },
    });
    const of = (component: string) => money(groups.find((group) => group.component === component)?._sum.amount ?? ZERO);
    return { principal: of('PRINCIPAL'), interest: of('INTEREST'), penalty: of('PENALTY') };
  }

  /** Σ (owed − repaid) over running loans; never filtered by the range. */
  private async outstanding(): Promise<Money> {
    const { _sum } = await this.prisma.loan.aggregate({
      where: { status: 'DISBURSED' },
      _sum: { owed: true, repaid: true },
    });
    return money(money(_sum.owed ?? ZERO).minus(_sum.repaid ?? ZERO));
  }
}

/**
 * `AND column >= … AND column < …` for the Lagos bounds of the range (empty when unbounded).
 * Prisma stores DateTime as UTC `timestamp`, so each bound goes in as an ISO instant converted
 * to UTC wall time, whatever the session time zone.
 */
function instantSql(column: Prisma.Sql, range: PeriodRange): Prisma.Sql {
  const filter = instantRange(range);
  const utc = (instant: Date | string) => Prisma.sql`(${new Date(instant).toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
  const parts: Prisma.Sql[] = [];
  if (filter?.gte) parts.push(Prisma.sql`AND ${column} >= ${utc(filter.gte)}`);
  if (filter?.lt) parts.push(Prisma.sql`AND ${column} < ${utc(filter.lt)}`);
  return parts.length > 0 ? Prisma.join(parts, ' ') : Prisma.empty;
}
