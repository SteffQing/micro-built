import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { periodLabel, visibleEmail } from '@microbuilt/shared';
import { Prisma, type CommodityRequestStatus, type MicroLoanStatus } from '@prisma/client';
import { AuthAccountsService } from 'src/auth/auth-accounts.service';
import { loanFiguresMany } from 'src/common/dto/loan.dto';
import { parsePeriodRange, periodWhere } from 'src/common/dto/period.dto';
import { PLATFORM_ID } from 'src/common/constants';
import { captureJobError } from 'src/common/observability';
import type { AuthUser } from 'src/common/types';
import { titleCase } from 'src/commodities/commodities.service';
import { PrismaService } from 'src/database/prisma.service';
import { loanBalancesMany } from 'src/ledger/balances';
import { LOAN_NOT_ACTIVE } from 'src/ledger/ledger.constants';
import { LedgerService } from 'src/ledger/ledger.service';
import { LedgerTx } from 'src/ledger/ledger.tx';
import { money, sum, toNumber, ZERO } from 'src/ledger/money';
import { repaymentRates } from 'src/ledger/repayment-rate';
import { TenureChangesService } from 'src/ledger/tenure-changes.service';
import { InappService } from 'src/notifications/inapp.service';
import type {
  CustomerLoanTopupDto,
  CustomerRepaymentsQueryDto,
  CustomerTenureChangeQueryDto,
  CustomerTopupHistoryQueryDto,
  AssignAccountOfficerDto,
  SendMessageDto,
  UpdateCustomerStatusDto,
} from '../common/dto/customer.dto';
import type {
  CustomerIdentityDto,
  CustomerInfoDto,
  CustomerLoanApplicationDto,
  CustomerLoanItemDto,
  CustomerLoansDto,
  CustomerLoanSummaryDto,
  CustomerPaymentMethodDto,
  CustomerPayrollDto,
  CustomerPPIDto,
  CustomerRepaymentDto,
  CustomerTenureChangeDto,
  CustomerTopupHistoryItemDto,
  CustomerTopupRequestResultDto,
} from '../common/entities/customer.entities';
import type { ActiveLoanDto } from '../common/entities/loan.entities';
import { commodityKind, toLoanSummary, toTopup, TOPUP } from '../loan/loan.reads';

export const CUSTOMER_NOT_FOUND = 'Customer not found';
export const OFFICER_NOT_FOUND = 'Account officer not found';
export const FLAG_REASON_REQUIRED = 'Give a reason for flagging this account';
export const ONLY_SUPER_ADMIN_STATUS = 'Only a super admin can activate or deactivate a customer';
export const ASSET_REQUEST_IN_REVIEW = 'This loan already has an asset request in review';
export const TOPUP_WAITING = 'This loan already has a top-up waiting for a decision';

interface Page {
  page: number;
  limit: number;
}

const pageOf = (query: { page?: number; limit?: number }): Page => ({ page: query.page ?? 1, limit: query.limit ?? 20 });

function slice<T>(rows: T[], { page, limit }: Page): { data: T[]; meta: { total: number; page: number; limit: number } } {
  const start = (page - 1) * limit;
  return { data: rows.slice(start, start + limit), meta: { total: rows.length, page, limit } };
}

const PAYROLL = {
  externalId: true,
  netPay: true,
  employeeGross: true,
  grade: true,
  step: true,
  command: true,
  organization: true,
} satisfies Prisma.CustomerPayrollSelect;

const IDENTITY = {
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
} satisfies Prisma.CustomerIdentitySelect;

const PAYMENT_METHOD = { bankName: true, accountNumber: true, accountName: true } satisfies Prisma.CustomerPaymentMethodSelect;

type PayrollRow = Prisma.CustomerPayrollGetPayload<{ select: typeof PAYROLL }>;

function toPayroll(row: PayrollRow): CustomerPayrollDto {
  return { ...row, netPay: toNumber(row.netPay), employeeGross: toNumber(row.employeeGross) };
}

