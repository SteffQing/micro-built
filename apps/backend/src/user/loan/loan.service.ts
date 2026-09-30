import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addMonths, differenceInCalendarMonths } from 'date-fns';
import { PrismaService } from 'src/database/prisma.service';
import {
  CreateLoanDto,
  LoanHistoryRequestDto,
  UpdateLoanDto,
} from '../common/dto';
import { generateId } from 'src/common/utils';
import { ConfigService } from 'src/config/config.service';
import { LoanCategory, LoanStatus, LoanType, Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserEvents } from 'src/queue/events/events';
import { RepaymentObligationService } from 'src/obligations/repayment-obligation.service';

const DEC0 = new Prisma.Decimal(0);

@Injectable()
export class LoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly event: EventEmitter2,
    private readonly obligations: RepaymentObligationService,
  ) {}

  async getUserLoansOverview(userId: string) {
    const [activeLoans, pendingCount, { repaymentRate }, lastRepaymentDate] =
      await Promise.all([
        this.prisma.loan.findMany({
          where: { borrowerId: userId, status: 'DISBURSED' },
          select: {
            principal: true,
            repaid: true,
            disbursementDate: true,
            extension: true,
            penalty: true,
            tenure: true,
          },
        }),
        this.prisma.loan.count({
          where: { borrowerId: userId, status: 'PENDING' },
        }),
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { repaymentRate: true },
        }),
        this.config.getValue('LAST_REPAYMENT_DATE'),
      ]);

    const lastDeduction = lastRepaymentDate
      ? {
          amount: 0,
          date: lastRepaymentDate,
        }
      : null;

    const nextRepaymentDate = lastRepaymentDate
      ? addMonths(lastRepaymentDate, 1)
      : null;

    return {
      activeLoans,
      repaymentRate,
      pendingLoanRequestsCount: pendingCount,
      lastDeduction,
      nextRepaymentDate,
    };
  }

  async getPendingLoansAndLoanCount(userId: string) {
    const [pendingLoans, result] = await Promise.all([
      this.prisma.loan.findMany({
        where: {
          borrowerId: userId,
          status: 'PENDING',
        },
        select: { id: true, principal: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.loan.groupBy({
        by: ['status'],
        where: {
          borrowerId: userId,
          status: { in: ['REJECTED', 'APPROVED', 'DISBURSED'] },
        },
        _count: {
          status: true,
        },
      }),
    ]);

    const counts: Record<LoanStatus, number> = {
      REJECTED: 0,
      APPROVED: 0,
      DISBURSED: 0,
      REPAID: 0,
      PENDING: 0,
    };

    for (const row of result) {
      counts[row.status] = row._count.status;
    }

    const loans = pendingLoans.map((loan) => ({
      id: loan.id,
      amount: Number(loan.principal),
      date: new Date(loan.createdAt),
    }));

    return {
      data: {
        pendingLoans: loans,
        rejectedCount: counts.REJECTED,
        approvedCount: counts.APPROVED,
        disbursedCount: counts.DISBURSED,
      },
      message: 'Pending loans and loans data retrieved successfully!',
    };
  }

  async getLoanRequestHistory(userId: string, query: LoanHistoryRequestDto) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LoanWhereInput = { borrowerId: userId };
    if (status) where.status = status;

    const [loans, total] = await Promise.all([
      this.prisma.loan.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          principal: true,
          createdAt: true,
          category: true,
          status: true,
        },
      }),
      this.prisma.loan.count({
        where,
      }),
    ]);

    const loanHistory = loans.map((loan) => {
      const { createdAt, principal, ...rest } = loan;
      const newLoan = {
        ...rest,
        amount: Number(principal),
        date: new Date(createdAt),
      };
      return newLoan;
    });

    return {
      meta: {
        total,
        page,
        limit,
      },
      data: loanHistory,
      message: 'Loan history retrieved successfully',
    };
  }

  async getAllUserLoans(userId: string, limit = 10, page = 1) {
    const skip = (page - 1) * limit;

    const [cashLoans, commodityLoans, totalCash, totalCommodity] =
      await Promise.all([
        this.prisma.loan.findMany({
          where: {
            borrowerId: userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            principal: true,
            createdAt: true,
            category: true,
            status: true,
            borrowerId: true,
          },
        }),

        this.prisma.commodityLoan.findMany({
          where: {
            borrowerId: userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            loanId: true,
            createdAt: true,
            inReview: true,
            name: true,
          },
        }),

        this.prisma.loan.count({
          where: { borrowerId: userId },
        }),

        this.prisma.commodityLoan.count({
          where: { borrowerId: userId },
        }),
      ]);

    const cashHistory = cashLoans.map((loan) => ({
      id: loan.id,
      date: loan.createdAt,
      amount: Number(loan.principal),
      category: loan.category,
      status: loan.status,
    }));

    const commodityHistory = commodityLoans.map((cl) => ({
      id: cl.id,
      date: cl.createdAt,
      category: LoanCategory.ASSET_PURCHASE,
      status: cl.inReview ? LoanStatus.PENDING : LoanStatus.APPROVED,
      name: cl.name,
      loanId: cl.loanId,
    }));

    const allLoans = [...cashHistory, ...commodityHistory].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );

    return {
      meta: {
        total: totalCash + totalCommodity,
        page,
        limit,
      },
      data: allLoans.slice(skip, skip + limit),
      message: 'Loan history retrieved successfully',
    };
  }

  async requestCashLoan(
    userId: string,
    dto: CreateLoanDto,
    requestedBy?: string,
  ) {
    const [user, interestPerAnnum, managementFeeRate, pending, hasActiveLoan] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { status: true, flagReason: true },
        }),
        this.config.getValue('INTEREST_RATE'),
        this.config.getValue('MANAGEMENT_FEE_RATE'),
        this.prisma.loan.count({
          where: { borrowerId: userId, status: 'PENDING' },
        }),
        this.prisma.loan.findFirst({
          where: { borrowerId: userId, status: 'DISBURSED' },
          select: { id: true },
        }),
      ]);

    if (!requestedBy && user.status === 'FLAGGED') {
      throw new BadRequestException(
        'Your account is currently restricted. Please contact support.',
      );
    }
    if (!interestPerAnnum || !managementFeeRate) {
      throw new BadRequestException(
        'Interest rate or management fee rate is not set. Please contact support.',
      );
    }
    if (pending > 0) {
      throw new BadRequestException('You already have a pending loan.');
    }

    const id = generateId.loanId();
    await this.prisma.loan.create({
      data: {
        id,
        category: dto.category,
        borrowerId: userId,
        interestRate: interestPerAnnum,
        managementFeeRate,
        principal: dto.amount,
        ...(requestedBy && { requestedById: requestedBy }),
        ...(hasActiveLoan ? { type: 'Topup' as const } : {}),
      },
    });

    return {
      message: 'Loan application submitted successfully',
      data: { id },
    };
  }

  async updateLoan(userId: string, loanId: string, dto: UpdateLoanDto) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId, borrowerId: userId },
      select: {
        status: true,
      },
    });

    if (!loan) {
      throw new NotFoundException(
        'Loan with the provided ID could not be found. Please check and try again',
      );
    }
    if (loan.status !== 'PENDING') {
      throw new BadRequestException('Only pending loans can be modified.');
    }

    this.event.emit(UserEvents.userLoanUpdate, {
      ...dto,
      loanId,
    });

    return {
      message: 'Loan application updated successfully',
      data: null,
    };
  }

  async deleteLoan(userId: string, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId, borrowerId: userId },
      select: { status: true },
    });

    if (!loan) {
      throw new NotFoundException(
        'Loan with the provided ID could not be found. Please check and try again',
      );
    }

    if (loan.status !== 'PENDING') {
      throw new BadRequestException('Only pending loans can be deleted');
    }

    this.event.emit(UserEvents.userLoanDelete, {
      loanId,
    });

    return { message: 'Loan deleted successfully', data: null };
  }

  async getLoanById(userId: string, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: {
        id: loanId,
        borrowerId: userId,
      },
      select: {
        id: true,
        principal: true,
        penalty: true,
        repaid: true,
        status: true,
        category: true,
        tenure: true,
        extension: true,
        disbursementDate: true,
        createdAt: true,
        updatedAt: true,
        asset: {
          select: { name: true, id: true },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException(
        'Loan with the provided ID could not be found. Please check and try again',
      );
    }

    const { asset, principal, ...rest } = loan;

    return {
      data: {
        ...rest,
        amount: Number(principal),
        assetName: asset?.name,
        assetId: asset?.id,
      },
      message: 'Loan details retrieved successfully',
    };
  }

  async requestAssetLoan(
    userId: string,
    assetName: string,
    requestedBy?: string,
    context?: {
      type?: LoanType;
      targetObligationId?: string;
    },
  ) {
    const [commodities, user, pendingLoan, pendingCommodity] =
      await Promise.all([
      this.config.getValue('COMMODITY_CATEGORIES'),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { status: true, flagReason: true },
      }),
      this.prisma.loan.count({
        where: { borrowerId: userId, status: 'PENDING' },
      }),
      this.prisma.commodityLoan.count({
        where: { borrowerId: userId, inReview: true },
      }),
    ]);
    if (!requestedBy && user.status === 'FLAGGED') {
      throw new BadRequestException(
        'Your account is currently restricted. Please contact support.',
      );
    }
    if (!commodities) {
      throw new BadRequestException('No commodities are in the inventory');
    }
    if (!commodities.includes(assetName)) {
      throw new BadRequestException(
        'Only commodities in stock can be requested.',
      );
    }
    if (pendingLoan > 0 || pendingCommodity > 0) {
      throw new BadRequestException('You already have a pending loan.');
    }

    const commodityLoan = await this.prisma.commodityLoan.create({
      data: {
        name: assetName,
        borrowerId: userId,
        id: generateId.assetLoanId(),
        type: context?.type ?? LoanType.New,
        targetObligationId: context?.targetObligationId,
        ...(requestedBy && { requestedById: requestedBy }),
      },
    });

    return {
      message: `You have successfully requested a commodity loan for ${assetName}! Please keep an eye out for communication lines from our support`,
      data: { id: commodityLoan.id },
    };
  }

  async getAssetLoanById(userId: string, cLoanId: string) {
    const cLoan = await this.prisma.commodityLoan.findUnique({
      where: { id: cLoanId, borrowerId: userId },
      select: {
        id: true,
        name: true,
        inReview: true,
        publicDetails: true,
        createdAt: true,
      },
    });

    if (!cLoan) {
      throw new NotFoundException(
        'Commodity loan with the provided ID could not be found. Please check and try again',
      );
    }

    const { publicDetails, createdAt, ...rest } = cLoan;

    return {
      data: { ...rest, details: publicDetails, date: new Date(createdAt) },
      message: 'Commodity loan has been queried successfully',
    };
  }

  async getCommodityLoanRequestHistory(userId: string, limit = 10, page = 1) {
    const skip = (page - 1) * limit;

    const [loans, total] = await Promise.all([
      this.prisma.commodityLoan.findMany({
        where: {
          borrowerId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          name: true,
        },
      }),
      this.prisma.commodityLoan.count({
        where: { borrowerId: userId },
      }),
    ]);

    const loanHistory = loans.map((loan) => {
      const { createdAt, ...rest } = loan;
      const newLoan = {
        ...rest,
        date: new Date(createdAt),
      };
      return newLoan;
    });

    return {
      meta: {
        total,
        page,
        limit,
      },
      data: loanHistory,
      message: 'Commodity Loan history retrieved successfully',
    };
  }

  async getUserActiveLoan(userId: string) {
    const obligation = await this.obligations.getByBorrower(userId);
    if (obligation?.currentPlan) {
      const futureInstallments = obligation.currentPlan.installments.filter(
        (item) =>
          !['PAID', 'MISSED', 'WAIVED', 'SUPERSEDED', 'REVERSED'].includes(
            item.status,
          ),
      );
      const endDate =
        futureInstallments[futureInstallments.length - 1]?.dueDate ?? null;

      return {
        data: {
          id: obligation.id,
          obligationId: obligation.id,
          version: obligation.version,
          totalBalance: obligation.contractualOutstanding,
          totalPenaltyOwed: obligation.penaltyOutstanding,
          totalOutstanding:
            obligation.contractualOutstanding + obligation.penaltyOutstanding,
          tenureLeft: futureInstallments.length,
          monthlyRepayment: obligation.currentPlan.scheduledMonthly,
          planStartDate: obligation.currentPlan.effectiveFromPeriod,
          planEndDate: endDate,
          planId: obligation.currentPlan.id,
          planVersion: obligation.currentPlan.version,
        },
        message: 'Active consolidated repayment obligation found',
      };
    }

    const activeLoans = await this.prisma.loan.findMany({
      where: {
        borrowerId: userId,
        status: 'DISBURSED',
        repayable: { gt: this.prisma.loan.fields.repaid },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        principal: true,
        penalty: true,
        repaid: true,
        penaltyRepaid: true,
        repayable: true,
        tenure: true,
        extension: true,
        disbursementDate: true,
      },
    });

    if (activeLoans.length === 0) {
      return { data: null, message: 'No active loans found' };
    }

    const now = new Date();
    const aggregatedLoan = activeLoans.reduce(
      (acc, curr) => {
        const totalTenure = curr.tenure + curr.extension;
        const monthsElapsed = differenceInCalendarMonths(
          now,
          new Date(curr.disbursementDate!),
        );
        const remainingTenure = Math.max(0, totalTenure - monthsElapsed);

        const remainingPrincipal = curr.repayable.minus(curr.repaid);
        const remainingPenalty = curr.penalty.minus(curr.penaltyRepaid);

        return {
          ...acc,
          id: acc.id || curr.id,
          totalBalance: acc.totalBalance.add(remainingPrincipal),
          totalPenaltyOwed: acc.totalPenaltyOwed.add(remainingPenalty),
          tenureLeft: acc.tenureLeft + remainingTenure,
        };
      },
      {
        id: '',
        totalBalance: DEC0,
        totalPenaltyOwed: DEC0,
        tenureLeft: 0,
      },
    );

    return {
      data: aggregatedLoan,
      message: 'Aggregated active loan data retrieved successfully',
    };
  }
}
