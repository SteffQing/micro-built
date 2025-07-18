import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterRepaymentsDto } from '../common/dto';
import { Prisma, RepaymentStatus } from '@prisma/client';
import { ConfigService } from 'src/config/config.service';

@Injectable()
export class RepaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async overview() {
    const [repayments, totalRepaid, underpaymentsCount, failedDeductionsCount] =
      await Promise.all([
        this.prisma.repayment.findMany({
          where: {
            status: {
              in: [
                RepaymentStatus.AWAITING,
                RepaymentStatus.FAILED,
                RepaymentStatus.PARTIAL,
              ],
            },
          },
          select: { expectedAmount: true, repaidAmount: true },
        }),
        this.config.getValue('TOTAL_REPAID'),
        this.prisma.repayment.count({
          where: { status: RepaymentStatus.PARTIAL },
        }),
        this.prisma.repayment.count({
          where: { status: RepaymentStatus.FAILED },
        }),
      ]);

    const totalExpected = repayments.reduce(
      (acc, rp) => acc + Number(rp.expectedAmount.sub(rp.repaidAmount)),
      0,
    );

    return {
      data: {
        totalExpected,
        totalRepaid,
        underpaymentsCount,
        failedDeductionsCount,
      },
      message: 'Platform-wide repayment overview fetched successfully',
    };
  }

  async getAllRepayments(dto: FilterRepaymentsDto) {
    const { status, page = 1, limit = 20 } = dto;
    const where: Prisma.RepaymentWhereInput = {};
    if (status) where.status = status;

    const [repayments, total] = await Promise.all([
      this.prisma.repayment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          period: true,
          status: true,
          expectedAmount: true,
          repaidAmount: true,
        },
      }),
      this.prisma.repayment.count({ where }),
    ]);

    return {
      data: repayments.map((r) => ({
        ...r,
        expectedAmount: Number(r.expectedAmount),
        repaidAmount: Number(r.repaidAmount),
      })),
      message: 'Repayments fetched successfully',
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async getRepaymentById(id: string) {
    const repayment = await this.prisma.repayment.findUnique({
      where: { id },
      select: {
        id: true,
        loanId: true,
        amount: true,
        expectedAmount: true,
        repaidAmount: true,
        status: true,
        period: true,
        user: { select: { name: true } },
        userId: true,
      },
    });

    if (!repayment)
      return {
        data: null,
        message: 'No repayments found for this ID',
      };

    return {
      data: {
        ...repayment,
        expectedAmount: Number(repayment.expectedAmount),
        repaidAmount: Number(repayment.repaidAmount),
        name: repayment.user?.name,
      },
      message: 'Repayment retrieved successfully',
    };
  }

  async manuallyResolveRepayment(id: string) {
    const repayment = await this.prisma.repayment.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!repayment) {
      throw new NotFoundException(
        'Repayment with the provided ID does not exist',
      );
    }

    await this.prisma.repayment.update({
      where: { id },
      data: { status: RepaymentStatus.MANUAL_RESOLUTION },
    });

    return {
      data: null,
      message: 'Repayment status has been manually resolved!',
    };
  }
}
