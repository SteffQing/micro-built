import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addMonths } from 'date-fns';
import { PrismaService } from 'src/database/prisma.service';
import {
  CreateLoanDto,
  LoanHistoryRequestDto,
  UpdateLoanDto,
} from '../common/dto';
import { generateId } from 'src/common/utils';
import { ConfigService } from 'src/config/config.service';
import { LoanCategory, LoanStatus, Prisma } from '@prisma/client';

@Injectable()
export class LoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getUserLoansOverview(userId: string) {
    const [activeLoan, pendingCount, { repaymentRate }, lastRepaymentDate] =
      await Promise.all([
        this.prisma.activeLoan.findUnique({
          where: { userId },
          select: {
            amountRepayable: true,
            amountRepaid: true,
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

    const activeLoanAmount = activeLoan
      ? activeLoan.amountRepayable.toNumber()
      : 0;
    const activeLoanRepaid = activeLoan
      ? activeLoan.amountRepaid.toNumber()
      : 0;

    const lastDeduction = lastRepaymentDate
      ? {
          amount: 0,
          date: lastRepaymentDate,
        }
      : null;

    const nextRepaymentDate =
      activeLoan && lastRepaymentDate ? addMonths(lastRepaymentDate, 1) : null;

    return {
      activeLoanAmount,
      activeLoanRepaid,
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
        select: { id: true, amountBorrowed: true, createdAt: true },
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
      amount: Number(loan.amountBorrowed),
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
          amountBorrowed: true,
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
      const { createdAt, amountBorrowed, ...rest } = loan;
      const newLoan = {
        ...rest,
        amount: Number(amountBorrowed),
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
          skip,
          take: limit,
          select: {
            id: true,
            amountBorrowed: true,
            createdAt: true,
            category: true,
            status: true,
            borrowerId: true,
          },
        }),

        this.prisma.commodityLoan.findMany({
          where: {
            userId,
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
          skip,
          take: limit,
        }),

        this.prisma.loan.count({
          where: { borrowerId: userId },
        }),

        this.prisma.commodityLoan.count({
          where: { userId },
        }),
      ]);

    const cashHistory = cashLoans.map((loan) => ({
      id: loan.id,
      date: loan.createdAt,
      amount: Number(loan.amountBorrowed),
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

    const paginated = allLoans.slice(skip, skip + limit);

    return {
      meta: {
        total: totalCash + totalCommodity,
        page,
        limit,
      },
      data: paginated,
      message: 'Loan history retrieved successfully',
    };
  }

  async applyForLoan(userId: string, dto: CreateLoanDto) {
    const [user, interestPerAnnum, managementFeeRate] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          payroll: { select: { userId: true } },
          paymentMethod: { select: { userId: true } },
          identity: { select: { userId: true } },
        },
      }),
      this.config.getValue('INTEREST_RATE'),
      this.config.getValue('MANAGEMENT_FEE_RATE'),
    ]);

    const userIdentity = user?.identity;
    const userPaymentMethod = user?.paymentMethod;
    const userPayroll = user?.payroll;

    if (!userIdentity) {
      throw new BadRequestException(
        'You must complete identity verification before requesting a loan.',
      );
    }
    if (!userPaymentMethod) {
      throw new NotFoundException(
        'You need to have added a payment method in order to apply for a loan.',
      );
    }
    if (!userPayroll) {
      throw new NotFoundException(
        'You need to have added your payroll data in order to apply for a loan.',
      );
    } // -> Need this for repayments
    if (!interestPerAnnum || !managementFeeRate) {
      throw new BadRequestException(
        'Interest rate or management fee rate is not set. Please contact support.',
      );
    }

    const id = generateId.loanId();
    await this.prisma.loan.create({
      data: {
        category: dto.category,
        borrowerId: userId,
        id,
        interestRate: interestPerAnnum,
        managementFeeRate: managementFeeRate,
        amountBorrowed: dto.amount,
      },
      select: {
        id: true,
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
        amountBorrowed: true,
        tenure: true,
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

    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        ...(dto.amount && { amountBorrowed: dto.amount }),
        ...(dto.category && { category: dto.category }),
      },
      select: {
        id: true,
      },
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

    await this.prisma.loan.delete({ where: { id: loanId } });

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
        amountBorrowed: true,
        amountRepayable: true,
        amountRepaid: true,
        status: true,
        category: true,
        tenure: true,
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

    const { asset, amountBorrowed, ...rest } = loan;

    return {
      data: {
        ...rest,
        amount: Number(amountBorrowed),
        assetName: asset?.name,
        assetId: asset?.id,
      },
      message: 'Loan details retrieved successfully',
    };
  }

  async requestAssetLoan(userId: string, assetName: string) {
    const commodities = await this.config.getValue('COMMODITY_CATEGORIES');
    if (!commodities) {
      throw new BadRequestException('No commodities are in the inventory');
    }
    if (!commodities.includes(assetName)) {
      throw new BadRequestException(
        'Only commodities in stock can be requested.',
      );
    }

    const { id } = await this.prisma.commodityLoan.create({
      data: { name: assetName, userId, id: generateId.assetLoanId() },
      select: { id: true },
    });

    return {
      message: `You have successfully requested a commodity loan for ${assetName}! Please keep an eye out for communication lines from our support`,
      data: { id },
    };
  }

  async getAssetLoanById(userId: string, cLoanId: string) {
    const cLoan = await this.prisma.commodityLoan.findUnique({
      where: { id: cLoanId, userId },
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
          userId,
          inReview: true,
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
        where: { userId, inReview: true },
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
    const activeLoan = await this.prisma.activeLoan.findUnique({
      where: { userId },
      select: {
        id: true,
        amountRepayable: true,
        amountRepaid: true,
        disbursementDate: true,
        tenure: true,
      },
    });

    if (!activeLoan) return null;

    const { amountRepaid, amountRepayable, ...rest } = activeLoan;

    return {
      ...rest,
      repaid: amountRepaid.toNumber(),
      amount: amountRepayable.toNumber(),
    };
  }
}
