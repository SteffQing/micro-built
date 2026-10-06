import type { Prisma } from '@prisma/client';
import { normalizeNgPhone } from '@microbuilt/shared';
import { parsePeriodRange, periodWhere } from 'src/common/dto/period.dto';
import type {
  FilterAppliedRepaymentsDto,
  FilterDeductionsDto,
  FilterRepaymentsDto,
} from '../common/dto/repayment.dto';

/** A customer's name, email, phone number (as typed or normalised), customer id or IPPIS number. */
function customerSearch(search: string): Prisma.CustomerWhereInput[] {
  const contains = { contains: search, mode: 'insensitive' as const };
  const phone = normalizeNgPhone(search);
  return [
    { userId: contains },
    { externalId: contains },
    { user: { name: contains } },
    { user: { email: contains } },
    { user: { phoneNumber: contains } },
    ...(phone ? [{ user: { phoneNumber: phone } }] : []),
  ];
}

/**
 * The repayments list's filters as a `where` on PaymentInflow (v2's repayment rows), shared by
 * GET /admin/repayments and its export (the reports queue), so both filter identically. Pure:
 * callers add pagination, order and select. Job data arrives as JSON, so every value here is a
 * plain string or number. 400 when `from` is after `to`.
 */
export function buildInflowWhere(filters: FilterRepaymentsDto): Prisma.PaymentInflowWhereInput {
  const where: Prisma.PaymentInflowWhereInput = {};
  if (filters.state) where.state = filters.state;
  if (filters.source) where.source = filters.source;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.uploadId) where.voucherId = filters.uploadId;

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { id: search },
      // An unmatched payroll row has no customer, only the sheet's staff ID.
      { externalUserId: { contains: search, mode: 'insensitive' } },
      ...customerSearch(search).map((customer) => ({ customer })),
    ];
  }

  const { amountMin, amountMax } = filters;
  if (amountMin !== undefined || amountMax !== undefined) {
    where.amount = {
      ...(amountMin !== undefined && { gte: amountMin }),
      ...(amountMax !== undefined && { lte: amountMax }),
    };
  }

  const range = parsePeriodRange(filters);
  if (range.from || range.to) where.period = periodWhere(range);
  return where;
}

/** `period` (one month) wins over `from..to`; 400 when `from` is after `to`. */
function monthRange(filters: { period?: string; from?: string; to?: string }) {
  return filters.period ? parsePeriodRange({ from: filters.period, to: filters.period }) : parsePeriodRange(filters);
}

/**
 * GET /admin/repayments/deductions: what each loan is expected to pay per payroll month, as a
 * `where` on Deduction. Search is the customer (name, email, phone, customer id, IPPIS number) or
 * the loan id.
 */
export function buildDeductionWhere(filters: FilterDeductionsDto): Prisma.DeductionWhereInput {
  const where: Prisma.DeductionWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.customerId) where.loan = { borrowerId: filters.customerId };

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { loanId: { contains: search, mode: 'insensitive' } },
      ...customerSearch(search).map((borrower) => ({ loan: { borrower } })),
    ];
  }

  const range = monthRange(filters);
  if (range.from || range.to) where.period = periodWhere(range);
  return where;
}

/**
 * GET /admin/repayments/applied: payments applied to loans (Repayment rows). Search is the
 * customer, the loan id or the payment's id.
 */
export function buildAppliedWhere(filters: FilterAppliedRepaymentsDto): Prisma.RepaymentWhereInput {
  const where: Prisma.RepaymentWhereInput = {};
  if (filters.loanId) where.loanId = filters.loanId;
  if (filters.customerId) where.loan = { borrowerId: filters.customerId };

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { loanId: { contains: search, mode: 'insensitive' } },
      { paymentInflowId: search },
      ...customerSearch(search).map((borrower) => ({ loan: { borrower } })),
    ];
  }

  const range = monthRange(filters);
  if (range.from || range.to) where.paymentInflow = { period: periodWhere(range) };
  return where;
}
