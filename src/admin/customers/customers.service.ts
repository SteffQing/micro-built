import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { startOfMonth, endOfMonth } from 'date-fns';
import { CustomersQueryDto } from '../common/dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUsersRepaymentStatusSummary() {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const statuses = await Promise.all([
      this.prisma.repayment.findMany({
        where: {
          status: { in: ['AWAITING', 'FAILED'] },
          periodInDT: { gte: monthStart, lte: monthEnd },
        },
        distinct: ['userId'],
        select: { userId: true },
      }),

      this.prisma.repayment.findMany({
        where: {
          status: { in: ['PARTIAL', 'OVERPAID'] },
          periodInDT: { gte: monthStart, lte: monthEnd },
        },
        distinct: ['userId'],
        select: { userId: true },
      }),

      this.prisma.repayment.findMany({
        where: {
          status: 'FULFILLED',
          periodInDT: { gte: monthStart, lte: monthEnd },
        },
        distinct: ['userId'],
        select: { userId: true },
      }),
    ]);

    const [defaulted, flagged, ontime] = statuses;

    return {
      defaultedCount: defaulted.length,
      flaggedCount: flagged.length,
      ontimeCount: ontime.length,
    };
  }

  async getOverview() {
    const [
      activeCustomersCount,
      flaggedCustomersCount,
      customersWithActiveLoansCount,
      customersRepaymentsSummary,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CUSTOMER', status: 'ACTIVE' } }),
      this.prisma.user.count({
        where: { role: 'CUSTOMER', status: 'FLAGGED' },
      }),
      this.prisma.loan.groupBy({
        by: ['borrowerId'],
        where: { status: 'DISBURSED' },
        _count: { borrowerId: true },
      }),
      this.getUsersRepaymentStatusSummary(),
    ]);

    return {
      activeCustomersCount,
      flaggedCustomersCount,
      customersWithActiveLoansCount: customersWithActiveLoansCount.length,
      ...customersRepaymentsSummary,
    };
  }

  async getCustomers(filters: CustomersQueryDto) {
    const { search, status, page = 1, limit = 20 } = filters;

    const whereClause: Prisma.UserWhereInput = { role: 'CUSTOMER' };
    if (status) whereClause.status = status;
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    return {
      meta: {
        total: totalCount,
        page,
        limit,
      },
      data: users,
      message: 'Customers table has been successfully queried',
    };
  }
}

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUserRepaymentStatusSummary(externalId: string) {
    const [defaulted, flagged] = await Promise.all([
      this.prisma.repayment.count({
        where: {
          status: { in: ['AWAITING', 'FAILED'] },
          userId: externalId,
        },
      }),

      this.prisma.repayment.count({
        where: {
          status: { in: ['PARTIAL', 'OVERPAID'] },
          userId: externalId,
        },
      }),
    ]);

    return [defaulted, flagged] as const;
  }

  async getUserInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        avatar: true,
        contact: true,
      },
    });
    if (!user) return { data: null, message: 'User info not found' };

    return {
      data: {
        ...user,
      },
      message: 'User has been successfully queried',
    };
  }

  async getUserActiveAndPendingLoans(userId: string) {
    const [_activeLoans, _pendingLoans] = await Promise.all([
      this.prisma.loan.findMany({
        where: { borrowerId: userId, status: 'DISBURSED' },
        select: {
          id: true,
          amount: true,
          loanTenure: true,
          amountRepaid: true,
          amountRepayable: true,
        },
      }),
      this.prisma.loan.findMany({
        where: { borrowerId: userId, status: 'PENDING' },
        select: {
          id: true,
          category: true,
          createdAt: true,
          amount: true,
        },
      }),
    ]);

    const activeLoans = _activeLoans.map(({ amountRepayable, ...loan }) => ({
      ...loan,
      amount: Number(loan.amount),
      amountRepaid: Number(loan.amountRepaid),
      balance: Number(amountRepayable.sub(loan.amountRepaid)),
    }));
    const pendingLoans = _pendingLoans.map(({ createdAt, ...loan }) => ({
      ...loan,
      amount: Number(loan.amount),
      date: new Date(createdAt),
    }));

    return {
      data: { activeLoans, pendingLoans },
      message: "User's active and pending loans have been successfully queried",
    };
  }

  async getUserLoanSummaryAndPayrollInfo(userId: string) {
    const [summary, user] = await Promise.all([
      this.prisma.loan.aggregate({
        where: { borrowerId: userId },
        _sum: {
          amountRepaid: true,
          amountRepayable: true,
          amount: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { externalId: true },
      }),
    ]);

    const repayments: readonly [number, number] = user?.externalId
      ? await this.getUserRepaymentStatusSummary(user.externalId)
      : [0, 0];

    return {
      totalBorrowed: Number(summary._sum.amount ?? 0),
      totalOutstanding:
        Number(summary._sum.amountRepayable ?? 0) -
        Number(summary._sum.amountRepaid ?? 0),
      defaultedRepaymentsCount: repayments[0],
      flaggedRepaymentsCount: repayments[1],
    };
  }

  async getUserPayrollAndIdentityInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        identity: true,
        payroll: true,
      },
    });
    if (!user) return { data: null, message: 'User info not found' };

    return {
      data: {
        ...user,
      },
      message: 'User has been successfully queried',
    };
  }
}
