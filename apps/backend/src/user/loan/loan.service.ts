import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type LoanCategory, type LoanStatus } from '@prisma/client';
import { titleCase } from 'src/commodities/commodities.service';
import { loanFiguresMany, toLoanFigures, type LoanFiguresDto } from 'src/common/dto/loan.dto';
import { generateId } from 'src/common/utils';
import { PrismaService } from 'src/database/prisma.service';
import { LOAN_NOT_ACTIVE } from 'src/ledger/ledger.constants';
import { LedgerService } from 'src/ledger/ledger.service';
import { LedgerTx, type Tx } from 'src/ledger/ledger.tx';
import { money, toNumber, ZERO } from 'src/ledger/money';
import { SettingsService } from 'src/settings/settings.service';
import type { CreateLoanDto, LoanHistoryRequestDto, UpdateLoanDto } from '../common/dto/loan.dto';
import type {
  UserCommodityRequestDto,
  UserLoanDetailDto,
  UserLoanItemDto,
  UserLoanRequestItemDto,
  UserLoanRequestResultDto,
  UserLoansOverviewDto,
  UserLoanTopupDto,
} from '../common/entities/loan.entities';

export const NOT_A_CUSTOMER = 'Only customer accounts can request loans';
export const ACCOUNT_RESTRICTED = 'Your account is currently restricted. Please contact support.';
export const LOAN_IN_PROGRESS = 'You already have a loan request in progress';
export const CATEGORY_REQUIRED = 'Choose a loan category';
export const COMMODITY_UNAVAILABLE = 'Only commodities in stock can be requested.';
export const ASSET_REQUEST_IN_REVIEW = 'You already have an asset request in review';
export const TOPUP_WAITING = 'This loan already has a top-up waiting for a decision';
export const LOAN_NOT_FOUND = 'Loan with the provided ID could not be found. Please check and try again';
export const ONLY_PENDING = 'Only loan requests still pending can be changed or deleted';
export const ASSET_LOAN_NOT_EDITABLE = 'An asset request can’t be edited. Delete it and request again.';
export const NOTHING_TO_UPDATE = 'Nothing to update';
export const COMMODITY_REQUEST_NOT_FOUND =
  'Commodity loan with the provided ID could not be found. Please check and try again';

/** A customer has at most one of these at a time (the Loan_one_active_per_borrower index). */
const LIVE_STATUSES: LoanStatus[] = ['PENDING', 'APPROVED', 'DISBURSED'];

const LOAN = {
  id: true,
  category: true,
  status: true,
  principal: true,
  tenure: true,
  disbursementDate: true,
  createdAt: true,
  updatedAt: true,
  // An asset loan is named after the request that opened it: its first one.
  commodities: { orderBy: { createdAt: 'asc' }, take: 1, select: { commodity: { select: { name: true } } } },
} satisfies Prisma.LoanSelect;

const TOPUP = {
  id: true,
  loanId: true,
  amount: true,
  status: true,
  createdAt: true,
  disbursedAt: true,
  tenureChange: { select: { monthsDelta: true, status: true } },
} satisfies Prisma.MicroLoanSelect;

// Never privateDetails: that is the admins' note.
const COMMODITY_REQUEST = {
  id: true,
  loanId: true,
  status: true,
  publicDetails: true,
  createdAt: true,
  commodity: { select: { name: true } },
  microLoan: { select: { amount: true, purpose: true } },
  loan: { select: { category: true, status: true, principal: true } },
} satisfies Prisma.CommodityLoanSelect;

type LoanRow = Prisma.LoanGetPayload<{ select: typeof LOAN }>;
type TopupRow = Prisma.MicroLoanGetPayload<{ select: typeof TOPUP }>;
type CommodityRequestRow = Prisma.CommodityLoanGetPayload<{ select: typeof COMMODITY_REQUEST }>;

