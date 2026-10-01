import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, UserStatus } from '@prisma/client';
import { loanFiguresMany, toLoanFigures } from 'src/common/dto/loan.dto';
import { PrismaService } from 'src/database/prisma.service';
import { loanBalancesMany, openExpectedMany } from 'src/ledger/balances';
import { ALREADY_DECIDED } from 'src/ledger/ledger.constants';
import { LedgerService } from 'src/ledger/ledger.service';
import { LedgerTx, type Tx } from 'src/ledger/ledger.tx';
import { money, toNumber } from 'src/ledger/money';
import { SettingsService } from 'src/settings/settings.service';
import type {
  AcceptCommodityLoanDto,
  CashLoanQueryDto,
  CommodityLoanQueryDto,
  LoanRejectionDto,
  LoanTermsDto,
} from '../common/dto/loan.dto';
import type {
  CashLoanDto,
  CashLoanItemDto,
  CommodityLoanDto,
  CommodityLoanItemDto,
} from '../common/entities/loan.entities';
import { buildCashLoanWhere, buildCommodityLoanWhere } from './loan-filters';
import {
  BORROWER,
  CUSTOMER_REF,
  TOPUP,
  commodityKind,
  percent,
  toBorrower,
  toCustomerRef,
  toLoanSummary,
  toTopup,
} from './loan.reads';

export const LOAN_NOT_FOUND = 'Loan not found';
export const ASSET_REQUEST_NOT_FOUND = 'Asset request not found';

/** Money is only handed to customers whose account is in good standing. */
export function assertCanReceiveMoney(status: UserStatus): void {
  if (status === 'FLAGGED') {
    throw new BadRequestException(
      "This customer's account is restricted. Review their status before disbursing.",
    );
  }
  if (status === 'INACTIVE') {
    throw new BadRequestException("This customer's account is deactivated. Reactivate it before disbursing.");
  }
}

const LOAN_DETAIL = {
  id: true,
  category: true,
  status: true,
  principal: true,
  tenure: true,
  interestRate: true,
  managementFeeRate: true,
  disbursementDate: true,
  createdAt: true,
  updatedAt: true,
  borrower: { select: BORROWER },
  requestedBy: { select: { userId: true, user: { select: { name: true } } } },
  commodities: {
    orderBy: { createdAt: 'asc' },
    select: { id: true, status: true, commodity: { select: { name: true } }, microLoan: { select: { purpose: true } } },
  },
  microLoans: { where: { purpose: 'TOPUP' }, orderBy: { createdAt: 'desc' }, select: TOPUP },
} satisfies Prisma.LoanSelect;

