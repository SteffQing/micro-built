import { BadRequestException, Injectable } from '@nestjs/common';
import { LoanCategory, Prisma, RepaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { startOfMonth, endOfMonth } from 'date-fns';
import {
  CustomerCashLoan,
  CustomerCommodityLoan,
  CustomersQueryDto,
  OnboardCustomer,
} from '../common/dto';
import { generateCode, generateId } from 'src/common/utils';
import * as bcrypt from 'bcrypt';
import { LoanService } from 'src/user/loan/loan.service';
import { CashLoanService, CommodityLoanService } from '../loan/loan.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userLoanService: LoanService,
    private readonly adminCashLoanService: CashLoanService,
    private readonly adminCommodityLoanService: CommodityLoanService,
    private readonly supabase: SupabaseService,
  ) {}

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
          status: { in: ['PARTIAL'] },
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

  private async cashLoan(
    uid: string,
    dto: CustomerCashLoan,
    category: LoanCategory,
  ) {
    let response = 'Cash loan was not successfully created!';
    try {
      const { amount, tenure } = dto;
      const { data } = await this.userLoanService.applyForLoan(uid, {
        amount,
        category,
      });
      response = 'Cash loan has been successfully created';
      const loanId = data.id;
      await this.adminCashLoanService.setLoanTerms(loanId, { tenure });
      response = 'Terms for the cash loan has been successfully set';
      await this.userLoanService.updateLoanStatus(uid, loanId, {
        status: 'APPROVED',
      });
      response = 'Cash loan has been approved. Awaiting disbursement!';
    } catch (e) {
      console.error(e);
    } finally {
      return response;
    }
  }

  private async commodityLoan(uid: string, dto: CustomerCommodityLoan) {
    let response = 'Asset loan was not successfully created!';
    try {
      const { assetName, ...cLoanDto } = dto;
      const { data } = await this.userLoanService.requestAssetLoan(
        uid,
        assetName,
      );
      response = 'Asset loan has been successfully created';
      const cLoanId = data.id;
      const {
        data: { loanId },
      } = await this.adminCommodityLoanService.approveCommodityLoan(
        cLoanId,
        cLoanDto,
      );
      response = 'Terms for the asset loan has been successfully set';
      await this.userLoanService.updateLoanStatus(uid, loanId, {
        status: 'APPROVED',
      });
      response = 'Asset loan has been approved. Awaiting disbursement!';
    } catch (e) {
      console.error(e);
    } finally {
      return response;
    }
  }

  async addCustomer(dto: OnboardCustomer) {
    const userId = generateId.userId();
    const password = generateCode.generatePassword();
    const hashedPassword = await bcrypt.hash(password, 10);
    const { externalId, ...payroll } = dto.payroll;

    await this.prisma.user.create({
      data: {
        id: userId,
        password: hashedPassword,
        externalId,
        status: 'ACTIVE',
        ...dto.user,
        identity: { create: { ...dto.identity } },
        paymentMethod: { create: { ...dto.paymentMethod } },
      },
    });
    await this.prisma.userPayroll.create({
      data: {
        ...payroll,
        userId: externalId,
      },
    });

    // fn to notify onboarded user via text/mail

    if (!dto.loan)
      return {
        data: { userId },
        message: `${dto.user.name} has been successfully onboarded!`,
      };

    const { category, cashLoan, commodityLoan } = dto.loan;
    const loan =
      category === 'ASSET_PURCHASE'
        ? this.commodityLoan(userId, commodityLoan!)
        : this.cashLoan(userId, cashLoan!, category);

    const loanResponse = await loan;

    return {
      data: { userId },
      message: `${dto.user.name} has been successfully onboarded! ${loanResponse}`,
    };
  }

  async uploadFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const url = await this.supabase.uploadOnboardingForm(file);

    return {
      data: { url },
      message: `${file.originalname} has been successfully uploaded!`,
    };
  }
}

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getUserLoanSummary(userId: string) {
    const [repaymentsAgg, loansAgg] = await Promise.all([
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
          userId,
        },
      }),
      this.prisma.loan.aggregate({
        _sum: {
          amountRepayable: true,
          amountRepaid: true,
        },
        where: { status: 'DISBURSED', borrowerId: userId },
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
        totalBorrowed: totalExpected.toNumber(),
        totalOverdue: totalOverdue.toNumber(),
        defaultedRepaymentsCount: failedDeductionsCount.toNumber(),
        flaggedRepaymentsCount: underpaidCount.toNumber(),
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
}
