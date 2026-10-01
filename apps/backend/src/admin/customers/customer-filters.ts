import type { Prisma } from '@prisma/client';
import { normalizeNgPhone } from '@microbuilt/shared';
import { PLATFORM_ID } from 'src/common/constants';
import type { Tx } from 'src/ledger/ledger.tx';
import { customersByRepaymentRate } from 'src/ledger/repayment-rate';
import type { CustomersQueryDto } from '../common/dto/customer.dto';

// The customer list's filters as a `where` on Customer, shared by GET /admin/customers (and the
// account-officer lists) and its export (the reports queue), so both filter identically. Async
// because the repayment-rate filter is computed (customersByRepaymentRate). Callers add
// pagination and select.
//
// Dates arrive as Dates on the list path but as ISO strings on the export path (Bull serialises
// job data as JSON), so every date goes through `new Date(...)`, and an absent filter may be null.

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

const isSet = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;

function range(min?: number | null, max?: number | null): Prisma.DecimalFilter | undefined {
  if (!isSet(min) && !isSet(max)) return undefined;
  return { ...(isSet(min) && { gte: min }), ...(isSet(max) && { lte: max }) };
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

export async function buildCustomerWhere(db: Tx, filters: CustomersQueryDto): Promise<Prisma.CustomerWhereInput> {
  const conditions: Prisma.CustomerWhereInput[] = [];

  const user: Prisma.UserWhereInput = {};
  if (filters.status) user.status = filters.status;
  if (filters.signupStart || filters.signupEnd) {
    user.createdAt = {
      ...(filters.signupStart && { gte: lagosDay(filters.signupStart).start }),
      ...(filters.signupEnd && { lt: lagosDay(filters.signupEnd).end }),
    };
  }
  if (Object.keys(user).length > 0) conditions.push({ user });

  if (filters.accountOfficerId) {
    conditions.push({ accountOfficerId: filters.accountOfficerId === PLATFORM_ID ? null : filters.accountOfficerId });
  }

  const search = filters.search?.trim();
  if (search) conditions.push({ OR: customerSearch(search) });

  if (isSet(filters.hasActiveLoan)) {
    const running: Prisma.LoanListRelationFilter = { some: { status: 'DISBURSED' } };
    conditions.push({ loans: filters.hasActiveLoan ? running : { none: running.some } });
  }

  const payroll: Prisma.CustomerPayrollWhereInput = {};
  const organization = filters.organization?.trim();
  if (organization) payroll.organization = { equals: organization, mode: 'insensitive' };
  const gross = range(filters.grossPayMin, filters.grossPayMax);
  if (gross) payroll.employeeGross = gross;
  const net = range(filters.netPayMin, filters.netPayMax);
  if (net) payroll.netPay = net;
  if (Object.keys(payroll).length > 0) conditions.push({ payroll: { is: payroll } });

  if (isSet(filters.repaymentRateMin) || isSet(filters.repaymentRateMax)) {
    const ids = await customersByRepaymentRate(db, {
      min: filters.repaymentRateMin ?? undefined,
      max: filters.repaymentRateMax ?? undefined,
    });
    conditions.push({ userId: { in: ids } });
  }

  return conditions.length === 1 ? conditions[0] : conditions.length ? { AND: conditions } : {};
}
