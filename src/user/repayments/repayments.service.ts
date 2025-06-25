import { Injectable, NotFoundException } from '@nestjs/common';
import { addMonths } from 'date-fns';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RepaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getYearlyRepaymentSummary(userId: string, _year?: number) {
    const year = _year ?? new Date().getFullYear();
    const results = await this.prisma.$queryRaw<
      { month: number; totalRepaid: number }[]
    >`
      SELECT 
        EXTRACT(MONTH FROM "periodInDT") AS month,
        SUM("repaid") AS "totalRepaid"
      FROM "Repayment"
      WHERE "userId" = ${userId} AND EXTRACT(YEAR FROM "periodInDT") = ${year}
      GROUP BY month
      ORDER BY month ASC
    `;

    const formatted = results.map((entry) => ({
      month: new Date(year, entry.month - 1).toLocaleString('default', {
        month: 'long',
      }),
      repaid: Number(entry.totalRepaid),
    }));

    return {
      data: formatted,
      message: `Monthly repayment summary for ${year} retrieved successfully`,
    };
  }

  async getRepaymentOverview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { externalId: true, status: true },
    });

    if (!user?.externalId) {
      throw new NotFoundException('User external ID not found');
    }

    const [repayments, activeLoans] = await Promise.all([
      this.prisma.repayment.findMany({
        where: { userId: user.externalId },
        orderBy: { periodInDT: 'desc' },
        select: { repaid: true, periodInDT: true },
      }),
      this.prisma.loan.findMany({
        where: {
          borrowerId: userId,
          status: 'DISBURSED',
        },
        select: {
          repayable: true,
        },
      }),
    ]);

    const repaymentsCount = repayments.length;
    const totalRepaid = repayments.reduce(
      (sum, r) => sum + Number(r.repaid),
      0,
    );
    const totalRepayable = activeLoans.reduce(
      (sum, l) => sum + Number(l.repayable),
      0,
    );

    const overdueAmount = Math.max(totalRepayable - totalRepaid, 0);

    const lastRepaymentDate = repayments[0]
      ? {
          amount: repayments[0].repaid,
          date: repayments[0].periodInDT,
        }
      : null;
    const nextRepaymentDate = lastRepaymentDate
      ? addMonths(lastRepaymentDate.date, 1)
      : null;

    return {
      data: {
        repaymentsCount,
        flaggedAccount: user.status === 'FLAGGED',
        lastRepaymentDate,
        nextRepaymentDate,
        overdueAmount,
      },
      message: 'Repayment overview retrieved successfully',
    };
  }

  async getRepaymentHistory(userId: string, limit = 10, page = 1) {
    const skip = (page - 1) * limit;

    const [repayments, total] = await Promise.all([
      this.prisma.repayment.findMany({
        where: { userId },
        orderBy: { periodInDT: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          repaid: true,
          period: true,
          periodInDT: true,
          loanId: true,
          createdAt: true,
        },
      }),
      this.prisma.repayment.count({ where: { userId } }),
    ]);

    const payments = repayments.map((r) => {
      const { createdAt, repaid, periodInDT, ...rest } = r;
      return { ...rest, repaid: Number(repaid), date: periodInDT };
    });

    return {
      meta: { total, page, limit },
      data: payments,
      message: 'Repayment history fetched successfully',
    };
  }
}
