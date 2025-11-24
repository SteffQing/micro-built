import { Injectable } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';
import { LoanCategory, LoanStatus, Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async overview() {
    const [activeCount, pendingCount, tDisbursed, profit] = await Promise.all([
      this.prisma.loan.count({ where: { status: 'DISBURSED' } }),
      this.prisma.loan.count({ where: { status: 'PENDING' } }),
      this.config.getValue('TOTAL_DISBURSED'),
      this.config.getRevenue(),
    ]);

    return {
      activeCount,
      pendingCount,
      totalDisbursed: tDisbursed || 0,
      grossProfit: profit,
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
        SUM("amountBorrowed") AS total
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

  async loanReportOverview() {
    const [tDisbursed, iRevenue, tRepaid, activeCount, pendingCount] =
      await Promise.all([
        this.config.getValue('TOTAL_DISBURSED'),
        this.config.getValue('INTEREST_RATE_REVENUE'),
        this.config.getValue('TOTAL_REPAID'),
        this.prisma.loan.count({ where: { status: 'DISBURSED' } }),
        this.prisma.loan.count({ where: { status: 'PENDING' } }),
      ]);

    return {
      totalDisbursed: tDisbursed || 0,
      interestEarned: iRevenue || 0,
      totalRepaid: tRepaid || 0,
      activeLoansCount: activeCount,
      pendingLoansCount: pendingCount,
    };
  }
}
