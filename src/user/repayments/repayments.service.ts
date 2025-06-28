import { Injectable, NotFoundException } from '@nestjs/common';
import { addMonths } from 'date-fns';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RepaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private calculateRepayable(
    amount: number,
    tenure: number,
    rate: number,
  ): number {
    const tenureYears = tenure / 12;
    const interest = (amount * rate * tenureYears) / 100;
    return amount + interest;
  }

  async getYearlyRepaymentSummary(userId: string, _year?: number) {
    const year = _year ?? new Date().getFullYear();
    const results = await this.prisma.$queryRaw<
      { month: number; totalRepaid: number }[]
    >`
      SELECT 
        EXTRACT(MONTH FROM "periodInDT") AS month,
        SUM("repaidAmount") AS "totalRepaid"
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
        select: { repaidAmount: true, periodInDT: true, staus: true },
      }),
      this.prisma.loan.findMany({
        where: {
          borrowerId: userId,
          status: 'DISBURSED',
        },
        select: {
          amount: true,
          interestRate: true,
          loanTenure: true,
          extension: true,
        },
      }),
    ]);

    const repaymentsCount = repayments.length;
    const totalRepaid = repayments.reduce(
      (sum, r) => sum + Number(r.repaidAmount),
      0,
    );

    const totalRepayable = activeLoans.reduce(
      (sum, l) =>
        sum +
        this.calculateRepayable(
          Number(l.amount),
          l.loanTenure + l.extension,
          Number(l.interestRate),
        ),
      0,
    );

    const flaggedRepayments = repayments.filter(
      (repayment) =>
        repayment.staus === 'FAILED' || repayment.staus === 'PARTIAL',
    );

    const overdueAmount = Math.max(totalRepayable - totalRepaid, 0);

    const lastRepaymentDate = repayments[0]
      ? {
          amount: repayments[0].repaidAmount,
          date: repayments[0].periodInDT,
        }
      : null;
    const nextRepaymentDate = lastRepaymentDate
      ? addMonths(lastRepaymentDate.date, 1)
      : null;

    return {
      data: {
        repaymentsCount,
        flaggedRepaymentsCount: flaggedRepayments.length,
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
          repaidAmount: true,
          period: true,
          periodInDT: true,
          loanId: true,
          createdAt: true,
        },
      }),
      this.prisma.repayment.count({ where: { userId } }),
    ]);

    const payments = repayments.map((r) => {
      const { createdAt, repaidAmount, periodInDT, ...rest } = r;
      return { ...rest, repaid: Number(repaidAmount), date: periodInDT };
    });

    return {
      meta: { total, page, limit },
      data: payments,
      message: 'Repayment history fetched successfully',
    };
  }
}
