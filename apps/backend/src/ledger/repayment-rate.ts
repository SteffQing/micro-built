import { Prisma } from '@prisma/client';
import type { Tx } from './ledger.tx';

// A customer's repayment rate (V2.MD §0.5): of what payroll was asked for in months that are
// closed, the share that came in, as a percentage (100 when nothing has been due yet). Each
// month counts at most what it asked for, so paying double one month doesn't hide a missed one.

interface RateRow {
  customerId: string;
  rate: Prisma.Decimal;
}

function ratesQuery(customerIds: string[] | null): Prisma.Sql {
  const scope = customerIds ? Prisma.sql`WHERE c."userId" IN (${Prisma.join(customerIds)})` : Prisma.empty;
  return Prisma.sql`
    SELECT c."userId" AS "customerId",
           CASE WHEN COALESCE(SUM(d."expected"), 0) = 0 THEN 100
                ELSE ROUND(SUM(LEAST(paid."amount", d."expected")) / SUM(d."expected") * 100, 2)
           END AS "rate"
    FROM "Customer" c
    LEFT JOIN "Loan" l ON l."borrowerId" = c."userId"
    LEFT JOIN "Deduction" d ON d."loanId" = l."id"
      AND EXISTS (SELECT 1 FROM "PayrollPeriod" p WHERE p."id" = d."periodId" AND p."closedAt" IS NOT NULL)
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(r."amount"), 0) AS "amount" FROM "Repayment" r WHERE r."deductionId" = d."id"
    ) paid ON TRUE
    ${scope}
    GROUP BY c."userId"`;
}

/** Rate per customer (0–100, 2 dp). Every id asked for is in the map. */
export async function repaymentRates(db: Tx, customerIds: string[]): Promise<Map<string, number>> {
  if (customerIds.length === 0) return new Map();
  const rows = await db.$queryRaw<RateRow[]>(ratesQuery(customerIds));
  const rates = new Map(rows.map((row) => [row.customerId, Number(row.rate)]));
  for (const id of customerIds) if (!rates.has(id)) rates.set(id, 100);
  return rates;
}

/**
 * Customers whose rate is within [min, max] (either end optional), for list filters and
 * exports: `where: { userId: { in: ids } }`.
 */
export async function customersByRepaymentRate(db: Tx, range: { min?: number; max?: number }): Promise<string[]> {
  const bounds: Prisma.Sql[] = [];
  if (range.min !== undefined) bounds.push(Prisma.sql`"rate" >= ${range.min}`);
  if (range.max !== undefined) bounds.push(Prisma.sql`"rate" <= ${range.max}`);
  const where = bounds.length > 0 ? Prisma.sql`WHERE ${Prisma.join(bounds, ' AND ')}` : Prisma.empty;
  const rows = await db.$queryRaw<{ customerId: string }[]>`
    SELECT "customerId" FROM (${ratesQuery(null)}) rates ${where}`;
  return rows.map((row) => row.customerId);
}
