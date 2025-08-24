import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateLiquidationRequestDto,
  FilterLiquidationRequestsDto,
  FilterRepaymentsDto,
  ManualRepaymentResolutionDto,
} from '../common/dto';
import { Prisma, RepaymentStatus } from '@prisma/client';
import { ConfigService } from 'src/config/config.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { QueueProducer } from 'src/queue/queue.producer';
import { Decimal } from '@prisma/client/runtime/library';
import { differenceInMonths } from 'date-fns';
import { generateId } from 'src/common/utils';

function parsePeriodToDate(period: string) {
  const [monthStr, yearStr] = period.trim().split(' ');
  const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
  const year = parseInt(yearStr, 10);

  return new Date(year, monthIndex);
}

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

  async manuallyResolveRepayment(
    id: string,
    dto: ManualRepaymentResolutionDto,
    adminId: string,
  ) {
    const repayment = await this.prisma.repayment.findUnique({
      where: { id },
      select: {
        id: true,
        loanId: true,
        userId: true,
        amount: true,
        period: true,
        status: true,
      },
    });
    if (!repayment || repayment.status !== 'MANUAL_RESOLUTION') {
      throw new NotFoundException(
        'Repayment with the provided ID does not exist or is not in manual resolution mode!',
      );
    }

    const totalAmount = repayment.amount;
    const { attractPenalty, resolutionNote, ...repaymentDto } = dto;
    const note = `${resolutionNote}\n\nBy Admin ~ ${adminId}`;

    if (repayment.userId === null) {
      const userId = repaymentDto.userId;
      if (!userId) {
        throw new NotFoundException(
          'No user id is provided in the request for a missing user resolution',
        );
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) {
        throw new NotFoundException(
          'User with the provided userId does not exist',
        );
      }
      await this.queue.overflowRepayment({
        repaymentId: id,
        userId,
        amount: totalAmount,
        period: repayment.period,
        allowPenalty: attractPenalty,
        resolutionNote: note,
      });
      return;
    }

    if (!repaymentDto.loanId) {
      throw new NotFoundException(
        'No loan id is provided in the request nor is one existing in the repayment model',
      );
    }
    const loan = await this.prisma.loan.findUnique({
      where: { id: repaymentDto.loanId },
      select: {
        amountRepayable: true,
        amountRepaid: true,
        status: true,
      },
    });
    if (!loan || loan.status !== 'DISBURSED') {
      throw new NotFoundException(
        'Loan with the provided loanId does not exist or is not in a disbursed state',
      );
    }

    const amountOwed = loan.amountRepayable.sub(loan.amountRepaid);
    const repaymentToApply = Prisma.Decimal.min(repayment.amount, amountOwed);

    const updateRepayment = () =>
      this.prisma.repayment.update({
        where: { id },
        data: {
          failureNote: null,
          loanId: repaymentDto.loanId,
          status: 'FULFILLED',
          repaidAmount: repaymentToApply,
          expectedAmount: repaymentToApply,
          resolutionNote: note,
        },
      });

    if (repayment.amount.lte(amountOwed)) {
      await updateRepayment();
    } else {
      await updateRepayment();
      const balance = repayment.amount.sub(amountOwed);
      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          period: repayment.period,
          periodInDT: parsePeriodToDate(repayment.period),
          status: 'MANUAL_RESOLUTION',
          failureNote: 'An overflow of repayment balance for the given user',
          userId: repayment.userId,
          amount: balance,
        },
      });
    }

    const amountRepaid = loan.amountRepaid.add(repaymentToApply);
    const updatedLoan = await this.prisma.loan.update({
      where: { id: repaymentDto.loanId },
      data: {
        amountRepaid,
        ...(amountRepaid.gte(loan.amountRepayable) && { status: 'REPAID' }),
      },
      select: {
        amount: true,
        status: true,
      },
    });

    await this.config.topupValue('TOTAL_REPAID', repaymentToApply.toNumber());
    if (updatedLoan.status === 'REPAID') {
      const interestRateRevenue = loan.amountRepayable.sub(updatedLoan.amount);
      await this.config.topupValue(
        'INTEREST_RATE_REVENUE',
        interestRateRevenue.toNumber(),
      );
    }

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

  async rejectLiqudationRequest(id: string) {
    const lr = await this.prisma.liquidationRequest.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!lr) {
      throw new BadRequestException('Liquidation request not found');
    }
    if (lr.status !== 'PENDING') {
      throw new BadRequestException(
        'Liquidation Request has been ' + lr.status.toLowerCase(),
      );
    }

    await this.prisma.liquidationRequest.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
    return {
      data: null,
      message: 'The liquidation has been marked as rejected.',
    };
  }

  async acceptLiquidationRequest(id: string) {
    const lr = await this.prisma.liquidationRequest.findUnique({
      where: { id },
      select: {
        status: true,
        penalize: true,
        totalAmount: true,
        customerId: true,
      },
    });
    if (!lr) {
      throw new BadRequestException('Liquidation request not found');
    }
    if (lr.status !== 'PENDING') {
      throw new BadRequestException(
        'Liquidation Request has been ' + lr.status.toLowerCase(),
      );
    }

    await this.queue.liquidationRequest({
      liquidationRequestId: id,
      allowPenalty: lr.penalize,
      userId: lr.customerId,
      amount: lr.totalAmount,
    });

    return {
      data: null,
      message:
        'Liquidation request has been accepted and queued for processing',
    };
  }

  async liquidationRequest(
    userId: string,
    adminId: string,
    dto: CreateLiquidationRequestDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (!user) throw new NotFoundException(`No user found with id: ${userId}`);

    const id = generateId.anyId('LR');
    await this.prisma.liquidationRequest.create({
      data: {
        id,
        customerId: userId,
        totalAmount: dto.amount,
        penalize: dto.penalty,
        adminId,
      },
    });

    return {
      data: null,
      message: `Liquidation request for ${user.name} is submitted successfully`,
    };
  }

  async getCustomerLiquidationRequests(
    userId: string,
    dto: FilterLiquidationRequestsDto,
  ) {
    const { status, page = 1, limit = 20 } = dto;
    const where: Prisma.LiquidationRequestWhereInput = { customerId: userId };
    if (status) where.status = status;

    const [liquidationRequests, total] = await Promise.all([
      this.prisma.liquidationRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          penalize: true,
          approvedAt: true,
        },
      }),
      this.prisma.liquidationRequest.count({ where }),
    ]);

    return {
      data: liquidationRequests,
      message: 'Liquidation Requests fetched successfully',
      meta: {
        total,
        page,
        limit,
      },
    };
  }
}
