import { Prisma } from '@prisma/client';
import { money, ZERO, type Money } from './money';

// The arithmetic of V2.MD §0.5, free of the database so every rule can be tested exactly.
// Services read balances, call these, and write the results.

/** Per-component totals: booked from DISBURSED microloans, or collected from repayment breakdowns. */
export interface Components {
  principal: Money;
  interest: Money;
  penalty: Money;
}

export function total(parts: Components): Money {
  return money(parts.principal.plus(parts.interest).plus(parts.penalty));
}

/** Months still to deduct. Never below 1: after the tenure runs out, the whole balance is due. */
export function remainingMonths(tenure: number, frozenCount: number): number {
  return Math.max(1, tenure - frozenCount);
}

/**
 * The OPEN deduction's amount: what is owed beyond the deductions already sent to payroll
 * (`committed`), spread over the remaining months. The last month takes the exact remainder,
 * so rounding never leaves a kobo behind.
 */
export function openExpected(outstanding: Money, committed: Money, remaining: number): Money {
  const base = Prisma.Decimal.max(0, outstanding.minus(committed));
  return remaining <= 1 ? money(base) : money(base.div(remaining));
}

/** Flat monthly interest booked up front: amount × monthly rate × months. */
export function interestFor(amount: Money, monthlyRate: Prisma.Decimal, months: number): Money {
  return money(amount.mul(monthlyRate).mul(months));
}

/** Taken from the cash handed over, never part of what is owed. */
export function managementFee(principalBooked: Money, rate: Prisma.Decimal): Money {
  return money(principalBooked.mul(rate));
}

export function penaltyFor(shortfall: Money, penaltyRate: Prisma.Decimal): Money {
  return money(shortfall.mul(penaltyRate));
}

/**
 * The ratio method. Charges (penalties) are paid first; the rest splits between interest and
 * principal in the proportion they were booked, then each part is clamped to what is still
 * owed on it, the excess moving to the other part. So a top-up that changes the ratio never
 * over-collects a component, and a payment of everything outstanding clears every component.
 */
export function splitPayment(amount: Money, booked: Components, collected: Components): Components {
  const left = {
    principal: money(booked.principal.minus(collected.principal)),
    interest: money(booked.interest.minus(collected.interest)),
    penalty: money(booked.penalty.minus(collected.penalty)),
  };
  if (amount.lt(0) || amount.gt(total(left))) {
    throw new Error(`Cannot split ${amount.toFixed(2)} against ${total(left).toFixed(2)} outstanding`);
  }

  const penalty = money(Prisma.Decimal.min(amount, left.penalty));
  const rest = money(amount.minus(penalty));
  const base = booked.principal.plus(booked.interest);
  let interest = base.isZero() ? ZERO : money(rest.mul(booked.interest).div(base));
  let principal = money(rest.minus(interest));

  if (interest.gt(left.interest)) {
    principal = money(principal.plus(interest.minus(left.interest)));
    interest = left.interest;
  }
  if (principal.gt(left.principal)) {
    interest = money(interest.plus(principal.minus(left.principal)));
    principal = left.principal;
  }
  return { principal, interest, penalty };
}

/**
 * Months to add to the tenure so the monthly deduction fits under the net-pay cap
 * (V2.MD §0.4-1), or 0 when it already fits. `base` is what the OPEN deduction spreads
 * (outstanding − committed). Measured against the months really left (tenure − frozen, which
 * goes negative once a loan runs past its tenure), so the new tenure always leaves exactly
 * the months needed.
 */
export function capExtension(base: Money, cap: Money, tenure: number, frozenCount: number): number {
  if (cap.lte(0)) return 0;
  const needed = base.div(cap).ceil().toNumber();
  const left = tenure - frozenCount;
  return needed > remainingMonths(tenure, frozenCount) ? needed - left : 0;
}
