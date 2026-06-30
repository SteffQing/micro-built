import { Prisma } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';
import { PLATFORM_ID } from 'src/common/constants';
import type {
  CashLoanQueryDto,
  CommodityLoanQueryDto,
  CustomersQueryDto,
  FilterRepaymentsDto,
} from 'src/admin/common/dto';

/**
 * Pure `where`-clause builders shared by the paginated list endpoints and the
 * background export worker, so both filter identically (single source of truth).
 * They are intentionally free of Prisma I/O — callers add pagination/select.
 *
 * Date filters arrive as real `Date`s on the synchronous list path but as ISO
 * strings on the worker path (Bull JSON-serializes job data), so every date
 * boundary is coerced through `new Date(...)`, which is a no-op clone for Dates.
 */

const dayStart = (value: Date | string) => startOfDay(new Date(value));
const dayEnd = (value: Date | string) => endOfDay(new Date(value));

export function buildCustomerWhere(
  filters: CustomersQueryDto,
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role: 'CUSTOMER' };
  const { search, status, accountOfficerId } = filters;

  if (status) where.status = status;
  if (accountOfficerId)
    where.accountOfficerId =
      accountOfficerId === PLATFORM_ID ? null : accountOfficerId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { externalId: { contains: search, mode: 'insensitive' } },
      { contact: { contains: search, mode: 'insensitive' } },
    ];
  }

  const { hasActiveLoan, signupStart, signupEnd } = filters;
  if (hasActiveLoan) where.loans = { some: { status: 'DISBURSED' } };
  if (signupStart || signupEnd) {
    where.createdAt = {
      ...(signupStart && { gte: dayStart(signupStart) }),
      ...(signupEnd && { lte: dayEnd(signupEnd) }),
    };
  }
  if (filters.repaymentRateMin || filters.repaymentRateMax) {
    where.repaymentRate = {
      ...(filters.repaymentRateMin && { gte: filters.repaymentRateMin }),
      ...(filters.repaymentRateMax && { lte: filters.repaymentRateMax }),
    };
  }

  const { grossPayMax, grossPayMin, netPayMax, netPayMin, organization } =
    filters;
  if (grossPayMin || grossPayMax || netPayMin || netPayMax || organization) {
    where.payroll = {
      ...(organization && { organization }),
      ...(grossPayMin || grossPayMax
        ? {
            employeeGross: {
              ...(grossPayMin && { gte: grossPayMin }),
              ...(grossPayMax && { lte: grossPayMax }),
            },
          }
        : {}),
      ...(netPayMin || netPayMax
        ? {
            netPay: {
              ...(netPayMin && { gte: netPayMin }),
              ...(netPayMax && { lte: netPayMax }),
            },
          }
        : {}),
    };
  }

  return where;
}

export function buildRepaymentWhere(
  dto: FilterRepaymentsDto,
): Prisma.RepaymentWhereInput {
  const where: Prisma.RepaymentWhereInput = {};
  const { status, periodStart, periodEnd } = dto;

  if (status) where.status = status;
  if (dto.hasPenaltyCharge) where.penaltyCharge = { gt: 0 };
  if (dto.search) {
    where.OR = [
      { user: { name: { contains: dto.search, mode: 'insensitive' } } },
      { user: { email: { contains: dto.search, mode: 'insensitive' } } },
      { user: { externalId: { contains: dto.search, mode: 'insensitive' } } },
      { user: { contact: { contains: dto.search, mode: 'insensitive' } } },
    ];
  }
  if (periodStart || periodEnd) {
    where.periodInDT = {
      ...(periodStart && { gte: dayStart(periodStart) }),
      ...(periodEnd && { lte: dayEnd(periodEnd) }),
    };
  }
  if (dto.repaidAmountMin || dto.repaidAmountMax) {
    where.repaidAmount = {
      ...(dto.repaidAmountMin && { gte: dto.repaidAmountMin }),
      ...(dto.repaidAmountMax && { lte: dto.repaidAmountMax }),
    };
  }

  return where;
}

export function buildCashLoanWhere(
  dto: CashLoanQueryDto,
): Prisma.LoanWhereInput {
  const { status, category, type, search } = dto;
  const where: Prisma.LoanWhereInput = {
    category: { not: 'ASSET_PURCHASE' },
  };

  if (search) {
    where.OR = [
      { borrower: { name: { contains: search, mode: 'insensitive' } } },
      { borrower: { email: { contains: search, mode: 'insensitive' } } },
      { borrower: { externalId: { contains: search, mode: 'insensitive' } } },
      { borrower: { contact: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (status) where.status = status;
  if (category) where.category = category;
  if (type) where.type = type;

  const { hasPenalties, hasCommodityLoan } = dto;
  if (hasPenalties) where.penalty = { gt: 0 };
  if (hasCommodityLoan) where.asset = { isNot: null };

  const { disbursementEnd, disbursementStart, requestedEnd, requestedStart } =
    dto;
  if (disbursementStart || disbursementEnd) {
    where.disbursementDate = {
      ...(disbursementStart && { gte: dayStart(disbursementStart) }),
      ...(disbursementEnd && { lte: dayEnd(disbursementEnd) }),
    };
  }
  if (requestedStart || requestedEnd) {
    where.createdAt = {
      ...(requestedStart && { gte: dayStart(requestedStart) }),
      ...(requestedEnd && { lte: dayEnd(requestedEnd) }),
    };
  }

  return where;
}

export function buildCommodityLoanWhere(
  dto: CommodityLoanQueryDto,
): Prisma.CommodityLoanWhereInput {
  const { search, inReview, requestedStart, requestedEnd } = dto;
  const where: Prisma.CommodityLoanWhereInput = {};

  if (inReview !== undefined) where.inReview = inReview;
  if (search) {
    where.OR = [
      { borrower: { name: { contains: search, mode: 'insensitive' } } },
      { borrower: { email: { contains: search, mode: 'insensitive' } } },
      { borrower: { externalId: { contains: search, mode: 'insensitive' } } },
      { borrower: { contact: { contains: search, mode: 'insensitive' } } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (requestedStart || requestedEnd) {
    where.createdAt = {
      ...(requestedStart && { gte: dayStart(requestedStart) }),
      ...(requestedEnd && { lte: dayEnd(requestedEnd) }),
    };
  }

  return where;
}
