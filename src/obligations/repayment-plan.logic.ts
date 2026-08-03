import { Prisma } from '@prisma/client';
import { addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { createHash } from 'crypto';

export const MONEY_ZERO = new Prisma.Decimal(0);

export type PlanPolicyName =
  | 'INITIAL_PLAN'
  | 'TOPUP_CONSOLIDATION'
  | 'DEFAULT_EXTENSION'
  | 'MANUAL_TENURE_CHANGE'
  | 'PENALTY_ADJUSTMENT'
  | 'LIQUIDATION_RECAST'
  | 'MIGRATION_BASELINE';

export interface PlanCalculationInput {
  scheduledBalance: Prisma.Decimal.Value;
  penaltyBalance?: Prisma.Decimal.Value;
  termMonths: number;
  effectiveFrom: Date;
}

export interface CalculatedInstallment {
  sequence: number;
  period: Date;
  dueDate: Date;
  scheduledAmount: Prisma.Decimal;
  penaltyDue: Prisma.Decimal;
  totalExpected: Prisma.Decimal;
}

export interface CalculatedPlan {
  scheduledBalance: Prisma.Decimal;
  penaltyBalance: Prisma.Decimal;
  termMonths: number;
  scheduledMonthly: Prisma.Decimal;
  effectiveFromPeriod: Date;
  endDate: Date;
  installments: CalculatedInstallment[];
}

export function calculateFuturePlanBalances(input: {
  contractualOutstanding: Prisma.Decimal.Value;
  penaltyOutstanding: Prisma.Decimal.Value;
  frozenContractual: Prisma.Decimal.Value;
  frozenPenalty: Prisma.Decimal.Value;
}) {
  const frozenContractual = money(input.frozenContractual);
  const frozenPenalty = money(input.frozenPenalty);
  return {
    contractual: money(
      Prisma.Decimal.max(
        new Prisma.Decimal(input.contractualOutstanding).sub(frozenContractual),
        0,
      ),
    ),
    penalty: money(
      Prisma.Decimal.max(
        new Prisma.Decimal(input.penaltyOutstanding).sub(frozenPenalty),
        0,
      ),
    ),
    frozenContractual,
    frozenPenalty,
  };
}

export function money(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
}

export function canonicalPeriod(value: Date): Date {
  return startOfMonth(value);
}

export function nextPayrollPeriod(value: Date): Date {
  return startOfMonth(addMonths(value, 1));
}

export function calculateRepaymentPlan(
  input: PlanCalculationInput,
): CalculatedPlan {
  const scheduledBalance = money(input.scheduledBalance);
  const penaltyBalance = money(input.penaltyBalance ?? 0);
  const effectiveFromPeriod = canonicalPeriod(input.effectiveFrom);

  if (scheduledBalance.lt(0)) {
    throw new Error('Scheduled balance cannot be negative');
  }
  if (!Number.isInteger(input.termMonths) || input.termMonths < 1) {
    throw new Error('Term must be a positive whole number of months');
  }
  if (penaltyBalance.lt(0)) {
    throw new Error('Penalty balance cannot be negative');
  }

  if (scheduledBalance.eq(0) && penaltyBalance.eq(0)) {
    throw new Error('A repayment plan must have an outstanding balance');
  }

  // A penalty is not capitalized or spread over a contractual tenure. When the
  // contract is fully repaid but a penalty remains, publish one penalty-only
  // installment so payroll and the ledger still use the same due row.
  const termMonths = scheduledBalance.eq(0) ? 1 : input.termMonths;

  const scheduledMonthly = scheduledBalance.eq(0)
    ? MONEY_ZERO
    : money(scheduledBalance.div(termMonths));
  const installments: CalculatedInstallment[] = [];
  let scheduledSoFar = MONEY_ZERO;

  for (let index = 0; index < termMonths; index++) {
    const isFinal = index === termMonths - 1;
    const scheduledAmount = isFinal
      ? money(scheduledBalance.sub(scheduledSoFar))
      : scheduledMonthly;
    const penaltyDue = index === 0 ? penaltyBalance : MONEY_ZERO;
    const period = addMonths(effectiveFromPeriod, index);

    installments.push({
      sequence: index + 1,
      period,
      dueDate: endOfMonth(period),
      scheduledAmount,
      penaltyDue,
      totalExpected: money(scheduledAmount.add(penaltyDue)),
    });
    scheduledSoFar = scheduledSoFar.add(scheduledAmount);
  }

  const totalScheduled = installments.reduce(
    (total, installment) => total.add(installment.scheduledAmount),
    MONEY_ZERO,
  );
  if (!totalScheduled.eq(scheduledBalance)) {
    throw new Error('Plan installments do not reconcile to scheduled balance');
  }

  return {
    scheduledBalance,
    penaltyBalance,
    termMonths,
    scheduledMonthly,
    effectiveFromPeriod,
    endDate: installments[installments.length - 1].dueDate,
    installments,
  };
}

export function stableHash(value: unknown): string {
  const canonicalize = (item: unknown): unknown => {
    if (item instanceof Date) return item.toISOString();
    if (Prisma.Decimal.isDecimal(item)) return item.toFixed(2);
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item && typeof item === 'object') {
      return Object.keys(item as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = canonicalize((item as Record<string, unknown>)[key]);
          return result;
        }, {});
    }
    return item;
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}
