import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterRepaymentsDto } from '../common/dto';
import { Prisma, RepaymentStatus } from '@prisma/client';
import { ConfigService } from 'src/config/config.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { QueueProducer } from 'src/queue/queue.producer';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class RepaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly queue: QueueProducer,
  ) {}

  async overview() {
    const [repaymentsAgg, totalRepaid, loansAgg] = await Promise.all([
      this.prisma.repayment.groupBy({
        by: ['status'],
        _sum: {
          expectedAmount: true,
          repaidAmount: true,
        },
        where: {
          status: {
            in: [
              RepaymentStatus.AWAITING,
              RepaymentStatus.FAILED,
              RepaymentStatus.PARTIAL,
            ],
          },
        },
      }),
      this.config.getValue('TOTAL_REPAID'),
      this.prisma.loan.aggregate({
        _sum: {
          amountRepayable: true,
          amountRepaid: true,
        },
        where: { status: 'DISBURSED' },
      }),
    ]);

    const totalExpected = (loansAgg._sum.amountRepayable || new Decimal(0)).sub(
      loansAgg._sum.amountRepaid || new Decimal(0),
    );

    const totalOverdue = repaymentsAgg.reduce((acc, rp) => {
      const expected = rp._sum.expectedAmount || new Decimal(0);
      const repaid = rp._sum.repaidAmount || new Decimal(0);
      return acc.add(expected.sub(repaid));
    }, new Decimal(0));

    const underpaidCount =
      repaymentsAgg.find((rp) => rp.status === RepaymentStatus.PARTIAL)?._sum
        .expectedAmount || new Decimal(0);

    const failedDeductionsCount =
      repaymentsAgg.find((rp) => rp.status === RepaymentStatus.FAILED)?._sum
        .expectedAmount || new Decimal(0);

    return {
      data: {
        totalExpected: totalExpected.toNumber(),
        totalOverdue: totalOverdue.toNumber(),
        totalRepaid: totalRepaid || 0,
        underpaidCount: underpaidCount.toNumber(),
        failedDeductionsCount: failedDeductionsCount.toNumber(),
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
          loanId: true,
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
        loanId: true,
        expectedAmount: true,
        repaidAmount: true,
        status: true,
        period: true,
        user: { select: { name: true, repaymentRate: true, id: true } },
        failureNote: true,
        resolutionNote: true,
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
        id,
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

  async uploadRepaymentDocument(file: Express.Multer.File, period: string) {
    const { data, error } = await this.supabase.uploadRepaymentsDoc(
      file,
      period,
    );
    if (error) {
      return { data: null, message: error };
    }
    return this.queue.queueRepayments(data!, period);
  }
}
