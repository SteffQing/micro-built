import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { periodLabel, visibleEmail } from '@microbuilt/shared';
import { PrismaService } from '../database/prisma.service';
import { SupabaseService } from '../database/supabase.service';
import { loanFiguresMany } from 'src/common/dto/loan.dto';
import type { AccessRole, AuthUser } from 'src/common/types';
import { ChangeRequestsService } from 'src/change-requests/change-requests.service';
import { repaymentRates } from 'src/ledger/repayment-rate';
import { toNumber } from 'src/ledger/money';
import { buildActivityFeed } from './common/utils/activity';
import type { ActivitySummary } from './common/interface/activity';
import type {
  UserDto,
  UserOverviewDto,
  UserPayrollDto,
  UserPaymentMethodDto,
} from './common/entities/user.entities';

/** How many rows of each kind the activity feed reads before merging. */
const ACTIVITY_ROWS = 10;
const LIVE_STATUSES = ['PENDING', 'APPROVED', 'DISBURSED'] as const;

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly changeRequests: ChangeRequestsService,
  ) {}

  /** The session bootstrap for customers and admins alike (admins have no Customer row). */
  async getUserById(userId: string, role: AccessRole): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        image: true,
        type: true,
        status: true,
        twoFactorEnabled: true,
        createdAt: true,
        customer: {
          select: {
            externalId: true,
            flagReason: true,
            accountOfficer: { select: { userId: true, user: { select: { name: true } } } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const { customer, email, twoFactorEnabled, ...rest } = user;
    const officer = customer?.accountOfficer;
    return {
      ...rest,
      email: visibleEmail(email),
      role,
      twoFactorEnabled: twoFactorEnabled ?? false,
      externalId: customer?.externalId ?? null,
      flagReason: customer?.flagReason ?? null,
      accountOfficer: officer ? { id: officer.userId, name: officer.user.name } : null,
    };
  }

  /** A super admin's photo changes at once; anyone else's waits for approval. */
  async uploadAvatar(file: Express.Multer.File | undefined, user: AuthUser) {
    if (!file) throw new BadRequestException('Choose an image to upload');

    if (user.role !== 'SUPER_ADMIN') {
      await this.changeRequests.submitAvatar(user.userId, file.buffer, file.mimetype);
      const current = await this.prisma.user.findUnique({ where: { id: user.userId }, select: { image: true } });
      return {
        data: { url: current?.image ?? null, pending: true },
        message: 'Your new photo has been sent for review. It will show once an admin approves it.',
      };
    }
    const url = await this.supabase.uploadUserAvatar(file, user.userId);
    await this.prisma.user.update({ where: { id: user.userId }, data: { image: url } });
    return { data: { url, pending: false }, message: 'Avatar has been successfully updated!' };
  }

  /** The dashboard header: the live loan's figures, pending requests, the last and next deduction. */
  async getOverview(userId: string): Promise<UserOverviewDto> {
    const [loan, pendingLoans, topups, commodities, lastRepayment, rates] = await Promise.all([
      this.prisma.loan.findFirst({
        where: { borrowerId: userId, status: { in: [...LIVE_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          category: true,
          status: true,
          principal: true,
          tenure: true,
          disbursementDate: true,
          createdAt: true,
          deductions: {
            where: { status: 'OPEN' },
            select: { expected: true, period: { select: { month: true, year: true } } },
          },
        },
      }),
      this.prisma.loan.count({ where: { borrowerId: userId, status: { in: ['PENDING', 'APPROVED'] } } }),
      this.prisma.microLoan.count({
        where: { loan: { borrowerId: userId }, purpose: 'TOPUP', status: { in: ['PENDING', 'APPROVED'] } },
      }),
      this.prisma.commodityLoan.count({ where: { loan: { borrowerId: userId }, status: 'IN_REVIEW' } }),
      this.prisma.repayment.findFirst({
        where: { loan: { borrowerId: userId } },
        orderBy: { createdAt: 'desc' },
        select: {
          amount: true,
          createdAt: true,
          paymentInflow: { select: { source: true, period: { select: { month: true, year: true } } } },
        },
      }),
      repaymentRates(this.prisma, [userId]),
    ]);

    let currentLoan: UserOverviewDto['currentLoan'] = null;
    let nextDeduction: UserOverviewDto['nextDeduction'] = null;
    if (loan) {
      const { deductions, ...row } = loan;
      const figures = (await loanFiguresMany(this.prisma, [row])).get(row.id)!;
      currentLoan = {
        ...figures,
        id: row.id,
        category: row.category,
        status: row.status,
        disbursementDate: row.disbursementDate,
        createdAt: row.createdAt,
      };
      const open = deductions[0];
      if (open && open.expected.gt(0)) {
        nextDeduction = { amount: toNumber(open.expected), period: periodLabel(open.period) };
      }
    }

    return {
      currentLoan,
      repaymentRate: rates.get(userId) ?? 100,
      pendingLoanRequestsCount: pendingLoans + topups + commodities,
      pendingRequests: { loans: pendingLoans, topups, commodities },
      lastDeduction: lastRepayment
        ? {
            amount: toNumber(lastRepayment.amount),
            date: lastRepayment.createdAt,
            period: periodLabel(lastRepayment.paymentInflow.period),
            source: lastRepayment.paymentInflow.source,
          }
        : null,
      nextDeduction,
    };
  }

  async getRecentActivities(userId: string): Promise<ActivitySummary[]> {
    const mine = { loan: { borrowerId: userId } };
    const latest = { orderBy: { createdAt: 'desc' as const }, take: ACTIVITY_ROWS };
    const [user, identity, paymentMethod, loans, microLoans, commodities, repayments, liquidations] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
        this.prisma.customerIdentity.findUnique({
          where: { userId },
          select: { createdAt: true, updatedAt: true },
        }),
        this.prisma.customerPaymentMethod.findUnique({
          where: { userId },
          select: { createdAt: true, updatedAt: true, bankName: true },
        }),
        this.prisma.loan.findMany({
          where: { borrowerId: userId },
          ...latest,
          select: { id: true, category: true, status: true, principal: true, createdAt: true, updatedAt: true },
        }),
        this.prisma.microLoan.findMany({
          where: { ...mine, purpose: { in: ['NEW_LOAN', 'TOPUP', 'PENALTY'] } },
          ...latest,
          select: {
            loanId: true,
            purpose: true,
            status: true,
            amount: true,
            createdAt: true,
            disbursedAt: true,
            tenureChange: { select: { monthsDelta: true, status: true } },
          },
        }),
        this.prisma.commodityLoan.findMany({
          where: mine,
          ...latest,
          select: { status: true, createdAt: true, commodity: { select: { name: true } } },
        }),
        this.prisma.repayment.findMany({
          where: mine,
          ...latest,
          select: {
            loanId: true,
            amount: true,
            createdAt: true,
            paymentInflow: { select: { source: true, period: { select: { month: true, year: true } } } },
          },
        }),
        this.prisma.paymentInflow.findMany({
          where: { customerId: userId, source: 'LIQUIDATION' },
          ...latest,
          select: { amount: true, state: true, createdAt: true },
        }),
      ]);

    return buildActivityFeed({
      user,
      identity,
      paymentMethod,
      loans,
      microLoans,
      commodities,
      repayments,
      liquidations,
    });
  }

  /** Also used by the admin customer page; `data` is null until the customer adds payroll details. */
  async getPayroll(userId: string): Promise<{ message: string; data: UserPayrollDto | null }> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { payroll: true },
    });
    const payroll = customer?.payroll;
    if (!payroll) return { message: 'User payroll data not found', data: null };

    return {
      message: 'User payroll data found',
      data: {
        externalId: payroll.externalId,
        netPay: toNumber(payroll.netPay),
        employeeGross: toNumber(payroll.employeeGross),
        grade: payroll.grade ?? undefined,
        step: payroll.step ?? undefined,
        command: payroll.command,
        organization: payroll.organization,
      },
    };
  }

  async getPaymentMethod(userId: string): Promise<UserPaymentMethodDto | null> {
    return this.prisma.customerPaymentMethod.findUnique({
      where: { userId },
      select: { bankName: true, accountNumber: true, accountName: true },
    });
  }

  async getIdentityInfo(userId: string) {
    return this.prisma.customerIdentity.findUnique({
      where: { userId },
      select: {
        dateOfBirth: true,
        gender: true,
        maritalStatus: true,
        residencyAddress: true,
        stateResidency: true,
        landmarkOrBusStop: true,
        nextOfKinName: true,
        nextOfKinContact: true,
        nextOfKinAddress: true,
        nextOfKinRelationship: true,
      },
    });
  }
}
