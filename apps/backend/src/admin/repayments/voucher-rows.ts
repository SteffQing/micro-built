import type { PayrollRow } from 'src/common/logic/repayment-validation';
import type { VoucherIssueCounts } from 'src/common/types/repayment.interface';
import { chunkArray } from 'src/common/utils';
import type { Tx } from 'src/ledger/ledger.tx';
import { money } from 'src/ledger/money';

// What a voucher's rows are matched against: the customer with each staff ID, and the customers who have a
// deduction left to pay in the variation. Shared by the validate route (which counts the issues a voucher would
// leave) and the job that processes it, so both read a row the same way.

/** Staff IDs looked up per query. */
const LOOKUP_CHUNK = 1000;

export interface StaffMatch {
  customerId: string;
  /** The customer's payroll organization; null when they have no payroll record. */
  organizationId: string | null;
}

/** The customer with each staff ID (Customer.externalId), for the rows of one sheet. */
export async function customersByStaffId(db: Tx, staffIds: string[]): Promise<Map<string, StaffMatch>> {
  const found = new Map<string, StaffMatch>();
  for (const chunk of chunkArray([...new Set(staffIds)], LOOKUP_CHUNK)) {
    const customers = await db.customer.findMany({
      where: { externalId: { in: chunk } },
      select: { userId: true, externalId: true, payroll: { select: { organizationId: true } } },
    });
    for (const { userId, externalId, payroll } of customers) {
      if (externalId) found.set(externalId, { customerId: userId, organizationId: payroll?.organizationId ?? null });
    }
  }
  return found;
}

/** The customers whose running loan has a deduction in the variation still waiting for payment. */
export async function payableCustomers(db: Tx, variationId: string): Promise<Set<string>> {
  const deductions = await db.deduction.findMany({
    where: { variationId, status: { in: ['AWAITING', 'PARTIAL'] }, loan: { status: 'DISBURSED' } },
    select: { loan: { select: { borrowerId: true } } },
  });
  return new Set(deductions.map((deduction) => deduction.loan.borrowerId));
}

/**
 * Why rows would not be paid when the voucher is processed: no customer has the staff ID; the customer is in
 * another organization (and has nothing to pay in this variation); or is in this one but has no deduction in it.
 * Rows with nothing deducted are never recorded, so they aren't counted.
 */
export function issueCounts(
  rows: PayrollRow[],
  matches: Map<string, StaffMatch>,
  payable: Set<string>,
  organizationId: string,
): VoucherIssueCounts {
  const counts: VoucherIssueCounts = { unmatched: 0, otherOrganization: 0, notInVariation: 0 };
  for (const row of rows) {
    if (money(row.amount ?? 0).lte(0)) continue;
    const match = matches.get(row.staffId);
    if (!match) counts.unmatched++;
    else if (payable.has(match.customerId)) continue;
    else if (match.organizationId !== null && match.organizationId !== organizationId) counts.otherOrganization++;
    else counts.notInVariation++;
  }
  return counts;
}
