import { Injectable } from '@nestjs/common';
import { addMonths } from 'date-fns';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LoanService {
  constructor(private readonly prisma: PrismaService) {}

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
    let totalRepayable = 0;
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
      totalActiveLoanAmount += Number(loan.amount);
      totalRepayable += Number(loan.repayable);

      for (const repayment of loan.repayments) {
        totalRepaid += Number(repayment.repaid);
        allRepayments.push({
          repaid: Number(repayment.repaid),
          date: new Date(repayment.periodInDT),
        });
      }
    }

    allRepayments.sort((a, b) => b.date.getTime() - a.date.getTime());

    const lastRepayment = allRepayments[0]
      ? {
          amount: allRepayments[0].repaid,
          date: allRepayments[0].date.toISOString(),
        }
      : null;

    const nextRepaymentDate = allRepayments[0]
      ? addMonths(allRepayments[0].date, 1).toISOString()
      : null;

    return {
      activeLoanAmount: totalActiveLoanAmount,
      amountRepaid: totalRepaid,
      balanceLeft: totalRepayable - totalRepaid,
      overdueLoansCount,
      pendingLoanRequests: pendingLoans.length,
      lastRepayment,
      nextRepaymentDate,
    };
  }
}