const SPLIT_KEYS = { PRINCIPAL: 'principal', INTEREST: 'interest', PENALTY: 'penalty' } as const;

function toSplit(breakdown: { component: keyof typeof SPLIT_KEYS; amount: Prisma.Decimal }[]) {
  const split = { principal: 0, interest: 0, penalty: 0 };
  for (const part of breakdown) split[SPLIT_KEYS[part.component]] = toNumber(part.amount);
  return split;
}

/** An asset top-up request still in review shows as PENDING, like the top-up it would become. */
const REQUEST_STATUS: Record<CommodityRequestStatus, MicroLoanStatus> = {
  IN_REVIEW: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

// The customer page: one customer's profile, loans, ledger history and the actions an admin
// takes on them. Money moves only through the ledger (top-ups); the rest are reads.
@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly ledger: LedgerService,
    private readonly tenureChanges: TenureChangesService,
    private readonly accounts: AuthAccountsService,
    private readonly inapp: InappService,
  ) {}

  // ---- profile ----

  async getInfo(customerId: string): Promise<CustomerInfoDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      select: {
        externalId: true,
        flagReason: true,
        user: { select: { name: true, email: true, phoneNumber: true, image: true, status: true, createdAt: true } },
        accountOfficer: { select: { userId: true, user: { select: { name: true } } } },
      },
    });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);
    const rates = await repaymentRates(this.prisma, [customerId]);
    const { user, accountOfficer } = customer;
    return {
      id: customerId,
      name: user.name,
      email: visibleEmail(user.email),
      phoneNumber: user.phoneNumber,
      image: user.image,
      status: user.status,
      flagReason: customer.flagReason,
      externalId: customer.externalId,
      repaymentRate: rates.get(customerId) ?? 100,
      accountOfficer: accountOfficer ? { id: accountOfficer.userId, name: accountOfficer.user.name } : null,
      createdAt: user.createdAt,
    };
  }

  /** The BVN only for super admins (`withBvn`); nobody else is sent it. */
  async getPPI(customerId: string, withBvn = false): Promise<CustomerPPIDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      select: {
        payroll: { select: PAYROLL },
        identity: { select: IDENTITY },
        paymentMethod: { select: { ...PAYMENT_METHOD, bvn: withBvn } },
      },
    });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);
    return {
      payroll: customer.payroll ? toPayroll(customer.payroll) : null,
      identity: customer.identity,
      paymentMethod: customer.paymentMethod,
    };
  }

  async getPayroll(customerId: string): Promise<CustomerPayrollDto | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      select: { payroll: { select: PAYROLL } },
    });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);
    return customer.payroll ? toPayroll(customer.payroll) : null;
  }

  async getIdentity(customerId: string): Promise<CustomerIdentityDto | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      select: { identity: { select: IDENTITY } },
    });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);
    return customer.identity;
  }

  async getPaymentMethod(customerId: string): Promise<CustomerPaymentMethodDto | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      select: { paymentMethod: { select: PAYMENT_METHOD } },
    });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);
    return customer.paymentMethod;
  }

  // ---- loans ----

  /** The running loan with its figures, and everything waiting for a decision or disbursement. */
  async getLoans(customerId: string): Promise<CustomerLoansDto> {
    await this.assertCustomer(customerId);
    const [loans, topups] = await Promise.all([
      this.prisma.loan.findMany({
        where: { borrowerId: customerId, status: { in: ['PENDING', 'APPROVED', 'DISBURSED'] } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          category: true,
          status: true,
          principal: true,
          tenure: true,
          disbursementDate: true,
          createdAt: true,
          commodities: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              status: true,
              createdAt: true,
              microLoan: { select: { purpose: true } },
              commodity: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.microLoan.findMany({
        where: { purpose: 'TOPUP', status: { in: ['PENDING', 'APPROVED'] }, loan: { borrowerId: customerId } },
        select: {
          id: true,
          loanId: true,
          amount: true,
          status: true,
          createdAt: true,
          loan: { select: { category: true } },
          commodity: { select: { id: true, commodity: { select: { name: true } } } },
        },
      }),
    ]);

    const openingAsset = (loan: (typeof loans)[number]) => {
      const request = loan.commodities.find((c) => commodityKind(c, loan) === 'NEW_LOAN');
      return request ? { id: request.id, name: request.commodity.name } : null;
    };

    const running = loans.filter((loan) => loan.status === 'DISBURSED');
    const figures = await loanFiguresMany(this.prisma, running);
    const activeLoans: CustomerLoanItemDto[] = running.map((loan) => ({
      ...toLoanSummary(loan, figures),
      createdAt: loan.createdAt,
      asset: openingAsset(loan),
    }));

    const applications: CustomerLoanApplicationDto[] = [];
    for (const loan of loans) {
      if (loan.status === 'PENDING' || loan.status === 'APPROVED') {
        // An asset loan is priced (amount, tenure) when its request is approved.
        const unpriced = loan.category === 'ASSET_PURCHASE' && loan.status === 'PENDING';
        applications.push({
          recordType: 'LOAN',
          detailsId: loan.id,
          loanId: loan.id,
          kind: 'NEW_LOAN',
          category: loan.category,
          status: loan.status,
          amount: unpriced ? null : toNumber(loan.principal),
          tenure: unpriced ? null : loan.tenure,
          date: loan.createdAt,
          asset: openingAsset(loan),
        });
        continue;
      }
      for (const request of loan.commodities) {
        if (request.status !== 'IN_REVIEW' || request.microLoan) continue;
        applications.push({
          recordType: 'COMMODITY_REQUEST',
          detailsId: request.id,
          loanId: loan.id,
          kind: 'TOPUP',
          category: 'ASSET_PURCHASE',
          status: 'PENDING',
          amount: null,
          tenure: null,
          date: request.createdAt,
          asset: { id: request.id, name: request.commodity.name },
        });
      }
    }
    for (const topup of topups) {
      applications.push({
        recordType: 'TOPUP',
        detailsId: topup.id,
        loanId: topup.loanId,
        kind: 'TOPUP',
        category: topup.loan.category,
        status: topup.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
        amount: toNumber(topup.amount),
        tenure: null,
        date: topup.createdAt,
        asset: topup.commodity ? { id: topup.commodity.id, name: topup.commodity.commodity.name } : null,
      });
    }
    applications.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      activeLoans,
      applications,
      pendingLoans: applications.filter((a) => a.status === 'PENDING'),
      approvedLoans: applications.filter((a) => a.status === 'APPROVED'),
    };
  }

  async getActiveLoan(customerId: string): Promise<ActiveLoanDto | null> {
    await this.assertCustomer(customerId);
    const loan = await this.prisma.loan.findFirst({
      where: { borrowerId: customerId, status: 'DISBURSED' },
      orderBy: { disbursementDate: 'desc' },
      select: { id: true, category: true, status: true, principal: true, tenure: true, disbursementDate: true },
    });
    if (!loan) return null;
    return toLoanSummary(loan, await loanFiguresMany(this.prisma, [loan]));
  }

  /** Totals over the customer's disbursed and repaid loans, from the ledger's rows (§0.5). */
  async getSummary(customerId: string): Promise<CustomerLoanSummaryDto> {
    await this.assertCustomer(customerId);
    const [
      loans,
      pendingLoans,
      approvedLoans,
      pendingTopups,
      approvedTopups,
      assetsInReview,
      nextDeduction,
      lastRepayment,
      rates,
    ] = await Promise.all([
      this.prisma.loan.findMany({
        where: { borrowerId: customerId, status: { in: ['DISBURSED', 'REPAID'] } },
        select: { id: true },
      }),
      this.prisma.loan.count({ where: { borrowerId: customerId, status: 'PENDING' } }),
      this.prisma.loan.count({ where: { borrowerId: customerId, status: 'APPROVED' } }),
      this.prisma.microLoan.count({ where: { purpose: 'TOPUP', status: 'PENDING', loan: { borrowerId: customerId } } }),
      this.prisma.microLoan.count({ where: { purpose: 'TOPUP', status: 'APPROVED', loan: { borrowerId: customerId } } }),
      this.prisma.commodityLoan.count({
        where: { status: 'IN_REVIEW', microLoanId: null, loan: { borrowerId: customerId, status: 'DISBURSED' } },
      }),
      // What payroll is asked for next: the running loan's OPEN deduction.
      this.prisma.deduction.findFirst({
        where: { status: 'OPEN', loan: { borrowerId: customerId, status: 'DISBURSED' } },
        orderBy: [{ period: { year: 'asc' } }, { period: { month: 'asc' } }],
        select: { expected: true, period: { select: { year: true, month: true } } },
      }),
      this.prisma.repayment.findFirst({
        where: { loan: { borrowerId: customerId } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, paymentInflow: { select: { period: { select: { year: true, month: true } } } } },
      }),
      repaymentRates(this.prisma, [customerId]),
    ]);

    const balances = [...(await loanBalancesMany(this.prisma, loans.map((loan) => loan.id))).values()];
    const total = (pick: (b: (typeof balances)[number]) => Prisma.Decimal) => sum(balances.map(pick));
    const principal = total((b) => b.booked.principal);
    const interest = total((b) => b.booked.interest);
    const managementFee = total((b) => b.managementFee);
    const running = balances.find((b) => b.status === 'DISBURSED');
    const openRequests = {
      loans: pendingLoans + approvedLoans,
      topups: pendingTopups + approvedTopups,
      assets: assetsInReview,
    };

    return {
      totalBorrowed: toNumber(principal),
      totalLoanAmount: toNumber(money(principal.plus(interest))),
      totalDisbursed: toNumber(money(principal.minus(managementFee))),
      managementFee: toNumber(managementFee),
      interestBooked: toNumber(interest),
      interestCollected: toNumber(total((b) => b.collected.interest)),
      penaltyCharged: toNumber(total((b) => b.booked.penalty)),
      penaltyCollected: toNumber(total((b) => b.collected.penalty)),
      totalRepaid: toNumber(total((b) => b.repaid)),
      outstanding: toNumber(total((b) => (b.status === 'DISBURSED' ? b.outstanding : ZERO))),
      monthlyDeduction: nextDeduction ? toNumber(nextDeduction.expected) : null,
      monthsLeft: running ? running.remainingMonths : null,
      nextDeductionPeriod: nextDeduction ? periodLabel(nextDeduction.period) : null,
      openRequests: { ...openRequests, total: openRequests.loans + openRequests.topups + openRequests.assets },
      repaymentRate: rates.get(customerId) ?? 100,
      lastRepaymentDate: lastRepayment?.createdAt ?? null,
      lastRepaymentPeriod: lastRepayment ? periodLabel(lastRepayment.paymentInflow.period) : null,
    };
  }

  /** Top-ups on the customer's loans, plus asset top-up requests not yet priced (or turned down). */
  async getTopups(customerId: string, query: CustomerTopupHistoryQueryDto) {
    await this.assertCustomer(customerId);
    const [topups, requests] = await Promise.all([
      this.prisma.microLoan.findMany({
        where: { purpose: 'TOPUP', loan: { borrowerId: customerId } },
        select: { ...TOPUP, loanId: true, commodity: { select: { id: true, commodity: { select: { name: true } } } } },
      }),
      this.prisma.commodityLoan.findMany({
        where: { microLoanId: null, loan: { borrowerId: customerId } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          loanId: true,
          commodity: { select: { name: true } },
          loan: { select: { category: true, status: true } },
        },
      }),
    ]);

    const rows: CustomerTopupHistoryItemDto[] = topups.map((row) => ({
      ...toTopup(row),
      recordType: 'TOPUP',
      loanId: row.loanId,
      asset: row.commodity ? { id: row.commodity.id, name: row.commodity.commodity.name } : null,
    }));
    for (const request of requests) {
      if (commodityKind({ status: request.status, microLoan: null }, request.loan) !== 'TOPUP') continue;
      rows.push({
        id: request.id,
        recordType: 'ASSET_REQUEST',
        loanId: request.loanId,
        amount: null,
        status: REQUEST_STATUS[request.status],
        requestedAt: request.createdAt,
        disbursedAt: null,
        asset: { id: request.id, name: request.commodity.name },
        tenureChange: null,
      });
    }

    const needle = query.search?.trim().toLowerCase();
    const filtered = rows
      .filter((row) => !query.status || row.status === query.status)
      .filter(
        (row) =>
          !needle ||
          [row.id, row.loanId, row.asset?.name].some((value) => value?.toLowerCase().includes(needle)),
      )
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    return slice(filtered, pageOf(query));
  }

  async getTenureChanges(customerId: string, query: CustomerTenureChangeQueryDto) {
    await this.assertCustomer(customerId);
    const { page, limit } = pageOf(query);
    const { rows, total } = await this.tenureChanges.list({
      borrowerId: customerId,
      status: query.status,
      skip: (page - 1) * limit,
      take: limit,
    });
    const data: CustomerTenureChangeDto[] = rows.map((row) => ({
      id: row.id,
      loanId: row.loanId,
      previousTenure: row.previousTenure,
      monthsDelta: row.monthsDelta,
      loanTenure: row.loan.tenure,
      reason: row.reason,
      status: row.status,
      topupId: row.microLoanId,
      requestedBy: row.requestedBy ? { id: row.requestedBy.userId, name: row.requestedBy.user.name } : null,
      createdAt: row.createdAt,
    }));
    return { data, meta: { total, page, limit } };
  }

  /**
   * The ledger statement over every disbursed loan of the customer. `from` defaults to the month
   * of the first disbursement and `to` to the current month (Lagos); lines are paged in memory,
   * the totals cover the whole range.
   */
  /** Money that came in for the customer (payroll rows and liquidations) and what it paid. */
  async getRepayments(customerId: string, query: CustomerRepaymentsQueryDto) {
    await this.assertCustomer(customerId);
    const range = parsePeriodRange(query);
    const { page, limit } = pageOf(query);
    const where: Prisma.PaymentInflowWhereInput = {
      customerId,
      ...(query.state && { state: query.state }),
      ...(query.source && { source: query.source }),
      ...((range.from || range.to) && { period: periodWhere(range) }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.paymentInflow.findMany({
        where,
        orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          source: true,
          state: true,
          amount: true,
          createdAt: true,
          period: { select: { year: true, month: true } },
          repayment: {
            select: {
              loanId: true,
              amount: true,
              breakdown: { select: { component: true, amount: true } },
              deduction: { select: { expected: true, status: true } },
            },
          },
        },
      }),
      this.prisma.paymentInflow.count({ where }),
    ]);
    const data: CustomerRepaymentDto[] = rows.map((row) => ({
      id: row.id,
      source: row.source,
      state: row.state,
      period: periodLabel(row.period),
      amount: toNumber(row.amount),
      applied: toNumber(row.repayment?.amount ?? 0),
      loanId: row.repayment?.loanId ?? null,
      split: row.repayment ? toSplit(row.repayment.breakdown) : null,
      expected: row.repayment?.deduction ? toNumber(row.repayment.deduction.expected) : null,
      deductionStatus: row.repayment?.deduction?.status ?? null,
      createdAt: row.createdAt,
    }));
    return { data, meta: { total, page, limit } };
  }

  // ---- actions ----

  /**
   * FLAGGED needs a reason (it becomes the flag reason); ACTIVE clears it; only a super admin
   * activates or deactivates. Deactivating signs the customer out everywhere.
   */
  async updateStatus(customerId: string, dto: UpdateCustomerStatusDto, admin: AuthUser): Promise<string> {
    const { status } = dto;
    const reason = dto.reason?.trim() || undefined;
    if (status === 'FLAGGED' && !reason) throw new BadRequestException(FLAG_REASON_REQUIRED);
    if (status !== 'FLAGGED' && admin.role !== 'SUPER_ADMIN') throw new ForbiddenException(ONLY_SUPER_ADMIN_STATUS);

    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      select: { user: { select: { name: true, status: true } } },
    });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);
    const previous = customer.user.status;

    await this.ledgerTx.transaction(async (tx) => {
      await tx.user.update({ where: { id: customerId }, data: { status } });
      if (status !== 'INACTIVE') {
        await tx.customer.update({
          where: { userId: customerId },
          data: { flagReason: status === 'FLAGGED' ? reason : null },
        });
      }
      await this.ledgerTx.audit(tx, {
        actorId: admin.userId,
        action: 'CUSTOMER_STATUS_CHANGED',
        entityType: 'USER',
        entityId: customerId,
        note: `${previous} → ${status}${reason ? `: ${reason}` : ''}`,
      });
    });

    if (status === 'INACTIVE') {
      // The AccessGuard already refuses an INACTIVE user, so a failure here is not fatal.
      try {
        await this.accounts.revokeSessions(customerId);
      } catch (error) {
        this.logger.error(`Could not sign out ${customerId}`, error instanceof Error ? error.stack : String(error));
        captureJobError(error, { job: 'revoke-sessions' });
      }
    }
    return `${customer.user.name}'s account is now ${status.toLowerCase()}`;
  }


  /** Moves a customer to another account officer, or back to the platform (`PLATFORM_ID`). Audited. */
  async assignAccountOfficer(customerId: string, dto: AssignAccountOfficerDto, admin: AuthUser): Promise<string> {
    const officerId = dto.accountOfficerId === PLATFORM_ID ? null : dto.accountOfficerId;

    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      select: { accountOfficerId: true, user: { select: { name: true } }, accountOfficer: { select: { user: { select: { name: true } } } } },
    });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);

    const officer = officerId
      ? await this.prisma.admin.findFirst({
          where: { userId: officerId, role: { not: 'SYSTEM' } },
          select: { user: { select: { name: true } } },
        })
      : null;
    if (officerId && !officer) throw new NotFoundException(OFFICER_NOT_FOUND);

    const from = customer.accountOfficer?.user.name ?? 'Platform';
    const to = officer?.user.name ?? 'Platform';
    if (customer.accountOfficerId === officerId) return `${customer.user.name} is already with ${to}`;

    await this.ledgerTx.transaction(async (tx) => {
      await tx.customer.update({ where: { userId: customerId }, data: { accountOfficerId: officerId } });
      await this.ledgerTx.audit(tx, {
        actorId: admin.userId,
        action: 'CUSTOMER_OFFICER_CHANGED',
        entityType: 'USER',
        entityId: customerId,
        note: `${from} → ${to}`,
      });
    });
    return `${customer.user.name} is now with ${to}`;
  }

  async messageUser(customerId: string, dto: SendMessageDto): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      select: { user: { select: { name: true } } },
    });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);
    await this.inapp.messageUser({ userId: customerId, title: dto.title, message: dto.message });
    return `Message sent to ${customer.user.name} as an in-app notification`;
  }

  /** Queues the admin's version of the report; it is emailed when ready. */
  /**
   * A top-up on the customer's running loan. Cash: a PENDING top-up through the ledger (with
   * the tenure change, if any), decided on /admin/loans/topups. Asset: a request in review,
   * priced on /admin/loans/commodity. A marketer only tops up customers they onboarded.
   */
  async loanTopup(
    customerId: string,
    dto: CustomerLoanTopupDto,
    admin: AuthUser,
  ): Promise<{ data: CustomerTopupRequestResultDto; message: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      select: { accountOfficerId: true, user: { select: { name: true, status: true } } },
    });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);
    const { name, status } = customer.user;
    if (admin.role === 'MARKETER' && customer.accountOfficerId !== admin.userId) {
      throw new ForbiddenException('You can only request top-ups for customers you onboarded');
    }
    if (status === 'FLAGGED') {
      throw new BadRequestException(`${name}'s account is flagged. Review it before requesting a top-up.`);
    }
    if (status === 'INACTIVE') {
      throw new BadRequestException(`${name}'s account is deactivated. Reactivate it before requesting a top-up.`);
    }

    const live = await this.prisma.loan.findFirst({
      where: { borrowerId: customerId, status: 'DISBURSED' },
      select: { id: true },
    });
    if (!live) throw new ConflictException(`${name} has no running loan to top up`);

    if (dto.category !== 'ASSET_PURCHASE') {
      if (!dto.cashLoan) throw new BadRequestException('Enter the top-up amount (cashLoan.amount)');
      if (dto.commodityLoan) throw new BadRequestException('A cash top-up takes cashLoan, not commodityLoan');
      if (dto.cashLoan.tenure !== undefined) {
        throw new BadRequestException("A top-up keeps the loan's tenure: send monthsDelta to change it");
      }
      const topup = await this.ledger.requestTopup({
        loanId: live.id,
        amount: dto.cashLoan.amount,
        requestedById: admin.userId,
        monthsDelta: dto.monthsDelta,
      });
      return {
        data: { kind: 'CASH', loanId: live.id, topupId: topup.id, commodityLoanId: null },
        message: `Top-up requested for ${name}. It is waiting for approval.`,
      };
    }

    if (!dto.commodityLoan) throw new BadRequestException('Choose the asset (commodityLoan.assetName)');
    if (dto.cashLoan) throw new BadRequestException('An asset top-up takes commodityLoan, not cashLoan');
    if (dto.monthsDelta !== undefined) {
      throw new BadRequestException('For an asset top-up, set monthsDelta when approving the asset request');
    }
    const assetName = titleCase(dto.commodityLoan.assetName);
    const commodity = await this.prisma.commodity.findFirst({
      where: { name: { equals: assetName, mode: 'insensitive' }, active: true },
      select: { id: true },
    });
    if (!commodity) {
      throw new BadRequestException(`${assetName} is not an available commodity. Choose one from the commodities list.`);
    }

    const request = await this.ledgerTx.transaction(async (tx) => {
      await this.ledgerTx.lockLoan(tx, live.id);
      const loan = await tx.loan.findUniqueOrThrow({ where: { id: live.id }, select: { status: true } });
      if (loan.status !== 'DISBURSED') throw new ConflictException(LOAN_NOT_ACTIVE);
      if ((await tx.commodityLoan.count({ where: { loanId: live.id, status: 'IN_REVIEW' } })) > 0) {
        throw new ConflictException(ASSET_REQUEST_IN_REVIEW);
      }
      const waiting = await tx.microLoan.count({
        where: { loanId: live.id, purpose: 'TOPUP', status: { in: ['PENDING', 'APPROVED'] } },
      });
      if (waiting > 0) throw new ConflictException(TOPUP_WAITING);
      return tx.commodityLoan.create({
        data: { loanId: live.id, commodityId: commodity.id, status: 'IN_REVIEW' },
        select: { id: true },
      });
    });
    return {
      data: { kind: 'ASSET', loanId: live.id, topupId: null, commodityLoanId: request.id },
      message: `Asset top-up requested for ${name}. It is waiting for review.`,
    };
  }

  async assertCustomer(customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({ where: { userId: customerId }, select: { userId: true } });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);
  }
}
