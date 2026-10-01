import type { Prisma } from '@prisma/client';
import { normalizeNgPhone } from '@microbuilt/shared';
import { parsePeriodRange, periodWhere } from 'src/common/dto/period.dto';
import type { FilterRepaymentsDto } from '../common/dto/repayment.dto';

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
  if (filters.uploadId) where.uploadId = filters.uploadId;

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
