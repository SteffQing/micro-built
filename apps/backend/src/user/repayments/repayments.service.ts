import { Injectable } from '@nestjs/common';
import { Prisma, RepaymentStatus } from '@prisma/client';
import { addMonths } from 'date-fns';
import { PrismaService } from 'src/database/prisma.service';

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
    const [repaymentAgg, flaggedCount, lastRepayment, activeLoans] =
      await Promise.all([
        this.prisma.repayment.aggregate({
          where: { userId },
          _sum: { repaidAmount: true },
          _count: { _all: true },
        }),

        this.prisma.repayment.count({
          where: {
            userId,
            status: { in: ['FAILED', 'PARTIAL'] },
          },
        }),

        this.prisma.repayment.findFirst({
          where: { userId },
          orderBy: { periodInDT: 'desc' },
          select: { repaidAmount: true, periodInDT: true },
        }),

        this.prisma.loan.findMany({
          where: { borrowerId: userId, status: 'DISBURSED' },
          select: {
            penalty: true,
            principal: true,
            repaid: true,
            disbursementDate: true,
            tenure: true,
            extension: true,
          },
        }),
      ]);

    const lastRepaymentInfo = lastRepayment
      ? {
          amount: lastRepayment.repaidAmount.toNumber(),
          date: lastRepayment.periodInDT,
        }
      : null;
    const nextRepaymentDate = lastRepaymentInfo
      ? addMonths(lastRepaymentInfo.date, 1)
      : null;

    return {
      data: {
        repaymentsCount: repaymentAgg._count._all,
        flaggedRepaymentsCount: flaggedCount,
        lastRepayment: lastRepaymentInfo,
        nextRepaymentDate,
        activeLoans,
      },
      message: 'Repayment overview retrieved successfully',
    };
  }

  async getRepaymentHistory(
    userId: string,
    limit = 10,
    page = 1,
    status?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.RepaymentWhereInput = {
      userId,
      ...(status &&
      Object.values(RepaymentStatus).includes(status as RepaymentStatus)
        ? { status: status as RepaymentStatus }
        : {}),
    };

    const [repayments, total] = await Promise.all([
      this.prisma.repayment.findMany({
        where,
        orderBy: { periodInDT: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          repaidAmount: true,
          expectedAmount: true,
          status: true,
          period: true,
          periodInDT: true,
          loanId: true,
          createdAt: true,
        },
      }),
      this.prisma.repayment.count({ where }),
    ]);

    const payments = repayments.map((r) => {
      const { createdAt, repaidAmount, expectedAmount, periodInDT, ...rest } =
        r;
      return {
        ...rest,
        repaid: Number(repaidAmount),
        expected: Number(expectedAmount),
        date: periodInDT,
      };
    });

    return {
      meta: { total, page, limit },
      data: payments,
      message: 'Repayment history fetched successfully',
    };
  }

  async getSingleRepayment(userId: string, id: string) {
    const repayment = await this.prisma.repayment.findUnique({
      where: { id, userId },
      select: {
        period: true,
        expectedAmount: true,
        repaidAmount: true,
        penaltyCharge: true,
        status: true,
        loanId: true,
      },
    });

    if (!repayment) {
      return {
        data: null,
        message: 'No repayment found for this ID',
      };
    }

    return {
      data: {
        ...repayment,
        expectedAmount: Number(repayment.expectedAmount),
        repaidAmount: Number(repayment.repaidAmount),
        penaltyCharge: Number(repayment.penaltyCharge),
        id,
      },
      message: 'Repayment retrieved successfully',
    };
  }
}
