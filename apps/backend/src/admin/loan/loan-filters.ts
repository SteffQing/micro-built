import type { Prisma } from '@prisma/client';
import { normalizeNgPhone } from '@microbuilt/shared';
import type { CashLoanQueryDto, CommodityLoanQueryDto } from '../common/dto/loan.dto';

// The loan lists' filters as `where`s, shared by the list endpoints and their exports (the
// reports queue), so both filter identically. Pure: callers add pagination and select.
//
// Dates arrive as Dates on the list path but as ISO strings on the export path (Bull serialises
// job data as JSON), so every date goes through `new Date(...)`.

// Africa/Lagos is UTC+1 all year (no daylight saving).
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** The Lagos calendar day a filter date names: [start, end) as instants. */
function lagosDay(value: Date | string): { start: Date; end: Date } {
  const date = new Date(value);
  const [year, month, day] = [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
  return {
    start: new Date(Date.UTC(year, month, day) - LAGOS_OFFSET_MS),
    end: new Date(Date.UTC(year, month, day + 1) - LAGOS_OFFSET_MS),
  };
}

/** From the start of `from`'s day to the end of `to`'s day; undefined when neither is set. */
function dayRange(from?: Date | string, to?: Date | string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from && { gte: lagosDay(from).start }),
    ...(to && { lt: lagosDay(to).end }),
  };
}

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

/** Cash loans (every category except ASSET_PURCHASE). */
export function buildCashLoanWhere(filters: CashLoanQueryDto): Prisma.LoanWhereInput {
  const { status, category, principalMin, principalMax, hasPenalties, hasCommodityLoan } = filters;
  const where: Prisma.LoanWhereInput = {
    category: category && category !== 'ASSET_PURCHASE' ? category : { not: 'ASSET_PURCHASE' },
  };
  if (status) where.status = status;

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { id: { contains: search, mode: 'insensitive' } },
      ...customerSearch(search).map((borrower) => ({ borrower })),
    ];
  }

  if (principalMin !== undefined || principalMax !== undefined) {
    where.principal = {
      ...(principalMin !== undefined && { gte: principalMin }),
      ...(principalMax !== undefined && { lte: principalMax }),
    };
  }
  if (hasPenalties !== undefined) {
    const penalty: Prisma.MicroLoanListRelationFilter = { some: { purpose: 'PENALTY', status: 'DISBURSED' } };
    where.microLoans = hasPenalties ? penalty : { none: penalty.some };
  }
  if (hasCommodityLoan !== undefined) {
    const asset: Prisma.CommodityLoanListRelationFilter = { some: { status: 'APPROVED' } };
    where.commodities = hasCommodityLoan ? asset : { none: asset.some };
  }

  const disbursed = dayRange(filters.disbursementStart, filters.disbursementEnd);
  if (disbursed) where.disbursementDate = disbursed;
  const requested = dayRange(filters.requestedStart, filters.requestedEnd);
  if (requested) where.createdAt = requested;

  return where;
}

/** Asset requests: new asset loans and asset top-ups on a running loan. */
export function buildCommodityLoanWhere(filters: CommodityLoanQueryDto): Prisma.CommodityLoanWhereInput {
  const conditions: Prisma.CommodityLoanWhereInput[] = [];
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.inReview !== undefined) {
    conditions.push({ status: filters.inReview ? 'IN_REVIEW' : { not: 'IN_REVIEW' } });
  }

  const search = filters.search?.trim();
  if (search) {
    const contains = { contains: search, mode: 'insensitive' as const };
    conditions.push({
      OR: [
        { id: contains },
        { loanId: contains },
        { commodity: { name: contains } },
        ...customerSearch(search).map((borrower) => ({ loan: { borrower } })),
      ],
    });
  }

  const requested = dayRange(filters.requestedStart, filters.requestedEnd);
  if (requested) conditions.push({ createdAt: requested });

  return conditions.length === 1 ? conditions[0] : conditions.length ? { AND: conditions } : {};
}
