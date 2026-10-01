import { NotFoundException } from '@nestjs/common';
import { Prisma, type LoanStatus } from '@prisma/client';
import { managementFee, remainingMonths, total, type Components } from './ledger.math';
import type { Tx } from './ledger.tx';
import { money, type Money } from './money';

/** Every V2.MD §0.5 aggregate for a loan (only DISBURSED microloans count). */
export interface LoanBalances {
  loanId: string;
  borrowerId: string;
  status: LoanStatus;
  tenure: number;
  interestRate: Prisma.Decimal;
  managementFeeRate: Prisma.Decimal;
  booked: Components;
  collected: Components;
  owed: Money;
  repaid: Money;
  outstanding: Money;
  managementFee: Money;
  frozenCount: number;
  remainingMonths: number;
  /** Σ expected of the deductions sent to payroll and not yet settled (AWAITING). */
  committed: Money;
}

interface BalancesRow {
  loanId: string;
  borrowerId: string;
  status: LoanStatus;
  tenure: number;
  interestRate: Prisma.Decimal;
  managementFeeRate: Prisma.Decimal;
  principalBooked: Prisma.Decimal;
  interestBooked: Prisma.Decimal;
  penaltyBooked: Prisma.Decimal;
  principalCollected: Prisma.Decimal;
  interestCollected: Prisma.Decimal;
  penaltyCollected: Prisma.Decimal;
  frozenCount: number;
  committed: Prisma.Decimal;
}

/** One grouped query for any number of loans. */
export async function loanBalancesMany(db: Tx, loanIds: string[]): Promise<Map<string, LoanBalances>> {
  if (loanIds.length === 0) return new Map();
  const rows = await db.$queryRaw<BalancesRow[]>`
    SELECT l."id" AS "loanId", l."borrowerId", l."status"::text AS "status", l."tenure",
           l."interestRate", l."managementFeeRate",
           m."principalBooked", m."interestBooked", m."penaltyBooked",
           c."principalCollected", c."interestCollected", c."penaltyCollected",
           d."frozenCount", d."committed"
    FROM "Loan" l
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM("amount") FILTER (WHERE "purpose" IN ('NEW_LOAN', 'TOPUP')), 0) AS "principalBooked",
             COALESCE(SUM("amount") FILTER (WHERE "purpose" = 'INTEREST'), 0) AS "interestBooked",
             COALESCE(SUM("amount") FILTER (WHERE "purpose" = 'PENALTY'), 0) AS "penaltyBooked"
      FROM "MicroLoan" WHERE "loanId" = l."id" AND "status" = 'DISBURSED'
    ) m
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM(b."amount") FILTER (WHERE b."component" = 'PRINCIPAL'), 0) AS "principalCollected",
             COALESCE(SUM(b."amount") FILTER (WHERE b."component" = 'INTEREST'), 0) AS "interestCollected",
             COALESCE(SUM(b."amount") FILTER (WHERE b."component" = 'PENALTY'), 0) AS "penaltyCollected"
      FROM "RepaymentBreakdown" b JOIN "Repayment" r ON r."id" = b."repaymentId"
      WHERE r."loanId" = l."id"
    ) c
    CROSS JOIN LATERAL (
      SELECT (COUNT(*) FILTER (WHERE "status" <> 'OPEN'))::int AS "frozenCount",
             COALESCE(SUM("expected") FILTER (WHERE "status" = 'AWAITING'), 0) AS "committed"
      FROM "Deduction" WHERE "loanId" = l."id"
    ) d
    WHERE l."id" IN (${Prisma.join(loanIds)})`;
  return new Map(rows.map((row) => [row.loanId, toBalances(row)]));
}

/** OPEN.expected per loan: what payroll will be asked for next. Loans without one are absent. */
export async function openExpectedMany(db: Tx, loanIds: string[]): Promise<Map<string, Money>> {
  if (loanIds.length === 0) return new Map();
  const rows = await db.deduction.findMany({
    where: { loanId: { in: loanIds }, status: 'OPEN' },
    select: { loanId: true, expected: true },
  });
  return new Map(rows.map((row) => [row.loanId, money(row.expected)]));
}

export async function loanBalances(db: Tx, loanId: string): Promise<LoanBalances> {
  const balances = (await loanBalancesMany(db, [loanId])).get(loanId);
  if (!balances) throw new NotFoundException('Loan not found');
  return balances;
}

function toBalances(row: BalancesRow): LoanBalances {
  const booked = {
    principal: money(row.principalBooked),
    interest: money(row.interestBooked),
    penalty: money(row.penaltyBooked),
  };
  const collected = {
    principal: money(row.principalCollected),
    interest: money(row.interestCollected),
    penalty: money(row.penaltyCollected),
  };
  const owed = total(booked);
  const repaid = total(collected);
  return {
    loanId: row.loanId,
    borrowerId: row.borrowerId,
    status: row.status,
    tenure: row.tenure,
    interestRate: row.interestRate,
    managementFeeRate: row.managementFeeRate,
    booked,
    collected,
    owed,
    repaid,
    outstanding: money(owed.minus(repaid)),
    managementFee: managementFee(booked.principal, row.managementFeeRate),
    frozenCount: row.frozenCount,
    remainingMonths: remainingMonths(row.tenure, row.frozenCount),
    committed: money(row.committed),
  };
}

/** A broken ledger is a bug, not a user error: this is a 500 and reaches Sentry. */
export class LedgerInvariantError extends Error {
  constructor(loanId: string, problems: string[]) {
    super(`Ledger invariant broken on loan ${loanId}: ${problems.join('; ')}`);
    this.name = 'LedgerInvariantError';
  }
}

/**
 * The §0.2 invariants, checked before a money-changing transaction commits:
 * owed = Σ DISBURSED microloans, repaid = Σ repayments = Σ their breakdown rows, repaid ≤ owed.
 */
export async function assertLedgerInvariants(db: Tx, loanId: string): Promise<void> {
  const [row] = await db.$queryRaw<
    { owed: Prisma.Decimal; repaid: Prisma.Decimal; booked: Prisma.Decimal; paid: Prisma.Decimal; splits: Prisma.Decimal }[]
  >`
    SELECT l."owed", l."repaid",
      (SELECT COALESCE(SUM("amount"), 0) FROM "MicroLoan"
        WHERE "loanId" = l."id" AND "status" = 'DISBURSED') AS "booked",
      (SELECT COALESCE(SUM("amount"), 0) FROM "Repayment" WHERE "loanId" = l."id") AS "paid",
      (SELECT COALESCE(SUM(b."amount"), 0) FROM "RepaymentBreakdown" b
        JOIN "Repayment" r ON r."id" = b."repaymentId" WHERE r."loanId" = l."id") AS "splits"
    FROM "Loan" l WHERE l."id" = ${loanId}`;
  if (!row) throw new NotFoundException('Loan not found');

  const problems: string[] = [];
  if (!row.owed.equals(row.booked)) problems.push(`owed ${row.owed} ≠ disbursed microloans ${row.booked}`);
  if (!row.repaid.equals(row.paid)) problems.push(`repaid ${row.repaid} ≠ repayments ${row.paid}`);
  if (!row.paid.equals(row.splits)) problems.push(`repayments ${row.paid} ≠ their breakdowns ${row.splits}`);
  if (row.repaid.gt(row.owed)) problems.push(`repaid ${row.repaid} > owed ${row.owed}`);
  if (problems.length > 0) throw new LedgerInvariantError(loanId, problems);
}