// Cash loans are requested by customers (or by an admin for them), approved with a tenure and
// the rates in Settings, then disbursed through the ledger. Approval and disbursement routes
// here work on any loan id: an asset loan is approved from its asset request (commodity
// routes) but disbursed and read here, like v1.
@Injectable()
export class CashLoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
  ) {}

  async getAllLoans(dto: CashLoanQueryDto) {
    const { page = 1, limit = 20 } = dto;
    const where = buildCashLoanWhere(dto);
    const [loans, total] = await Promise.all([
      this.prisma.loan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          category: true,
          status: true,
          principal: true,
          tenure: true,
          disbursementDate: true,
          createdAt: true,
          borrower: { select: CUSTOMER_REF },
        },
      }),
      this.prisma.loan.count({ where }),
    ]);
    const figures = await loanFiguresMany(this.prisma, loans);
    const data: CashLoanItemDto[] = loans.map((loan) => ({
      ...toLoanSummary(loan, figures),
      date: loan.createdAt,
      customer: toCustomerRef(loan.borrower),
    }));
    return { data, meta: { total, page, limit }, message: 'Queried all loans info' };
  }

  /** Any loan, cash or asset, with its figures, asset requests and top-ups. */
  async getLoan(loanId: string): Promise<CashLoanDto> {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId }, select: LOAN_DETAIL });
    if (!loan) throw new NotFoundException(LOAN_NOT_FOUND);
    const [balances, monthly] = await Promise.all([
      loanBalancesMany(this.prisma, [loanId]),
      openExpectedMany(this.prisma, [loanId]),
    ]);
    const booked = balances.get(loanId);
    const disbursed = loan.status === 'DISBURSED' || loan.status === 'REPAID';
    const managementFee =
      disbursed && booked ? booked.managementFee : money(loan.principal.mul(loan.managementFeeRate));

    return {
      id: loan.id,
      category: loan.category,
      status: loan.status,
      disbursementDate: loan.disbursementDate,
      ...toLoanFigures(loan, booked, monthly.get(loanId)),
      interestRate: percent(loan.interestRate),
      managementFeeRate: percent(loan.managementFeeRate),
      managementFee: toNumber(managementFee),
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
      borrower: toBorrower(loan.borrower),
      requestedBy: loan.requestedBy ? { id: loan.requestedBy.userId, name: loan.requestedBy.user.name } : null,
      assets: loan.commodities.map((request) => ({
        id: request.id,
        name: request.commodity.name,
        status: request.status,
        kind: commodityKind(request, loan),
      })),
      topups: loan.microLoans.map(toTopup),
    };
  }

  /**
   * PENDING → APPROVED with the tenure and Settings' rates snapshotted onto the loan (409 until
   * they are set). Pass `tx` to approve inside a larger transaction (onboarding's first loan).
   */
  async approveLoan(loanId: string, dto: LoanTermsDto, actorId: string, tx?: Tx): Promise<void> {
    const rates = await this.settings.requireRates();
    await this.ledgerTx.run(tx, async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        select: { status: true, category: true, principal: true },
      });
      if (!loan) throw new NotFoundException(LOAN_NOT_FOUND);
      if (loan.category === 'ASSET_PURCHASE') {
        throw new ConflictException('Approve an asset loan from its asset request');
      }
      if (loan.status !== 'PENDING') throw new ConflictException('Only a pending loan can be approved');
      if (loan.principal.lte(0)) throw new ConflictException('This loan has no amount to approve');

      const { count } = await tx.loan.updateMany({
        where: { id: loanId, status: 'PENDING' },
        data: { status: 'APPROVED', tenure: dto.tenure, ...rates },
      });
      if (count === 0) throw new ConflictException(ALREADY_DECIDED);
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'LOAN_APPROVED',
        entityType: 'LOAN',
        entityId: loanId,
        note: `Tenure ${dto.tenure} month(s)`,
      });
    });
  }

  /**
   * A pending or approved (not yet disbursed) loan is turned down. Asset requests on it are
   * turned down with it.
   */
  async rejectLoan(loanId: string, dto: LoanRejectionDto, actorId: string): Promise<void> {
    await this.ledgerTx.transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id: loanId }, select: { status: true } });
      if (!loan) throw new NotFoundException(LOAN_NOT_FOUND);
      if (loan.status !== 'PENDING' && loan.status !== 'APPROVED') {
        throw new ConflictException('Only a pending or approved loan can be rejected');
      }
      const { count } = await tx.loan.updateMany({
        where: { id: loanId, status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'REJECTED' },
      });
      if (count === 0) throw new ConflictException(ALREADY_DECIDED);
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'LOAN_REJECTED',
        entityType: 'LOAN',
        entityId: loanId,
        note: dto.note,
      });

      const requests = await tx.commodityLoan.findMany({
        where: { loanId, status: { not: 'REJECTED' } },
        select: { id: true },
      });
      if (requests.length === 0) return;
      await tx.commodityLoan.updateMany({
        where: { id: { in: requests.map((request) => request.id) } },
        data: { status: 'REJECTED' },
      });
      for (const request of requests) {
        await this.ledgerTx.audit(tx, {
          actorId,
          action: 'COMMODITY_REJECTED',
          entityType: 'COMMODITY_LOAN',
          entityId: request.id,
          note: dto.note ?? 'Its loan was rejected',
        });
      }
    });
  }

  /** APPROVED → DISBURSED through the ledger (cash and asset loans alike). */
  async disburseLoan(loanId: string, actorId: string): Promise<void> {
    await this.settings.requireRates();
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: { status: true, borrower: { select: { user: { select: { status: true } } } } },
    });
    if (!loan) throw new NotFoundException(LOAN_NOT_FOUND);
    if (loan.status !== 'APPROVED') throw new ConflictException('Only an approved loan can be disbursed');
    assertCanReceiveMoney(loan.borrower.user.status);
    await this.ledger.disburseLoan(loanId, actorId);
  }
}