function page(query: { page?: number; limit?: number }) {
  const pageNo = query.page ?? 1;
  const limit = query.limit ?? 20;
  return { page: pageNo, limit, skip: (pageNo - 1) * limit };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// The customer's loan requests and loans. Requests follow V2.MD §0.6: with a disbursed loan a
// request becomes a top-up (cash: a PENDING TOPUP microloan through the ledger; asset: an asset
// request on that loan); while a request is pending or approved nothing new can be asked for;
// otherwise a new PENDING loan. Nothing here moves money: admins approve and disburse.
@Injectable()
export class LoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly ledgerTx: LedgerTx,
    private readonly settings: SettingsService,
  ) {}

  async requestCashLoan(customerId: string, dto: CreateLoanDto): Promise<UserLoanRequestResultDto> {
    await this.assertCanRequest(customerId);
    const live = await this.liveLoan(customerId);
    if (live?.status === 'DISBURSED') {
      // The ledger locks the loan and 409s while another top-up is waiting.
      const topup = await this.ledger.requestTopup({ loanId: live.id, amount: dto.amount });
      return { kind: 'TOPUP', id: topup.id, loanId: live.id };
    }
    if (live) throw new ConflictException(LOAN_IN_PROGRESS);
    if (!dto.category) throw new BadRequestException(CATEGORY_REQUIRED);

    const id = generateId.loanId();
    await this.createLoan(this.prisma, { id, borrowerId: customerId, category: dto.category, principal: dto.amount });
    return { kind: 'LOAN', id, loanId: id };
  }

  async requestCommodityLoan(customerId: string, assetName: string): Promise<UserLoanRequestResultDto> {
    await this.assertCanRequest(customerId);
    const commodity = await this.prisma.commodity.findFirst({
      where: { name: { equals: titleCase(assetName), mode: 'insensitive' }, active: true },
      select: { id: true },
    });
    if (!commodity) throw new BadRequestException(COMMODITY_UNAVAILABLE);

    const live = await this.liveLoan(customerId);
    if (live?.status === 'DISBURSED') {
      // An asset top-up: an admin prices and approves it later (it then becomes a TOPUP microloan).
      const request = await this.ledgerTx.transaction(async (tx) => {
        await this.ledgerTx.lockLoan(tx, live.id);
        const loan = await tx.loan.findUniqueOrThrow({ where: { id: live.id }, select: { status: true } });
        if (loan.status !== 'DISBURSED') throw new ConflictException(LOAN_NOT_ACTIVE);
        const inReview = await tx.commodityLoan.count({ where: { loanId: live.id, status: 'IN_REVIEW' } });
        if (inReview > 0) throw new ConflictException(ASSET_REQUEST_IN_REVIEW);
        const topups = await tx.microLoan.count({
          where: { loanId: live.id, purpose: 'TOPUP', status: { in: ['PENDING', 'APPROVED'] } },
        });
        if (topups > 0) throw new ConflictException(TOPUP_WAITING);
        return tx.commodityLoan.create({
          data: { loanId: live.id, commodityId: commodity.id, status: 'IN_REVIEW' },
          select: { id: true },
        });
      });
      return { kind: 'TOPUP', id: request.id, loanId: live.id };
    }
    if (live) throw new ConflictException(LOAN_IN_PROGRESS);

    // A new asset loan: priced (principal, tenure) by the admin who approves the request.
    const id = generateId.loanId();
    const request = await this.prisma.$transaction(async (tx) => {
      await this.createLoan(tx, { id, borrowerId: customerId, category: 'ASSET_PURCHASE', principal: ZERO });
      return tx.commodityLoan.create({
        data: { loanId: id, commodityId: commodity.id, status: 'IN_REVIEW' },
        select: { id: true },
      });
    });
    return { kind: 'LOAN', id: request.id, loanId: id };
  }

  async updateLoan(customerId: string, loanId: string, dto: UpdateLoanDto): Promise<void> {
    const loan = await this.ownLoan(customerId, loanId);
    if (loan.status !== 'PENDING') throw new ConflictException(ONLY_PENDING);
    if (loan.category === 'ASSET_PURCHASE') throw new ConflictException(ASSET_LOAN_NOT_EDITABLE);

    const data: Prisma.LoanUpdateManyMutationInput = {
      ...(dto.amount !== undefined && { principal: money(dto.amount) }),
      ...(dto.category && { category: dto.category }),
    };
    if (Object.keys(data).length === 0) throw new BadRequestException(NOTHING_TO_UPDATE);

    // Compare-and-swap: an admin may have approved it since it was read.
    const { count } = await this.prisma.loan.updateMany({
      where: { id: loanId, borrowerId: customerId, status: 'PENDING' },
      data,
    });
    if (count === 0) throw new ConflictException(ONLY_PENDING);
  }

  async deleteLoan(customerId: string, loanId: string): Promise<void> {
    const loan = await this.ownLoan(customerId, loanId);
    if (loan.status !== 'PENDING') throw new ConflictException(ONLY_PENDING);

    await this.prisma.$transaction(async (tx) => {
      await tx.commodityLoan.deleteMany({ where: { loanId, status: 'IN_REVIEW' } });
      const { count } = await tx.loan.deleteMany({ where: { id: loanId, borrowerId: customerId, status: 'PENDING' } });
      if (count === 0) throw new ConflictException(ONLY_PENDING);
    });
  }

  // ---- reads ----

  async getOverview(customerId: string): Promise<UserLoansOverviewDto> {
    const mine = { loan: { borrowerId: customerId } };
    const newestFirst = { createdAt: 'desc' } as const;
    const [pending, topups, commodities, groups] = await Promise.all([
      this.prisma.loan.findMany({
        where: { borrowerId: customerId, status: { in: ['PENDING', 'APPROVED'] } },
        orderBy: newestFirst,
        select: { id: true, principal: true, category: true, status: true, createdAt: true },
      }),
      this.prisma.microLoan.findMany({
        where: { ...mine, purpose: 'TOPUP', status: { in: ['PENDING', 'APPROVED'] } },
        orderBy: newestFirst,
        select: TOPUP,
      }),
      this.prisma.commodityLoan.findMany({
        where: { ...mine, status: 'IN_REVIEW' },
        orderBy: newestFirst,
        select: COMMODITY_REQUEST,
      }),
      this.prisma.loan.groupBy({ by: ['status'], where: { borrowerId: customerId }, _count: { _all: true } }),
    ]);

    const counts = Object.fromEntries(groups.map((group) => [group.status, group._count._all])) as Partial<
      Record<LoanStatus, number>
    >;
    return {
      pendingLoans: pending.map((loan) => ({
        id: loan.id,
        amount: toNumber(loan.principal),
        category: loan.category,
        status: loan.status,
        date: loan.createdAt,
      })),
      pendingTopups: topups.map((row) => ({ ...toTopup(row), loanId: row.loanId })),
      commoditiesInReview: commodities.map(toCommodityRequest),
      rejectedCount: counts.REJECTED ?? 0,
      approvedCount: counts.APPROVED ?? 0,
      disbursedCount: counts.DISBURSED ?? 0,
      repaidCount: counts.REPAID ?? 0,
    };
  }

  async getLoans(customerId: string, query: LoanHistoryRequestDto) {
    const { page: pageNo, limit, skip } = page(query);
    const where: Prisma.LoanWhereInput = { borrowerId: customerId, ...(query.status && { status: query.status }) };
    const [rows, total] = await Promise.all([
      this.prisma.loan.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, select: LOAN }),
      this.prisma.loan.count({ where }),
    ]);
    const figures = await loanFiguresMany(this.prisma, rows);
    const data: UserLoanItemDto[] = rows.map((row) => toLoanItem(row, figures.get(row.id)));
    return { data, meta: { total, page: pageNo, limit } };
  }

  async getLoan(customerId: string, loanId: string): Promise<UserLoanDetailDto> {
    const [row, topups, commodities] = await Promise.all([
      this.prisma.loan.findFirst({ where: { id: loanId, borrowerId: customerId }, select: LOAN }),
      this.prisma.microLoan.findMany({
        where: { loanId, loan: { borrowerId: customerId }, purpose: 'TOPUP' },
        orderBy: { createdAt: 'desc' },
        select: TOPUP,
      }),
      this.prisma.commodityLoan.findMany({
        where: { loanId, loan: { borrowerId: customerId } },
        orderBy: { createdAt: 'desc' },
        select: COMMODITY_REQUEST,
      }),
    ]);
    if (!row) throw new NotFoundException(LOAN_NOT_FOUND);

    const figures = await loanFiguresMany(this.prisma, [row]);
    return {
      ...toLoanItem(row, figures.get(row.id)),
      updatedAt: row.updatedAt,
      topups: topups.map(toTopup),
      commodities: commodities.map(toCommodityRequest),
    };
  }

  /**
   * Every request the customer made, newest first: loans, cash top-ups and asset requests (an
   * asset top-up shows once, as its asset request). Customers have a handful, so it pages in memory.
   */
  async getAllRequests(customerId: string, query: { page?: number; limit?: number }) {
    const { page: pageNo, limit, skip } = page(query);
    const mine = { loan: { borrowerId: customerId } };
    const [loans, topups, commodities] = await Promise.all([
      this.prisma.loan.findMany({
        where: { borrowerId: customerId },
        select: {
          id: true,
          principal: true,
          category: true,
          status: true,
          createdAt: true,
          microLoans: { where: { purpose: 'NEW_LOAN' }, select: { amount: true } },
        },
      }),
      this.prisma.microLoan.findMany({
        where: { ...mine, purpose: 'TOPUP', commodity: { is: null } },
        select: { id: true, loanId: true, amount: true, status: true, createdAt: true, loan: { select: { category: true } } },
      }),
      this.prisma.commodityLoan.findMany({ where: mine, select: COMMODITY_REQUEST }),
    ]);

    const items: UserLoanRequestItemDto[] = [
      ...loans.map((loan) => {
        // The amount asked for: what was disbursed as the loan itself (principal grows with top-ups).
        const amount = loan.microLoans[0]?.amount ?? loan.principal;
        return {
          id: loan.id,
          kind: 'LOAN' as const,
          loanId: loan.id,
          amount: amount.gt(0) ? toNumber(amount) : null,
          category: loan.category,
          status: loan.status,
          name: null,
          date: loan.createdAt,
        };
      }),
      ...topups.map((topup) => ({
        id: topup.id,
        kind: 'TOPUP' as const,
        loanId: topup.loanId,
        amount: toNumber(topup.amount),
        category: topup.loan.category,
        status: topup.status,
        name: null,
        date: topup.createdAt,
      })),
      ...commodities.map((row) => {
        const request = toCommodityRequest(row);
        return {
          id: request.id,
          kind: 'COMMODITY' as const,
          loanId: request.loanId,
          amount: request.amount,
          category: row.loan.category,
          status: request.status,
          name: request.name,
          date: request.date,
        };
      }),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return { data: items.slice(skip, skip + limit), meta: { total: items.length, page: pageNo, limit } };
  }

  async getCommodityRequests(customerId: string, query: { page?: number; limit?: number }) {
    const { page: pageNo, limit, skip } = page(query);
    const where: Prisma.CommodityLoanWhereInput = { loan: { borrowerId: customerId } };
    const [rows, total] = await Promise.all([
      this.prisma.commodityLoan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: COMMODITY_REQUEST,
      }),
      this.prisma.commodityLoan.count({ where }),
    ]);
    return { data: rows.map(toCommodityRequest), meta: { total, page: pageNo, limit } };
  }

  async getCommodityRequest(customerId: string, id: string): Promise<UserCommodityRequestDto> {
    const row = await this.prisma.commodityLoan.findFirst({
      where: { id, loan: { borrowerId: customerId } },
      select: COMMODITY_REQUEST,
    });
    if (!row) throw new NotFoundException(COMMODITY_REQUEST_NOT_FOUND);
    return toCommodityRequest(row);
  }

  // ---- helpers ----

  /** Only customers whose account isn't under review may ask for money (as in v1). */
  private async assertCanRequest(customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      select: { user: { select: { status: true } } },
    });
    if (!customer) throw new ForbiddenException(NOT_A_CUSTOMER);
    if (customer.user.status === 'FLAGGED') throw new BadRequestException(ACCOUNT_RESTRICTED);
  }

  private liveLoan(customerId: string) {
    return this.prisma.loan.findFirst({
      where: { borrowerId: customerId, status: { in: LIVE_STATUSES } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });
  }

  private async ownLoan(customerId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, borrowerId: customerId },
      select: { status: true, category: true },
    });
    if (!loan) throw new NotFoundException(LOAN_NOT_FOUND);
    return loan;
  }

  /**
   * A PENDING loan. Its rates are placeholders (the current Settings, or 0 while unset): the
   * admin who approves it snapshots the rates it is disbursed at. Tenure is set at approval too.
   * A concurrent request trips the one-live-loan index (P2002) → the same 409.
   */
  private async createLoan(
    db: Tx,
    input: { id: string; borrowerId: string; category: LoanCategory; principal: Prisma.Decimal.Value },
  ): Promise<void> {
    const { interestRate, managementFeeRate } = await this.settings.get();
    try {
      await db.loan.create({
        data: {
          id: input.id,
          borrowerId: input.borrowerId,
          category: input.category,
          status: 'PENDING',
          principal: money(input.principal),
          tenure: 0,
          interestRate: interestRate ?? ZERO,
          managementFeeRate: managementFeeRate ?? ZERO,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(LOAN_IN_PROGRESS);
      throw error;
    }
  }
}

function toLoanItem(row: LoanRow, figures: LoanFiguresDto | undefined): UserLoanItemDto {
  return {
    ...(figures ?? toLoanFigures(row, undefined, null)),
    id: row.id,
    category: row.category,
    status: row.status,
    assetName: row.category === 'ASSET_PURCHASE' ? (row.commodities[0]?.commodity.name ?? null) : null,
    disbursementDate: row.disbursementDate,
    createdAt: row.createdAt,
  };
}

function toTopup(row: TopupRow): UserLoanTopupDto {
  return {
    id: row.id,
    amount: toNumber(row.amount),
    status: row.status,
    requestedAt: row.createdAt,
    disbursedAt: row.disbursedAt,
    tenureChange: row.tenureChange,
  };
}

/**
 * Paid by a TOPUP microloan, or made on a loan that was already running → a top-up; otherwise
 * the request that opened its asset loan. The amount is known once an admin approves it.
 */
function toCommodityRequest(row: CommodityRequestRow): UserCommodityRequestDto {
  const opening = row.loan.category === 'ASSET_PURCHASE' && ['PENDING', 'APPROVED', 'REJECTED'].includes(row.loan.status);
  const kind = row.microLoan ? (row.microLoan.purpose === 'TOPUP' ? 'TOPUP' : 'NEW_LOAN') : opening ? 'NEW_LOAN' : 'TOPUP';
  const priced = kind === 'NEW_LOAN' && row.status === 'APPROVED' && row.loan.principal.gt(0) ? row.loan.principal : null;
  const amount = row.microLoan?.amount ?? priced;
  return {
    id: row.id,
    loanId: row.loanId,
    name: row.commodity.name,
    status: row.status,
    kind,
    amount: amount ? toNumber(amount) : null,
    details: row.publicDetails,
    date: row.createdAt,
  };
}
