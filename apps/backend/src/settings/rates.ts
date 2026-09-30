import { Prisma } from '@prisma/client';

// Rates are stored as fractions (0.0525) and exchanged with clients as percentages (5.25).

export function toPercent(rate: Prisma.Decimal | null): number | null {
  return rate === null ? null : rate.mul(100).toNumber();
}

export function fromPercent(percent: number): Prisma.Decimal {
  return new Prisma.Decimal(percent).div(100);
}
