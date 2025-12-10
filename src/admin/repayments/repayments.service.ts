import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  CreateLiquidationRequestDto,
  FilterLiquidationRequestsDto,
  FilterRepaymentsDto,
  ManualRepaymentResolutionDto,
} from '../common/dto';
import { Prisma, RepaymentStatus } from '@prisma/client';
import { ConfigService } from 'src/config/config.service';
import { SupabaseService } from 'src/database/supabase.service';
import { QueueProducer } from 'src/queue/bull/queue.producer';
import { Decimal } from '@prisma/client/runtime/library';
import {
  enumToHumanReadable,
  generateId,
  parsePeriodToDate,
} from 'src/common/utils';
import { GenerateMonthlyLoanScheduleDto } from '../common/dto/superadmin.dto';
import { MailService } from 'src/notifications/mail.service';
import { endOfMonth, startOfMonth } from 'date-fns';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdminEvents } from 'src/queue/events/events';

@Injectable()
export class RepaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly queue: QueueProducer,
    private readonly mail: MailService,
    private readonly event: EventEmitter2,
  ) {}

  async overview() {
    const [repaymentsAgg, totalRepaid] = await Promise.all([
      this.prisma.repayment.groupBy({
        by: ['status'],
        _sum: {
          expectedAmount: true,
          repaidAmount: true,
        },
        where: {
          status: {
            in: [RepaymentStatus.FAILED, RepaymentStatus.PARTIAL],
          },
        },
      }),
      this.config.getValue('TOTAL_REPAID'),
    ]);

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
        // totalExpected: totalExpected.toNumber(),
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
          period: true,
          status: true,
          expectedAmount: true,
          repaidAmount: true,
          loanId: true,
          user: {
            select: {
              name: true,
              repaymentRate: true,
              id: true,
              externalId: true,
            },
          },
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
        penaltyCharge: true,
      },
    });
    if (!repayment || repayment.status !== 'MANUAL_RESOLUTION') {
      throw new NotFoundException(
        'Repayment with the provided ID does not exist or is not in manual resolution mode!',
      );
    }

    const totalAmount = repayment.amount;
    const { resolutionNote, ...repaymentDto } = dto;
    const note = `${resolutionNote}\n\nBy Admin ~ ${adminId}`;

    // For Repayments where the payer's Payroll ID wasn't found
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
        amount: totalAmount.toNumber(),
        period: repayment.period,
        resolutionNote: note,
      });
      return {
        data: null,
        message:
          'Repayment status is being manually resolved! You can check after a while',
      };
    }

    // For Repayments that overflowed
    if (!repaymentDto.loanId) {
      throw new NotFoundException(
        'No loan id is provided in the request nor is one existing in the repayment model',
      );
    }
    const loan = await this.prisma.loan.findUnique({
      where: { id: repaymentDto.loanId },
      select: {
        status: true,
      },
    });
    if (!loan || loan.status !== 'DISBURSED') {
      throw new NotFoundException(
        'Loan with the provided loanId does not exist or is not in a disbursed state',
      );
    }

    this.event.emit(AdminEvents.adminResolveRepayment, {
      id,
      note,
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

  async rejectLiqudationRequest(id: string) {
    const lr = await this.prisma.liquidationRequest.findUnique({
      where: { id },
      select: { status: true, customerId: true },
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
      data: { userId: lr.customerId },
      message: 'The liquidation has been marked as rejected.',
    };
  }

  async acceptLiquidationRequest(id: string) {
    const lr = await this.prisma.liquidationRequest.findUnique({
      where: { id },
      select: {
        status: true,
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

    await this.prisma.liquidationRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });

    await this.queue.liquidationRequest({
      liquidationRequestId: id,
      userId: lr.customerId,
      amount: lr.totalAmount.toNumber(),
    });

    return {
      data: { userId: lr.customerId },
      message:
        'Liquidation request has been accepted and queued for processing! State could be rejected later',
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

    const id = generateId.liquidationRequestId();
    await this.prisma.liquidationRequest.create({
      data: {
        id,
        customerId: userId,
        totalAmount: dto.amount,
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

    const [lr, total] = await Promise.all([
      this.prisma.liquidationRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          approvedAt: true,
        },
      }),
      this.prisma.liquidationRequest.count({ where }),
    ]);

    const liquidationRequests = lr.map(({ totalAmount, ...req }) => ({
      amount: totalAmount.toNumber(),
      ...req,
    }));

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

  async getVariationSchedule(dto: GenerateMonthlyLoanScheduleDto) {
    const { period, email } = dto;

    const [monthName, yearStr] = period.split(' ');
    const year = parseInt(yearStr, 10);
    const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();

    const today = new Date();
    const cutoffDate = new Date(year, monthIndex, 28);

    if (today < cutoffDate) {
      throw new BadRequestException(
        `You can only generate the ${monthName} ${year} schedule after the 28th of ${enumToHumanReadable(monthName)}.`,
      );
    }

    const date = parsePeriodToDate(period);
    const loanInRange = await this.prisma.loan.findFirst({
      where: {
        disbursementDate: {
          gte: startOfMonth(date),
          lte: endOfMonth(date),
        },
      },
      select: { id: true },
    });

    if (!loanInRange) {
      throw new BadRequestException(
        `Report cannot be generated as no loans were disbursed in the ${enumToHumanReadable(monthName)} ${year} period`,
      );
    }

    const schedule = await this.supabase.getVariationSchedule(period);
    if (!schedule) {
      await this.queue.generateReport(dto);
      return {
        data: null,
        message:
          'Variation schedule is being generated! Please check your email for the report after a while',
      };
    }

    await this.mail.sendLoanScheduleReport(email, { period }, schedule);
    return {
      data: null,
      message: 'Variation schedule has been sent to your email successfully',
    };
  }
}
