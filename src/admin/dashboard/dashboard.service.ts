import { Injectable } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoanCategory, LoanStatus, Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async overview() {
    const [activeCount, pendingCount, tDisbursed, iRevenue, mgtRevenue] =
      await Promise.all([
        this.prisma.loan.count({ where: { status: 'DISBURSED' } }),
        this.prisma.loan.count({ where: { status: 'PENDING' } }),
        this.config.getValue('TOTAL_DISBURSED'),
        this.config.getValue('INTEREST_RATE_REVENUE'),
        this.config.getValue('MANAGEMENT_FEE_REVENUE'),
      ]);

    return {
      activeCount,
      pendingCount,
      totalDisbursed: tDisbursed || 0,
      grossProfit: (iRevenue || 0) + (mgtRevenue || 0),
    };
  }

  async getDisbursementChartData(year?: number) {
    const targetYear = year ?? new Date().getFullYear();

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
        SUM(amount) AS total
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

    for (const row of result) {
      const month = monthNames[row.month - 1];
      if (!grouped[month]) {
        grouped[month] = {} as Record<LoanCategory, number>;
        for (const cat of Object.values(LoanCategory)) {
          grouped[month][cat] = 0;
        }
      }
      grouped[month][row.category as LoanCategory] = parseFloat(row.total);
    }

    const disbursements: DisbursementChartEntry[] = monthNames
      .filter((m) => grouped[m])
      .map((month) => ({
        month,
        ...grouped[month],
      }));

    return disbursements;
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
          amount: true,
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
          userId: true,
          name: true,
          createdAt: true,
        },
      }),
    ]);

    const loanResults = pendingLoans.map((loan) => ({
      customerId: loan.borrowerId,
      id: loan.id,
      amount: Number(loan.amount),
      category: loan.category,
      requestedAt: new Date(loan.createdAt),
    }));

    const commodityResults = openCommodityLoans.map((cl) => ({
      customerId: cl.userId,
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
