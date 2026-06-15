import { Injectable } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';
import { LoanCategory, LoanStatus, Prisma } from '@prisma/client';

export type DateRange = { from: Date; to: Date };

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ponytail: all dashboard money figures come from the Loan table, not the Config
  // running-counters (TOTAL_DISBURSED / BALANCE_OUTSTANDING / TOTAL_REPAID). Computing
  // from source is self-consistent and is what Phase 2 period filters will extend
  // (add a disbursementDate range to this WHERE). The counters are now unused here.
  private async loanFinancials(range?: DateRange) {
    const dateFilter = range
      ? Prisma.sql`AND "disbursementDate" >= ${range.from} AND "disbursementDate" <= ${range.to}`
      : Prisma.empty;
    const [row] = await this.prisma.$queryRaw<
      Array<{
        total_loan_amount: string;
        total_principal: string;
        total_mgt_fee: string;
        interest_earned: string;
        total_repaid: string;
      }>
    >(Prisma.sql`
      SELECT
        COALESCE(SUM("repayable"), 0)::text AS total_loan_amount,
        COALESCE(SUM("principal"), 0)::text AS total_principal,
        COALESCE(SUM("principal" * "managementFeeRate"), 0)::text AS total_mgt_fee,
        COALESCE(SUM("repayable" - "principal"), 0)::text AS interest_earned,
        COALESCE(SUM("repaid"), 0)::text AS total_repaid
      FROM "Loan"
      WHERE "disbursementDate" IS NOT NULL ${dateFilter}
    `);

    const totalLoanAmount = Number(row.total_loan_amount);
    const totalMgtFee = Number(row.total_mgt_fee);
    const totalDisbursed = Number(row.total_principal) - totalMgtFee;
    const totalRepaid = Number(row.total_repaid);

    return {
      totalLoanAmount, // turnover: disbursed + mgt fee + interest (= Σ repayable)
      totalDisbursed,
      totalMgtFee,
      interestEarned: Number(row.interest_earned), // full interest booked, collected or not
      totalRepaid,
      outstanding: totalLoanAmount - totalRepaid,
    };
  }

  // Total repaid in a period, keyed on when the repayment was due (periodInDT).
  private async repaidInPeriod(range: DateRange) {
    const r = await this.prisma.repayment.aggregate({
      _sum: { repaidAmount: true },
      where: { periodInDT: { gte: range.from, lte: range.to } },
    });
    return Number(r._sum.repaidAmount ?? 0);
  }

  // Interest actually collected, summed from the per-repayment interestPaid column
  // (backfilled for historical rows). Source of truth for both all-time and per-period —
  // the old INTEREST_RATE_REVENUE counter undercounted seeded/test repayments.
  private async interestReceived(range?: DateRange) {
    const r = await this.prisma.repayment.aggregate({
      _sum: { interestPaid: true },
      where: range ? { periodInDT: { gte: range.from, lte: range.to } } : undefined,
    });
    return Number(r._sum.interestPaid ?? 0);
  }

  async overview(range?: DateRange) {
    const [activeCount, pendingCount, fin, interestReceived] = await Promise.all([
      this.prisma.loan.count({ where: { status: 'DISBURSED' } }),
      this.prisma.loan.count({ where: { status: 'PENDING' } }),
      this.loanFinancials(range),
      this.interestReceived(range),
    ]);

    return {
      activeCount,
      pendingCount,
      totalDisbursed: fin.totalDisbursed,
      totalLoanAmount: fin.totalLoanAmount,
      interestEarned: fin.interestEarned, // booked, side value
      interestReceived,
      // realized gross profit: mgt fee (collected upfront) + interest actually collected
      grossProfit: fin.totalMgtFee + interestReceived,
    };
  }

  async getDisbursementChartData(year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth();

    const result = await this.prisma.$queryRaw<
      Array<{
        month: number; // 1–12
        category: string;
        total: string;
      }>
    >(Prisma.sql`
      SELECT
        EXTRACT(MONTH FROM "disbursementDate") AS month,
        category,
        SUM("principal") AS total
      FROM "Loan"
      WHERE "disbursementDate" IS NOT NULL
        AND EXTRACT(YEAR FROM "disbursementDate") = ${targetYear}
      GROUP BY month, category
      ORDER BY month ASC
    `);

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ] as const;

    type MonthName = (typeof monthNames)[number];
    type DisbursementChartEntry = {
      month: MonthName;
    } & {
      [key in LoanCategory]: number;
    };

    const grouped: Record<MonthName, Record<LoanCategory, number>> = {} as any;
    const validMonths = monthNames.slice(0, currentMonthIndex + 1);

    for (const month of validMonths) {
      grouped[month] = {} as Record<LoanCategory, number>;
    }

    for (const row of result) {
      const month = monthNames[row.month - 1];
      if (!validMonths.includes(month)) continue;
      const amount = parseFloat(row.total);
      if (amount > 0) grouped[month][row.category as LoanCategory] = amount;
    }

    const disbursements: DisbursementChartEntry[] = validMonths.map(
      (month) => ({
        month,
        ...grouped[month],
      }),
    );

    const transformed = disbursements.reduce(
      (acc, row) => {
        const categories: Record<string, number> = {};
        let total = 0;

        for (const key in row) {
          if (key === 'month') continue;
          const amount = row[key as LoanCategory];
          categories[key] = amount;
          total += amount;
        }

        acc[row.month] = { categories, total };
        return acc;
      },
      {} as Record<
        MonthName,
        { categories: Record<LoanCategory, number>; total: number }
      >,
    );

    return transformed;
  }

  async getOpenLoanRequests() {
    const [pendingLoans, openCommodityLoans] = await Promise.all([
      this.prisma.loan.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          borrowerId: true,
          principal: true,
          category: true,
          createdAt: true,
        },
      }),

      this.prisma.commodityLoan.findMany({
        where: { inReview: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          borrowerId: true,
          name: true,
          createdAt: true,
        },
      }),
    ]);

    const loanResults = pendingLoans.map((loan) => ({
      customerId: loan.borrowerId,
      id: loan.id,
      amount: Number(loan.principal),
      category: loan.category,
      requestedAt: new Date(loan.createdAt),
    }));

    const commodityResults = openCommodityLoans.map((cl) => ({
      customerId: cl.borrowerId,
      id: cl.id,
      name: cl.name,
      category: LoanCategory.ASSET_PURCHASE,
      requestedAt: new Date(cl.createdAt),
    }));

    return {
      cashLoans: loanResults,
      commodityLoans: commodityResults,
    };
  }

  async getLoanStatusDistro() {
    const counts = await this.prisma.loan.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const statusCounts: Partial<Record<LoanStatus, number>> = {};
    for (const entry of counts) {
      statusCounts[entry.status] = entry._count.status;
    }

    return statusCounts;
  }

  async loanReportOverview(range?: DateRange) {
    const [fin, snapshot, periodRepaid, interestReceived, activeCount, pendingCount] =
      await Promise.all([
        this.loanFinancials(range),
        // Outstanding is a live "what's still owed" snapshot — always all-time,
        // regardless of the selected period.
        range ? this.loanFinancials() : null,
        range ? this.repaidInPeriod(range) : null,
        this.interestReceived(range),
        this.prisma.loan.count({ where: { status: 'DISBURSED' } }),
        this.prisma.loan.count({ where: { status: 'PENDING' } }),
      ]);

    return {
      totalLoanAmount: fin.totalLoanAmount,
      totalDisbursed: fin.totalDisbursed,
      outstanding: (snapshot ?? fin).outstanding,
      totalRepaid: periodRepaid ?? fin.totalRepaid,
      interestEarned: fin.interestEarned,
      interestReceived,
      activeLoansCount: activeCount,
      pendingLoansCount: pendingCount,
    };
  }
}
