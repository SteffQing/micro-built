import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { isPlaceholderEmail, normalizeNgPhone, visibleEmail } from '@microbuilt/shared';
import { Prisma, type AdminRole, type DeductionStatus, type LoanCategory } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuthAccountsService } from 'src/auth/auth-accounts.service';
import { PLATFORM_ID } from 'src/common/constants';
import { captureJobError } from 'src/common/observability';
import type { AccessRole } from 'src/common/types';
import { generateId } from 'src/common/utils';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerTx, type Tx } from 'src/ledger/ledger.tx';
import { money } from 'src/ledger/money';
import { repaymentRates } from 'src/ledger/repayment-rate';
import { AdminNotifierService } from 'src/notifications/admin-notifier.service';
import { MailService } from 'src/notifications/mail.service';
import { findOrCreateOrganization } from 'src/organizations/organizations';
import { customerGroupStats } from './customer-stats';
import { SmsService } from 'src/notifications/sms.service';
import { SettingsService } from 'src/settings/settings.service';
import type { CustomersQueryDto, OnboardCustomer } from '../common/dto/customer.dto';
import type {
  AccountOfficerListItemDto,
  AccountOfficerStatsDto,
  CustomerListItemDto,
  CustomersOverviewDto,
  OnboardedCustomerDto,
} from '../common/entities/customers.entities';
import { buildCustomerWhere } from './customer-filters';

export const MARKETER_FLAG_REASON = 'Onboarded by a marketer: an admin must review the account and activate it';

type FirstLoan =
  | { kind: 'CASH'; category: LoanCategory; amount: number; tenure: number }
  | { kind: 'ASSET'; commodityId: string };

type RepaymentCounts =Pick<CustomersOverviewDto, 'defaultedCount' | 'flaggedCount' | 'ontimeCount'>;

/** Worst first: a customer with several deductions in a month counts by the worst of them. */
const DEDUCTION_RANK: Partial<Record<DeductionStatus, number>> = { FAILED: 3, PARTIAL: 2, FULFILLED: 1 };

const LIST_ROW = {
  userId: true,
  externalId: true,
  user: { select: { name: true, email: true, phoneNumber: true, status: true } },
} satisfies Prisma.CustomerSelect;

/** The officer id a route names; PLATFORM_ID means customers without one (self sign-ups). */
const officerOf = (id: string): string | null => (id === PLATFORM_ID ? null : id);

