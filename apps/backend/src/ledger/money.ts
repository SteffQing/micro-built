import { Prisma } from '@prisma/client';

// Every ledger amount is a Prisma.Decimal rounded to kobo (2 dp, half away from zero).
// Floats appear only in response DTOs, through toNumber().
export type Money = Prisma.Decimal;
type MoneyInput = Prisma.Decimal.Value;

export function money(value: MoneyInput): Money {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export const ZERO: Money = money(0);

export function sum(values: Iterable<MoneyInput>): Money {
  let total = new Prisma.Decimal(0);
  for (const value of values) total = total.plus(value);
  return money(total);
}

export function min(a: MoneyInput, b: MoneyInput): Money {
  return money(Prisma.Decimal.min(a, b));
}

export function max(a: MoneyInput, b: MoneyInput): Money {
  return money(Prisma.Decimal.max(a, b));
}

export function toNumber(value: MoneyInput): number {
  return money(value).toNumber();
}

/** For messages people read: ₦136,000.00. */
export function naira(value: MoneyInput): string {
  return `₦${money(value).toNumber().toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