const REQUEST_ROW = {
  id: true,
  status: true,
  createdAt: true,
  loanId: true,
  commodity: { select: { name: true } },
  microLoan: { select: { amount: true, purpose: true } },
} satisfies Prisma.CommodityLoanSelect;

/** What the customer borrows for an approved request: its top-up, or its asset loan's principal. */
function approvedAmount(
  request: Prisma.CommodityLoanGetPayload<{ select: typeof REQUEST_ROW }>,
  loan: { principal: Prisma.Decimal },
  kind: 'NEW_LOAN' | 'TOPUP',
): number | null {
  if (request.status !== 'APPROVED') return null;
  if (request.microLoan) return toNumber(request.microLoan.amount);
  return kind === 'NEW_LOAN' ? toNumber(loan.principal) : null;
}

// Asset requests. A request on a PENDING asset loan (principal 0, tenure 0) opens that loan:
// approving it sets the amount, tenure and rates, and the loan is then disbursed like a cash
// loan (PATCH /admin/loans/cash/:loanId/disburse). A request on a running (DISBURSED) loan is an
// asset top-up: approving it requests and approves a top-up that pays for it, disbursed with
// PATCH /admin/loans/topups/:id/disburse.
@Injectable()
export class CommodityLoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
  ) {}

  async getAllLoans(dto: CommodityLoanQueryDto) {
    const { page = 1, limit = 20 } = dto;
    const where = buildCommodityLoanWhere(dto);
    const [requests, total] = await Promise.all([
      this.prisma.commodityLoan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          ...REQUEST_ROW,
          loan: { select: { status: true, category: true, principal: true, borrower: { select: CUSTOMER_REF } } },
        },
      }),
      this.prisma.commodityLoan.count({ where }),
    ]);
    const data: CommodityLoanItemDto[] = requests.map((request) => {
      const kind = commodityKind(request, request.loan);
      return {
        id: request.id,
        date: request.createdAt,
        customer: toCustomerRef(request.loan.borrower),
        name: request.commodity.name,
        status: request.status,
        inReview: request.status === 'IN_REVIEW',
        kind,
        amount: approvedAmount(request, request.loan, kind),
        loanId: request.loanId,
        loanStatus: request.loan.status,
      };
    });
    return { data, meta: { total, page, limit }, message: 'Queried all assets loans info' };
  }

  async getLoan(requestId: string): Promise<CommodityLoanDto> {
    const request = await this.prisma.commodityLoan.findUnique({
      where: { id: requestId },
      select: {
        ...REQUEST_ROW,
        publicDetails: true,
        privateDetails: true,
        microLoan: { select: { ...TOPUP, purpose: true } },
        loan: {
          select: {
            id: true,
            category: true,
            status: true,
            principal: true,
            tenure: true,
            disbursementDate: true,
            borrower: { select: BORROWER },
          },
        },
      },
    });
    if (!request) throw new NotFoundException(ASSET_REQUEST_NOT_FOUND);
    const { loan, microLoan } = request;
    const kind = commodityKind(request, loan);
    const figures = await loanFiguresMany(this.prisma, [loan]);
    return {
      id: request.id,
      name: request.commodity.name,
      status: request.status,
      inReview: request.status === 'IN_REVIEW',
      kind,
      createdAt: request.createdAt,
      publicDetails: request.publicDetails,
      privateDetails: request.privateDetails,
      amount: approvedAmount(request, loan, kind),
      loanId: request.loanId,
      topup: microLoan?.purpose === 'TOPUP' ? toTopup(microLoan) : null,
      borrower: toBorrower(loan.borrower),
      loan: toLoanSummary(loan, figures),
    };
  }

  async approveCommodityLoan(requestId: string, dto: AcceptCommodityLoanDto, actorId: string): Promise<void> {
    const request = await this.prisma.commodityLoan.findUnique({
      where: { id: requestId },
      select: { status: true, loanId: true, loan: { select: { status: true, category: true } } },
    });
    if (!request) throw new NotFoundException(ASSET_REQUEST_NOT_FOUND);
    if (request.status !== 'IN_REVIEW') throw new ConflictException(ALREADY_DECIDED);

    const { loan, loanId } = request;
    if (loan.status === 'PENDING' && loan.category === 'ASSET_PURCHASE') {
      return this.approveNewAssetLoan(requestId, loanId, dto, actorId);
    }
    if (loan.status === 'DISBURSED') return this.approveAssetTopup(requestId, loanId, dto, actorId);
    throw new ConflictException(`This request can no longer be approved: its loan is ${loan.status.toLowerCase()}`);
  }

  private async approveNewAssetLoan(requestId: string, loanId: string, dto: AcceptCommodityLoanDto, actorId: string) {
    if (dto.monthsDelta !== undefined) {
      throw new BadRequestException('monthsDelta is only for a top-up on a running loan; send tenure instead');
    }
    if (dto.tenure === undefined) throw new BadRequestException('Enter the tenure (months) for this asset loan');
    const tenure = dto.tenure;
    const rates = await this.settings.requireRates();

    await this.ledgerTx.transaction(async (tx) => {
      await this.decide(tx, requestId, dto, actorId);
      const { count } = await tx.loan.updateMany({
        where: { id: loanId, status: 'PENDING' },
        data: { status: 'APPROVED', principal: money(dto.amount), tenure, ...rates },
      });
      if (count === 0) throw new ConflictException(ALREADY_DECIDED);
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'LOAN_APPROVED',
        entityType: 'LOAN',
        entityId: loanId,
        note: `Asset loan, tenure ${tenure} month(s)`,
      });
    });
  }

  private async approveAssetTopup(requestId: string, loanId: string, dto: AcceptCommodityLoanDto, actorId: string) {
    if (dto.tenure !== undefined) {
      throw new BadRequestException("A top-up keeps the loan's tenure; send monthsDelta to change it");
    }
    await this.ledgerTx.transaction(async (tx) => {
      await this.decide(tx, requestId, dto, actorId);
      const topup = await this.ledger.requestTopup(
        {
          loanId,
          amount: money(dto.amount),
          commodityLoanId: requestId,
          requestedById: actorId,
          monthsDelta: dto.monthsDelta,
        },
        tx,
      );
      await this.ledger.approveTopup(topup.id, actorId, tx);
    });
  }

  /** IN_REVIEW → APPROVED with the details, compare-and-swap. */
  private async decide(tx: Tx, requestId: string, dto: AcceptCommodityLoanDto, actorId: string) {
    const { count } = await tx.commodityLoan.updateMany({
      where: { id: requestId, status: 'IN_REVIEW' },
      data: { status: 'APPROVED', publicDetails: dto.publicDetails, privateDetails: dto.privateDetails },
    });
    if (count === 0) throw new ConflictException(ALREADY_DECIDED);
    await this.ledgerTx.audit(tx, {
      actorId,
      action: 'COMMODITY_APPROVED',
      entityType: 'COMMODITY_LOAN',
      entityId: requestId,
    });
  }

  /** IN_REVIEW → REJECTED; the pending asset loan it would have opened is rejected with it. */
  async rejectCommodityLoan(requestId: string, dto: LoanRejectionDto, actorId: string): Promise<void> {
    await this.ledgerTx.transaction(async (tx) => {
      const request = await tx.commodityLoan.findUnique({
        where: { id: requestId },
        select: { loanId: true, loan: { select: { status: true, category: true } } },
      });
      if (!request) throw new NotFoundException(ASSET_REQUEST_NOT_FOUND);
      const { count } = await tx.commodityLoan.updateMany({
        where: { id: requestId, status: 'IN_REVIEW' },
        data: { status: 'REJECTED' },
      });
      if (count === 0) throw new ConflictException(ALREADY_DECIDED);
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'COMMODITY_REJECTED',
        entityType: 'COMMODITY_LOAN',
        entityId: requestId,
        note: dto.note,
      });

      if (request.loan.category !== 'ASSET_PURCHASE' || request.loan.status !== 'PENDING') return;
      const loan = await tx.loan.updateMany({
        where: { id: request.loanId, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      if (loan.count === 0) return;
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'LOAN_REJECTED',
        entityType: 'LOAN',
        entityId: request.loanId,
        note: dto.note ?? 'Its asset request was rejected',
      });
    });
  }
}