/** A password nobody has to type: emailed once to a customer with a real address. */
const newPassword = () => randomBytes(12).toString('base64url');

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly settings: SettingsService,
    private readonly accounts: AuthAccountsService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
    private readonly adminNotifier: AdminNotifierService,
  ) {}

  /**
   * The latest locked payroll month of any organization (a variation with a voucher or no payroll): each borrower
   * counted once, by their worst deduction that
   * month (FAILED > PARTIAL > FULFILLED). PARTIAL is a shortfall, so it counts as defaulted and,
   * as a subset, in flaggedCount.
   */
  async getRepaymentStatusCounts(): Promise<RepaymentCounts> {
    const counts: RepaymentCounts = { defaultedCount: 0, flaggedCount: 0, ontimeCount: 0 };
    // Each organization's latest locked variation (PLAN_V2 R8): organizations lock their months independently.
    const locked = await this.prisma.variation.findMany({
      where: { OR: [{ voucher: { isNot: null } }, { noPayrollReason: { not: null } }] },
      orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
      select: { id: true, organizationId: true },
    });
    const latest = new Map<string, string>();
    for (const { id, organizationId } of locked) if (!latest.has(organizationId)) latest.set(organizationId, id);
    if (latest.size === 0) return counts;

    const deductions = await this.prisma.deduction.findMany({
      where: { variationId: { in: [...latest.values()] }, status: { in: ['FAILED', 'PARTIAL', 'FULFILLED'] } },
      select: { status: true, loan: { select: { borrowerId: true } } },
    });
    const worst = new Map<string, DeductionStatus>();
    for (const { status, loan } of deductions) {
      const current = worst.get(loan.borrowerId);
      if (!current || (DEDUCTION_RANK[status] ?? 0) > (DEDUCTION_RANK[current] ?? 0)) {
        worst.set(loan.borrowerId, status);
      }
    }
    for (const status of worst.values()) {
      if (status === 'FAILED') counts.defaultedCount++;
      else if (status === 'PARTIAL') {
        counts.defaultedCount++;
        counts.flaggedCount++;
      } else counts.ontimeCount++;
    }
    return counts;
  }

  async getOverview(): Promise<CustomersOverviewDto> {
    const [activeCustomersCount, flaggedCustomersCount, customersWithActiveLoansCount, repayments] =
      await Promise.all([
        this.prisma.customer.count({ where: { user: { status: 'ACTIVE' } } }),
        this.prisma.customer.count({ where: { user: { status: 'FLAGGED' } } }),
        this.prisma.customer.count({ where: { loans: { some: { status: 'DISBURSED' } } } }),
        this.getRepaymentStatusCounts(),
      ]);
    return { activeCustomersCount, flaggedCustomersCount, customersWithActiveLoansCount, ...repayments };
  }

  async getCustomers(filters: CustomersQueryDto) {
    const { page = 1, limit = 20 } = filters;
    const where = await buildCustomerWhere(this.prisma, filters);
    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ user: { name: 'asc' } }, { userId: 'asc' }],
        select: LIST_ROW,
      }),
      this.prisma.customer.count({ where }),
    ]);
    const rates = await repaymentRates(
      this.prisma,
      rows.map((row) => row.userId),
    );
    const data: CustomerListItemDto[] = rows.map((row) => ({
      id: row.userId,
      name: row.user.name,
      email: visibleEmail(row.user.email),
      phoneNumber: row.user.phoneNumber,
      externalId: row.externalId,
      status: row.user.status,
      repaymentRate: rates.get(row.userId) ?? 100,
    }));
    return { data, meta: { total, page, limit } };
  }

  /** An account officer's customers, with every list filter (the officer is fixed by the route). */
  getAccountOfficerCustomers(officerId: string, filters: CustomersQueryDto) {
    return this.getCustomers({ ...filters, accountOfficerId: officerId });
  }

  /** Every admin but the system actor (removed ones too: they keep their customers), plus self sign-ups. */
  async getAccountOfficers(): Promise<AccountOfficerListItemDto[]> {
    const [officers, selfSignedCount] = await Promise.all([
      this.prisma.admin.findMany({
        where: { role: { not: 'SYSTEM' } },
        orderBy: { user: { name: 'asc' } },
        select: {
          userId: true,
          role: true,
          user: { select: { name: true, status: true } },
          _count: { select: { officerCustomers: true } },
        },
      }),
      this.prisma.customer.count({ where: { accountOfficerId: null } }),
    ]);
    return [
      {
        id: PLATFORM_ID,
        name: 'Platform (Self-Signed)',
        role: 'SYSTEM',
        status: null,
        customersCount: selfSignedCount,
        isSystem: true,
      },
      ...officers.map((officer) => ({
        id: officer.userId,
        name: officer.user.name,
        role: officer.role,
        status: officer.user.status,
        customersCount: officer._count.officerCustomers,
        isSystem: false,
      })),
    ];
  }

  /** The officer's customers by status, and the ledger figures of their loans that were disbursed. */
  getAccountOfficerStats(id: string): Promise<AccountOfficerStatsDto> {
    return customerGroupStats(this.prisma, { accountOfficerId: officerOf(id) });
  }

  /**
   * One transaction: the account (password sign-in), the customer with its identity, bank
   * details and payroll, and the optional first loan — an admin's cash loan is approved at once with
   * Settings' rates (awaiting disbursement), a marketer's waits for an admin to approve it like any
   * request; an asset goes to review. A marketer's customer starts FLAGGED until an admin activates
   * them. An organization named for the first time is created, waiting for a super admin unless one
   * named it. The welcome message goes out after commit.
   */
  async addCustomer(
    dto: OnboardCustomer,
    adminId: string,
    adminRole: AccessRole,
  ): Promise<{ data: OnboardedCustomerDto; message: string }> {
    const email = dto.user.email?.trim().toLowerCase() || null;
    const rawPhone = dto.user.phoneNumber?.trim() || null;
    const phoneNumber = rawPhone ? normalizeNgPhone(rawPhone) : null;
    if (rawPhone && !phoneNumber) throw new BadRequestException('Enter a valid Nigerian phone number');
    if (!email && !phoneNumber) throw new BadRequestException("Enter the customer's email or phone number");
    if (email && isPlaceholderEmail(email)) throw new BadRequestException('Enter a real email address');

    const loan = await this.firstLoan(dto);
    const rates = loan ? await this.settings.requireRates() : null;
    await this.assertNotRegistered(dto, email, phoneNumber);

    const userId = generateId.userId();
    const password = newPassword();
    const isMarketer = adminRole === 'MARKETER';
    const { externalId, ...payroll } = dto.payroll;

    let created: OnboardedCustomerDto;
    let newPending: { id: string; name: string; requestedById: string | null } | null = null;
    try {
      created = await this.ledgerTx.transaction(async (tx) => {
        await this.accounts.createWithPassword(tx, {
          id: userId,
          type: 'CUSTOMER',
          name: dto.user.name.trim(),
          email,
          phoneNumber,
          phoneNumberVerified: true,
          emailVerified: false,
          status: isMarketer ? 'FLAGGED' : 'ACTIVE',
          password,
        });
        await tx.customer.create({
          data: {
            userId,
            externalId,
            accountOfficerId: adminId,
            flagReason: isMarketer ? MARKETER_FLAG_REASON : null,
            identity: { create: { ...dto.identity, dateOfBirth: new Date(dto.identity.dateOfBirth) } },
            paymentMethod: { create: dto.paymentMethod },
          },
        });
        const { organization, ...details } = payroll;
        const named = await findOrCreateOrganization(tx, organization, { id: adminId, role: adminRole as AdminRole });
        if (named.created && named.status === 'PENDING') newPending = named;
        await tx.customerPayroll.create({ data: { externalId, ...details, organizationId: named.id } });
        await this.ledgerTx.audit(tx, {
          actorId: adminId,
          action: 'CUSTOMER_ONBOARDED',
          entityType: 'USER',
          entityId: userId,
          // A marketer's cash loan is only requested: the tenure they asked for is kept here for the approving admin.
          note: !loan
            ? undefined
            : loan.kind === 'ASSET'
              ? 'With a first asset loan'
              : `With a first cash loan${isMarketer ? ` (${loan.tenure} months requested)` : ''}`,
        });

        if (!loan || !rates) return { userId, loanId: null, commodityLoanId: null };
        return this.createFirstLoan(tx, userId, adminId, loan, rates, isMarketer);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(duplicateMessage(error.meta?.target));
      }
      throw error;
    }

    await this.welcome({ name: dto.user.name.trim(), email, phoneNumber, password });
    const pending = newPending as { id: string; name: string; requestedById: string | null } | null;
    if (pending) {
      void this.adminNotifier.organizationAwaitingApproval(pending).catch((error: unknown) => {
        this.logger.error('Notifying about a new organization failed', error instanceof Error ? error.stack : error);
        captureJobError(error, { job: 'customers.onboard.organization-notify' });
      });
    }

    const loanNote = !loan
      ? ''
      : loan.kind === 'ASSET'
        ? ' Their asset request is waiting for review.'
        : isMarketer
          ? ' Their cash loan is waiting for an admin to approve it.'
          : ' Their cash loan is approved and awaiting disbursement.';
    const flagNote = isMarketer ? ' The account is flagged until an admin activates it.' : '';
    const organizationNote = pending ? ` ${pending.name} is new and waits for a super admin to approve it.` : '';
    return {
      data: created,
      message: `${dto.user.name.trim()} has been onboarded.${loanNote}${flagNote}${organizationNote}`,
    };
  }

  /** The first loan the form asks for, checked; an asset must be an active commodity. */
  private async firstLoan(dto: OnboardCustomer): Promise<FirstLoan | null> {
    if (!dto.loan) return null;
    const { category, cashLoan, commodityLoan } = dto.loan;
    if (category !== 'ASSET_PURCHASE') {
      if (!cashLoan) throw new BadRequestException('Enter the amount and tenure of this loan (cashLoan)');
      if (commodityLoan) throw new BadRequestException('A cash loan takes cashLoan, not commodityLoan');
      if (cashLoan.tenure === undefined) throw new BadRequestException('Enter the tenure (months) of this loan');
      return { kind: 'CASH', category, amount: cashLoan.amount, tenure: cashLoan.tenure };
    }

    if (!commodityLoan) throw new BadRequestException('Choose the asset for this loan (commodityLoan.assetName)');
    if (cashLoan) throw new BadRequestException('An asset loan takes commodityLoan, not cashLoan');
    const name = commodityLoan.assetName.trim();
    const commodity = await this.prisma.commodity.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, active: true },
      select: { id: true },
    });
    if (!commodity) {
      throw new BadRequestException(`${name} is not an available commodity. Choose one from the commodities list.`);
    }
    return { kind: 'ASSET', commodityId: commodity.id };
  }

  /** Clear messages up front; the unique indexes still catch a race (P2002 in addCustomer). */
  private async assertNotRegistered(dto: OnboardCustomer, email: string | null, phoneNumber: string | null) {
    const { accountNumber, bvn } = dto.paymentMethod;
    const [user, customer, payment] = await Promise.all([
      email || phoneNumber
        ? this.prisma.user.findFirst({
            where: { OR: [...(email ? [{ email }] : []), ...(phoneNumber ? [{ phoneNumber }] : [])] },
            select: { email: true, phoneNumber: true },
          })
        : null,
      this.prisma.customer.findUnique({ where: { externalId: dto.payroll.externalId }, select: { userId: true } }),
      this.prisma.customerPaymentMethod.findFirst({
        where: { OR: [{ accountNumber }, { bvn }] },
        select: { accountNumber: true },
      }),
    ]);
    if (user) {
      throw new ConflictException(
        email && user.email === email
          ? 'A user with this email already exists'
          : 'A user with this phone number already exists',
      );
    }
    if (customer) throw new ConflictException('A customer with this IPPIS number already exists');
    if (payment) {
      throw new ConflictException(
        payment.accountNumber === accountNumber
          ? 'A customer with this account number already exists'
          : 'A customer with this BVN already exists',
      );
    }
  }

  private async createFirstLoan(
    tx: Tx,
    borrowerId: string,
    adminId: string,
    loan: FirstLoan,
    rates: { interestRate: Prisma.Decimal; managementFeeRate: Prisma.Decimal },
    byMarketer: boolean,
  ): Promise<OnboardedCustomerDto> {
    const loanId = generateId.loanId();
    if (loan.kind === 'CASH' && byMarketer) {
      // A marketer only requests it: an admin approves it (and sets the tenure) like any loan request.
      await tx.loan.create({
        data: {
          id: loanId,
          borrowerId,
          category: loan.category,
          status: 'PENDING',
          principal: money(loan.amount),
          tenure: 0,
          requestedById: adminId,
          ...rates,
        },
      });
      return { userId: borrowerId, loanId, commodityLoanId: null };
    }
    if (loan.kind === 'CASH') {
      // An admin requests and approves it in one go: it goes straight to APPROVED.
      await tx.loan.create({
        data: {
          id: loanId,
          borrowerId,
          category: loan.category,
          status: 'APPROVED',
          principal: money(loan.amount),
          tenure: loan.tenure,
          requestedById: adminId,
          ...rates,
        },
      });
      await this.ledgerTx.audit(tx, {
        actorId: adminId,
        action: 'LOAN_APPROVED',
        entityType: 'LOAN',
        entityId: loanId,
        note: `Approved at onboarding, tenure ${loan.tenure} month(s)`,
      });
      return { userId: borrowerId, loanId, commodityLoanId: null };
    }

    // Amount and tenure are set when the asset request is approved (PATCH /admin/loans/commodity/:id/approve).
    await tx.loan.create({
      data: {
        id: loanId,
        borrowerId,
        category: 'ASSET_PURCHASE',
        status: 'PENDING',
        principal: 0,
        tenure: 0,
        requestedById: adminId,
        ...rates,
      },
    });
    const request = await tx.commodityLoan.create({
      data: { loanId, commodityId: loan.commodityId, status: 'IN_REVIEW' },
      select: { id: true },
    });
    return { userId: borrowerId, loanId, commodityLoanId: request.id };
  }

  /**
   * A real address gets the password by email (as v1). A phone-only customer gets an SMS with
   * no password: they sign in with codes. A failed send is reported, never thrown: the account exists.
   */
  private async welcome(to: { name: string; email: string | null; phoneNumber: string | null; password: string }) {
    try {
      if (to.email) {
        await this.mail.sendOnboardedCustomerInvite(to.email, to.name, to.password, to.phoneNumber ?? undefined);
      } else if (to.phoneNumber) {
        const site = (process.env.FRONTEND_URL ?? 'https://microbuiltprime.com').replace(/\/+$/, '');
        await this.sms.send(
          to.phoneNumber,
          `Your MicroBuilt account is ready. Sign in at ${site} with your phone number; we'll text you a code.`,
        );
      }
    } catch (error) {
      this.logger.error('Welcome message to an onboarded customer failed', error instanceof Error ? error.stack : error);
      captureJobError(error, { job: 'onboard-customer-welcome' });
    }
  }
}

/** Which unique index a P2002 hit, as a sentence. */
export function duplicateMessage(target: unknown): string {
  const fields = Array.isArray(target) ? target.join(',') : String(target ?? '');
  if (/phone/i.test(fields)) return 'A user with this phone number already exists';
  if (/email/i.test(fields)) return 'A user with this email already exists';
  if (/externalId/i.test(fields)) return 'A customer with this IPPIS number already exists';
  if (/accountNumber/i.test(fields)) return 'A customer with this account number already exists';
  if (/bvn/i.test(fields)) return 'A customer with this BVN already exists';
  return 'This customer is already registered';
}
