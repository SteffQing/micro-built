import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { addMonths } from 'date-fns';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLoanDto, UpdateLoanDto } from '../common/dto';
import { generateId } from 'src/common/utils';

@Injectable()
export class LoanService {
  constructor(private readonly prisma: PrismaService) {}

  private fetchInterestRate(): Promise<number> {
    return new Promise((resolve) => setTimeout(() => resolve(12), 0));
  }

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
      where: { borrowerId: userId },
      select: {
        amount: true,
        repayable: true,
        disbursementDate: true,
        loanTenure: true,
        extension: true,
        status: true,
        repayments: {
          select: {
            repaid: true,
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
      totalActiveLoanAmount += Number(loan.repayable);

      for (const repayment of loan.repayments) {
        totalRepaid += Number(repayment.repaid);
        allRepayments.push({
          repaid: Number(repayment.repaid),
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
          loanType: true,
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
    const [userIdentity, userPaymentMethod, interestPerAnnum] =
      await Promise.all([
        this.prisma.userIdentity.findUnique({
          where: { userId },
          select: { verified: true },
        }),
        this.prisma.userPaymentMethod.findUnique({
          where: { userId },
          select: { userId: true },
        }),
        this.fetchInterestRate(),
      ]);

    if (!userIdentity) {
      throw new UnauthorizedException(
        'You must complete identity verification before requesting a loan.',
      );
    }
    if (!userIdentity.verified) {
      throw new UnauthorizedException(
        'Identity verification is still pending. You cannot request a loan until it is verified.',
      );
    }
    if (!userPaymentMethod) {
      throw new NotFoundException(
        'You need to have added a payment method in order to apply for a loan.',
      );
    }

    const repayable = this.calculateRepayable(
      dto.amount,
      dto.loanTenure,
      interestPerAnnum,
    );

    const id = generateId.loanId();
    await this.prisma.loan.create({
      data: {
        ...dto,
        borrowerId: userId,
        id,
        repayable,
      },
      select: {
        id: true,
      },
    });

    const loan = { id, repayable };

    return {
      message: 'Loan application submitted successfully',
      data: loan,
    };
  }

  async updateLoan(userId: string, dto: UpdateLoanDto) {
    const [userIdentity, interestPerAnnum, loan] = await Promise.all([
      this.prisma.userIdentity.findUnique({
        where: { userId },
        select: { verified: true },
      }),
      this.fetchInterestRate(),
      this.prisma.loan.findUnique({
        where: { id: dto.id, borrowerId: userId },
        select: {
          status: true,
          repayable: true,
          amount: true,
          loanTenure: true,
        },
      }),
    ]);

    if (!userIdentity?.verified) {
      throw new UnauthorizedException(
        'Identity verification is still pending. You cannot update a loan until it is verified.',
      );
    }

    if (!loan) {
      throw new NotFoundException(
        'Loan with the provided ID could not be found. Please check and try again',
      );
    }
    if (loan.status !== 'PENDING') {
      throw new BadRequestException('Only pending loans can be modified.');
    }

    const amount = dto.amount ?? Number(loan.amount);
    const loanTenure = dto.loanTenure ?? loan.loanTenure;
    const repayable = this.calculateRepayable(
      amount,
      loanTenure,
      interestPerAnnum,
    );

    await this.prisma.loan.update({
      where: { id: dto.id },
      data: {
        ...dto,
        repayable,
      },
      select: {
        id: true,
      },
    });
    return {
      message: 'Loan application updated successfully',
      data: { repayable },
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
        repayable: true,
        status: true,
        loanType: true,
        category: true,
        loanTenure: true,
        extension: true,
        disbursementDate: true,
        createdAt: true,
        updatedAt: true,
        assetId: true,
      },
    });

    if (!loan) {
      throw new NotFoundException(
        'Loan with the provided ID could not be found. Please check and try again',
      );
    }

    return { data: loan, message: 'Loan details retrieved successfully' };
  }
}
