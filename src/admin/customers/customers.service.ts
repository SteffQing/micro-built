import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LoanCategory,
  LoanStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { startOfMonth, endOfMonth } from 'date-fns';
import {
  CustomerCashLoan,
  CustomerCommodityLoan,
  CustomerLoanRequest,
  CustomersQueryDto,
  OnboardCustomer,
  SendMessageDto,
  UpdateCustomerStatusDto,
} from '../common/dto';
import { generateCode, generateId } from 'src/common/utils';
import * as bcrypt from 'bcrypt';
import { LoanService } from 'src/user/loan/loan.service';
import { CashLoanService } from '../loan/loan.service';
import { Decimal } from '@prisma/client/runtime/library';
import { InappService } from 'src/notifications/inapp.service';
import { ConfigService } from 'src/config/config.service';
import { QueueProducer } from 'src/queue/bull/queue.producer';
import { calculateAmortizedPayment } from 'src/common/utils/shared-repayment.logic';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdminEvents } from 'src/queue/events/events';
import { AuthUser } from 'src/common/types';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly event: EventEmitter2,
  ) {}

  private PLATFORM_ID = 'microbuilt-system-id';

  async getUsersRepaymentStatusSummary() {
    let defaulted = 0,
      flagged = 0,
      ontime = 0;

    const lastRepaymentDate = await this.config.getValue('LAST_REPAYMENT_DATE');
    if (!lastRepaymentDate) return { defaulted, flagged, ontime };

    const start = startOfMonth(lastRepaymentDate);
    const end = endOfMonth(lastRepaymentDate);

    const repayments = await this.prisma.repayment.findMany({
      where: {
        periodInDT: { gte: start, lte: end },
        status: { in: ['FAILED', 'PARTIAL', 'FULFILLED'] },
        userId: { not: null },
      },
      select: { userId: true, status: true },
    });

    const userStatusMap = new Map<string, string>();

    for (const { userId, status } of repayments) {
      if (userId === null) return;
      const current = userStatusMap.get(userId);
      if (!current) {
        userStatusMap.set(userId, status);
        continue;
      }

      if (status === 'FAILED') {
        userStatusMap.set(userId, 'DEFAULTED');
      } else if (status === 'PARTIAL' && current !== 'DEFAULTED') {
        userStatusMap.set(userId, 'FLAGGED');
      } else if (
        status === 'FULFILLED' &&
        !['DEFAULTED', 'FLAGGED'].includes(current)
      ) {
        userStatusMap.set(userId, 'ONTIME');
      }
    }

    for (const status of userStatusMap.values()) {
      if (status === 'DEFAULTED') defaulted++;
      else if (status === 'FLAGGED') flagged++;
      else if (status === 'ONTIME') ontime++;
    }

    return { defaulted, flagged, ontime };
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
        { externalId: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search, mode: 'insensitive' } },
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
          repaymentRate: true,
          contact: true,
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

  async getAccountOfficerCustomers(
    _officerId: string,
    filters: CustomersQueryDto,
  ) {
    const officerId = _officerId === this.PLATFORM_ID ? null : _officerId;

    const { search, status, page = 1, limit = 20 } = filters;

    const whereClause: Prisma.UserWhereInput = {
      role: 'CUSTOMER',
      accountOfficerId: officerId,
    };
    if (status) whereClause.status = status;
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { externalId: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          repaymentRate: true,
          contact: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    return {
      meta: { total, page, limit },
      data: customers,
    };
  }

  async getAccountOfficerStats(_officerId: string) {
    const officerId = _officerId === this.PLATFORM_ID ? null : _officerId;

    const userWhere: Prisma.UserWhereInput = {
      role: 'CUSTOMER',
      accountOfficerId: officerId,
    };

    const [userAggregates, loanAggregates, repaymentRateStats] =
      await Promise.all([
        this.prisma.user.groupBy({
          by: ['status'],
          where: userWhere,
          _count: {
            _all: true,
          },
        }),

        this.prisma.loan.aggregate({
          where: {
            borrower: userWhere,
            status: 'DISBURSED',
          },
          _sum: {
            principal: true,
            repaid: true,
            penalty: true,
          },
          _count: {
            id: true,
          },
        }),

        this.prisma.user.aggregate({
          where: userWhere,
          _avg: {
            repaymentRate: true,
          },
        }),
      ]);

    const statusCounts = userAggregates.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count._all;
        acc.TOTAL += curr._count._all;
        return acc;
      },
      { ACTIVE: 0, INACTIVE: 0, FLAGGED: 0, TOTAL: 0 },
    );

    const totalPrincipal = Number(loanAggregates._sum.principal || 0);
    const totalRepaid = Number(loanAggregates._sum.repaid || 0);
    const totalPenalty = Number(loanAggregates._sum.penalty || 0);

    const approximateOutstanding = totalPrincipal - totalRepaid;

    return {
      customers: {
        total: statusCounts.TOTAL,
        active: statusCounts.ACTIVE,
        inactive: statusCounts.INACTIVE,
        flagged: statusCounts.FLAGGED,
        avgRepaymentScore: Math.round(
          repaymentRateStats._avg.repaymentRate || 0,
        ),
      },
      portfolio: {
        totalLoans: loanAggregates._count.id,
        totalDisbursed: totalPrincipal,
        totalRepaid: totalRepaid,
        totalPenalty: totalPenalty,
        outstandingBalance: approximateOutstanding,
      },
    };
  }

  async getAccountOfficers() {
    const [officers, platformCount] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: { not: 'CUSTOMER' },
        },
        select: {
          id: true,
          name: true,
          role: true,
          _count: {
            select: { officerCustomers: true },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),

      this.prisma.user.count({
        where: {
          accountOfficerId: null,
          role: 'CUSTOMER',
        },
      }),
    ]);

    const formattedOfficers = officers.map(({ _count, ...officer }) => ({
      ...officer,
      customersCount: _count.officerCustomers,
      isSystem: false,
    }));

    const platformEntry = {
      id: this.PLATFORM_ID,
      name: 'Platform (Self-Signed)',
      role: 'SYSTEM',
      customersCount: platformCount,
      isSystem: true,
    };

    return [platformEntry, ...formattedOfficers];
  }

  async addCustomer(
    dto: OnboardCustomer,
    adminId: string,
    adminRole: UserRole,
  ) {
    const externalId = dto.payroll.externalId;

    const [existingUser, existingPayment, commodities] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          OR: [
            { email: dto.user.email },
            { contact: dto.user.contact },
            { externalId },
          ],
        },
      }),
      this.prisma.userPaymentMethod.findFirst({
        where: {
          OR: [
            { accountNumber: dto.paymentMethod.accountNumber },
            { bvn: dto.paymentMethod.bvn },
          ],
        },
      }),
      this.config.getValue('COMMODITY_CATEGORIES'),
    ]);

    if (existingUser) {
      if (existingUser.email === dto.user.email) {
        throw new BadRequestException('A user with this email already exists.');
      }
      if (existingUser.contact === dto.user.contact) {
        throw new BadRequestException(
          'A user with this contact number already exists.',
        );
      }
      if (existingUser.externalId === externalId) {
        throw new BadRequestException(
          'A user with this external ID already exists.',
        );
      }
      throw new BadRequestException('User data conflict detected.');
    }

    if (existingPayment) {
      if (existingPayment.accountNumber === dto.paymentMethod.accountNumber) {
        throw new BadRequestException(
          'A payment method with this account number already exists.',
        );
      }
      if (existingPayment.bvn === dto.paymentMethod.bvn) {
        throw new BadRequestException(
          'A payment method with this BVN already exists.',
        );
      }
      throw new BadRequestException('Payment method conflict detected.');
    }

    if (dto.loan?.category === 'ASSET_PURCHASE') {
      if (!commodities) {
        throw new BadRequestException('No commodities are in the inventory');
      }

      const assetName = dto.loan.commodityLoan!.assetName;
      if (!commodities.includes(assetName)) {
        throw new BadRequestException(
          `${assetName} was not found in stock to create user loan. Please review and try again`,
        );
      }
    }

    const userId = generateId.userId();
    this.event.emit(AdminEvents.onboardCustomer, {
      dto,
      userId,
      adminId,
      adminRole,
    });

    const message = `${dto.user.name} has been successfully onboarded!`;
    const response = dto.loan
      ? dto.loan.cashLoan
        ? 'Cash loan has been approved. Awaiting disbursement!'
        : 'Asset loan has been successfully created. Please carry out market research to approve the loan'
      : '';

    return { data: { userId }, message: `${message} ${response}` };
  }
}

