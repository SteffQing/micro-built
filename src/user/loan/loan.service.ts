import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { addMonths } from 'date-fns';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateLoanDto,
  UpdateLoanDto,
  UpdateLoanStatusDto,
} from '../common/dto';
import { generateId } from 'src/common/utils';
import { ConfigService } from 'src/config/config.service';

@Injectable()
export class LoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private calculateRepayable(
    amount: number,
    tenure: number,
    rate: number,
  ): number {
    const tenureYears = tenure / 12;
    const interest = (amount * rate * tenureYears) / 100;
    return amount + interest;
  }

  async getUserLoansOverview(userId: string) {
    const loans = await this.prisma.loan.findMany({
      where: { borrowerId: userId, status: { in: ['PENDING', 'DISBURSED'] } },
      select: {
        amount: true,
        managementFeeRate: true,
        interestRate: true,
        disbursementDate: true,
        loanTenure: true,
        extension: true,
        status: true,
        repayments: {
          select: {
            repaidAmount: true,
            periodInDT: true,
          },
          orderBy: {
            periodInDT: 'desc',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingLoans = loans.filter((l) => l.status === 'PENDING');
    const activeLoans = loans.filter((l) => l.status === 'DISBURSED');

    let totalActiveLoanAmount = 0;
    let totalRepaid = 0;
    let allRepayments: { repaid: number; date: Date }[] = [];

    const now = new Date();
    const overdueLoansCount = activeLoans.filter((loan) => {
      if (!loan.disbursementDate) return false;
      const months = loan.loanTenure + loan.extension;
      const dueDate = addMonths(new Date(loan.disbursementDate), months);
      return dueDate < now;
    }).length;

    for (const loan of activeLoans) {
      const tenure = loan.loanTenure + loan.extension;
      const repayable = this.calculateRepayable(
        Number(loan.amount),
        tenure,
        Number(loan.interestRate),
      );
      totalActiveLoanAmount += repayable;

      for (const repayment of loan.repayments) {
        totalRepaid += Number(repayment.repaidAmount);
        allRepayments.push({
          repaid: Number(repayment.repaidAmount),
          date: new Date(repayment.periodInDT),
        });
      }
    }

    allRepayments.sort((a, b) => b.date.getTime() - a.date.getTime());

    const lastDeduction = allRepayments[0]
      ? {
          amount: allRepayments[0].repaid,
          date: allRepayments[0].date,
        }
      : null;

    const nextRepaymentDate = lastDeduction
      ? addMonths(lastDeduction.date, 1)
      : null;

    return {
      activeLoanAmount: totalActiveLoanAmount,
      activeLoanRepaid: totalRepaid,
      overdueLoansCount,
      pendingLoanRequestsCount: pendingLoans.length,
      lastDeduction,
      nextRepaymentDate,
    };
  }

  async getPendingLoansAndLoanCount(userId: string) {
    const [pendingLoans, rejectedCount, approvedCount, disbursedCount] =
      await Promise.all([
        this.prisma.loan.findMany({
          where: {
            borrowerId: userId,
            status: 'PENDING',
          },
          select: { id: true, amount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.loan.count({
          where: {
            borrowerId: userId,
            status: 'REJECTED',
          },
        }),
        this.prisma.loan.count({
          where: {
            borrowerId: userId,
            status: 'APPROVED',
          },
        }),
        this.prisma.loan.count({
          where: {
            borrowerId: userId,
            status: 'DISBURSED',
          },
        }),
      ]);

    const loans = pendingLoans.map((loan) => ({
      id: loan.id,
      amount: Number(loan.amount),
      date: new Date(loan.createdAt),
    }));

    return {
      data: {
        pendingLoans: loans,
        rejectedCount,
        approvedCount,
        disbursedCount,
      },
      message: 'Pending loans and loans data retrieved successfully!',
    };
  }

  async getLoanRequestHistory(userId: string, limit = 10, page = 1) {
    const skip = (page - 1) * limit;

    const [loans, total] = await Promise.all([
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
          amount: true,
          createdAt: true,
          category: true,
          status: true,
        },
      }),
      this.prisma.loan.count({
        where: { borrowerId: userId },
      }),
    ]);

    const loanHistory = loans.map((loan) => {
      const { createdAt, amount, ...rest } = loan;
      const newLoan = {
        ...rest,
        amount: Number(amount),
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
      data: { loans: loanHistory },
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
          identity: { select: { verified: true } },
        },
      }),
      this.config.getValue('INTEREST_RATE'),
      this.config.getValue('MANAGEMENT_FEE_RATE'),
    ]);

    const userIdentity = user?.identity;
    const userPaymentMethod = user?.paymentMethod;
    const userPayroll = user?.payroll;

    // if (!userIdentity) {
    //   throw new BadRequestException(
    //     'You must complete identity verification before requesting a loan.',
    //   );
    // }
    // if (!userIdentity.verified) {
    //   throw new BadRequestException(
    //     'Identity verification is still pending. You cannot request a loan until it is verified.',
    //   );
    // }
    if (!userPaymentMethod) {
      throw new NotFoundException(
        'You need to have added a payment method in order to apply for a loan.',
      );
    }
    if (!userPayroll) {
      throw new NotFoundException(
        'You need to have added your payroll data in order to apply for a loan.',
      );
    }
    if (!interestPerAnnum || !managementFeeRate) {
      throw new BadRequestException(
        'Interest rate or management fee rate is not set. Please contact support.',
      );
    }

    const id = generateId.loanId();
    await this.prisma.loan.create({
      data: {
        ...dto,
        borrowerId: userId,
        id,
        interestRate: interestPerAnnum,
        managementFeeRate: managementFeeRate,
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

  async updateLoan(userId: string, dto: UpdateLoanDto) {
    const [userIdentity, loan] = await Promise.all([
      this.prisma.userIdentity.findUnique({
        where: { userId },
        select: { verified: true },
      }),
      this.prisma.loan.findUnique({
        where: { id: dto.id, borrowerId: userId },
        select: {
          status: true,
          amount: true,
          loanTenure: true,
        },
      }),
    ]);

    // if (!userIdentity?.verified) {
    //   throw new BadRequestException(
    //     'Identity verification is still pending. You cannot update a loan until it is verified.',
    //   );
    // }

    if (!loan) {
      throw new NotFoundException(
        'Loan with the provided ID could not be found. Please check and try again',
      );
    }
    if (loan.status !== 'PENDING') {
      throw new BadRequestException('Only pending loans can be modified.');
    }

    await this.prisma.loan.update({
      where: { id: dto.id },
      data: {
        ...dto,
      },
      select: {
        id: true,
      },
    });
    return {
      message: 'Loan application updated successfully',
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

    return { message: 'Loan deleted successfully' };
  }

  async getLoanById(userId: string, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: {
        id: loanId,
        borrowerId: userId,
      },
      select: {
        id: true,
        amount: true,
        status: true,
        category: true,
        loanTenure: true,
        extension: true,
        disbursementDate: true,
        createdAt: true,
        updatedAt: true,
        interestRate: true,
        asset: {
          select: { name: true },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException(
        'Loan with the provided ID could not be found. Please check and try again',
      );
    }

    const { asset, interestRate, amount, ...rest } = loan;
    const tenure = loan.loanTenure + loan.extension;
    const repayable = this.calculateRepayable(
      Number(amount),
      tenure,
      Number(interestRate),
    );

    return {
      data: {
        ...rest,
        repayable,
        amount: Number(amount),
        assetName: asset?.name,
      },
      message: 'Loan details retrieved successfully',
    };
  }

  // Used to update status of loan after review from admin
  async updateLoanStatus(
    userId: string,
    loanId: string,
    dto: UpdateLoanStatusDto,
  ) {
    const loan = await this.prisma.loan.findUnique({
      where: { borrowerId: userId, id: loanId },
      select: { status: true },
    });

    if (!loan) {
      throw new NotFoundException(
        'Loan with the provided ID could not be found. Please check and try again',
      );
    }
    if (loan.status !== 'PREVIEW') {
      throw new BadRequestException(
        'Only loans in preview status can be updated',
      );
    }

    await this.prisma.loan.update({
      where: { id: loanId },
      data: { status: dto.status },
      select: { id: true },
    });

    return {
      message: `Loan with loan id: ${loanId}, has been updated to ${dto.status.toLowerCase()}`,
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

    const cLoanId = generateId.assetLoanId();
    await this.prisma.commodityLoan.create({
      data: { name: assetName, userId, id: cLoanId },
    });

    return {
      message: `You have successfully requested a commodity loan for a ${assetName}! Please keep an eye out for communication lines from our support`,
    };
  }
}