@Injectable()
export class CustomerService {
  constructor(
    private readonly event: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly inapp: InappService,
    private readonly queue: QueueProducer,
  ) {}

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
        repaymentRate: true,
        flagReason: true,
      },
    });
    if (!user) return { data: null, message: 'User info not found' };

    return {
      data: user,
      message: 'User has been successfully queried',
    };
  }

  async getUserActiveAndPendingLoans(userId: string) {
    const [_activeLoans, _pendingLoans] = await Promise.all([
      this.prisma.loan.findMany({
        where: { borrowerId: userId, status: 'DISBURSED' },
        select: {
          id: true,
          repaid: true,
          principal: true,
          penalty: true,
          tenure: true,
          extension: true,
          interestRate: true,
          disbursementDate: true,
        },
      }),
      this.prisma.loan.findMany({
        where: { borrowerId: userId, status: 'PENDING' },
        select: {
          id: true,
          category: true,
          createdAt: true,
          principal: true,
        },
      }),
    ]);

    const activeLoans = _activeLoans.map(({ principal, repaid, ...loan }) => {
      const principal_ = Number(principal.add(loan.penalty));
      const months = loan.tenure + loan.extension;
      const rate = loan.interestRate.toNumber();

      const pmt = calculateAmortizedPayment(principal_, rate, months);
      const totalPayable = pmt * months;

      const amountOwed = totalPayable - repaid.toNumber();

      return {
        ...loan,
        amount: Number(principal),
        amountRepaid: Number(repaid),
        amountOwed,
      };
    });
    const pendingLoans = _pendingLoans.map(
      ({ createdAt, principal, ...loan }) => ({
        ...loan,
        amount: Number(principal),
        date: new Date(createdAt),
      }),
    );

    return {
      data: { activeLoans, pendingLoans },
      message: "User's active and pending loans have been successfully queried",
    };
  }

  async getUserLoanSummary(userId: string) {
    const [loansAgg, loans] = await Promise.all([
      this.prisma.loan.aggregate({
        _sum: {
          penalty: true,
          principal: true,
          repaid: true,
        },
        where: {
          status: { in: [LoanStatus.DISBURSED, LoanStatus.REPAID] },
          borrowerId: userId,
        },
      }),
      this.prisma.loan.findMany({
        where: { borrowerId: userId, status: 'DISBURSED' },
        select: {
          repaid: true,
          principal: true,
          penalty: true,
          tenure: true,
          extension: true,
          interestRate: true,
          disbursementDate: true,
        },
      }),
    ]);

    const totalBorrowed = loansAgg._sum.principal || new Decimal(0);
    const totalRepaid = loansAgg._sum.repaid || new Decimal(0);
    const totalPenalties = loansAgg._sum.penalty || new Decimal(0);

    const currentOverdue = loans.reduce((acc, loan) => {
      const principal = Number(loan.principal.add(loan.penalty));
      const months = loan.tenure + loan.extension;
      const rate = loan.interestRate.toNumber();

      const pmt = calculateAmortizedPayment(principal, rate, months);
      const totalPayable = new Decimal(pmt * months);

      return acc.add(totalPayable.sub(loan.repaid));
    }, new Decimal(0));

    return {
      data: {
        totalBorrowed: totalBorrowed.toNumber(),
        currentOverdue: currentOverdue.toNumber(),
        totalPenalties: totalPenalties.toNumber(),
        totalRepaid: totalRepaid.toNumber(),
      },
      message: 'User loan summary retrieved',
    };
  }

  async getUserPayrollPaymentMethodAndIdentityInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        identity: true,
        payroll: true,
        paymentMethod: true,
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

  async getUserPaymentMethod(userId: string) {
    const userPaymentMethod = await this.prisma.userPaymentMethod.findUnique({
      where: { userId },
      select: {
        accountName: true,
        accountNumber: true,
        bankName: true,
      },
    });
    if (!userPaymentMethod)
      return { data: null, message: 'User payment method not found' };

    return {
      data: {
        ...userPaymentMethod,
      },
      message: 'User PaymentMethod has been successfully queried',
    };
  }

  async updateCustomerStatus(
    userId: string,
    dto: UpdateCustomerStatusDto,
    admin: AuthUser,
  ) {
    const { status, reason } = dto;
    if (status === 'FLAGGED' && !reason) {
      throw new BadRequestException(
        'You need to provide a valid reason for flagging this account!',
      );
    }
    if (status !== 'FLAGGED' && admin.role !== 'SUPER_ADMIN') {
      throw new BadRequestException(
        'Only a super admin can update this customer status accordingly',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, status: true },
    });
    if (!user) throw new NotFoundException(`No user found with id: ${userId}`);

    const flagReason =
      status === 'FLAGGED' ? `${reason}|${admin.userId}` : undefined;
    await this.prisma.user.update({
      where: { id: userId },
      data: { status, flagReason },
    });

    return {
      data: null,
      message: `${user.name} status has been updated to ${status.toLowerCase()}`,
    };
  }

  async messageUser(userId: string, dto: SendMessageDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, status: true },
    });
    if (!user) throw new NotFoundException(`No user found with id: ${userId}`);

    await this.inapp.messageUser({ userId, ...dto });
    return {
      data: null,
      message: `Message has been successfully sent to ${user.name} as an in-app notification`,
    };
  }

  async generateLoanReport(userId: string, email: string) {
    const hasLoan = await this.prisma.loan.findFirst({
      where: { borrowerId: userId, disbursementDate: { not: null } },
      select: { id: true },
    });

    if (!hasLoan) {
      throw new BadRequestException(
        `Report cannot be generated as no loans has been requested by the user or activated`,
      );
    }

    return this.queue.generateCustomerLoanReport({ userId, email });
  }

  async loanTopup(
    customerId: string,
    admin: AuthUser,
    dto: CustomerLoanRequest,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: customerId },
      select: { status: true, accountOfficerId: true, name: true },
    });

    if (user.status === 'FLAGGED') {
      throw new BadRequestException(
        `Cannot top-up loan. ${user.name} is flagged`,
      );
    }

    if (admin.role === 'MARKETER' && admin.userId !== user.accountOfficerId) {
      throw new BadRequestException(
        "You cannot request loan top ups for customers you didn't onboard",
      );
    }

    this.event.emit(AdminEvents.loanTopup, {
      dto,
      userId: customerId,
      adminId: admin.userId,
    });

    return {
      message: 'Loan top-up request submitted successfully',
      data: null,
    };
  }
}
