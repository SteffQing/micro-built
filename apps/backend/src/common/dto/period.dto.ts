import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { comparePeriods, monthNumber, MONTHS, parseYm, type Period } from '@microbuilt/shared';
import type { Prisma } from '@prisma/client';
import { IsOptional, Matches } from 'class-validator';
import { periodBounds } from 'src/ledger/period';

// Payroll months in requests are YYYY-MM (V2.MD §0.2); responses label them "JUNE 2026"
// (periodLabel from @microbuilt/shared). Combine with pagination through
// IntersectionType(PaginatedQueryDto, PeriodRangeQueryDto) from @nestjs/swagger.

export const YM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const YM_MESSAGE = '$property must be a month as YYYY-MM';

/** One payroll month, required: `?period=2026-06`. */
export class PeriodQueryDto {
  @ApiProperty({ example: '2026-06', description: 'Payroll month (YYYY-MM)' })
  @Matches(YM_PATTERN, { message: YM_MESSAGE })
  period: string;
}

/** `?from=2026-01&to=2026-06`, both inclusive and both optional. */
export class PeriodRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-01', description: 'First payroll month (YYYY-MM), inclusive' })
  @IsOptional()
  @Matches(YM_PATTERN, { message: YM_MESSAGE })
  from?: string;

  @ApiPropertyOptional({ example: '2026-06', description: 'Last payroll month (YYYY-MM), inclusive' })
  @IsOptional()
  @Matches(YM_PATTERN, { message: YM_MESSAGE })
  to?: string;
}

/** A range with either end open (absent = unbounded on that side). */
export interface PeriodRange {
  from?: Period;
  to?: Period;
}

/** Parses the query; 400 when `from` is after `to`. The caller fills in defaults it needs. */
export function parsePeriodRange(query: { from?: string; to?: string }): PeriodRange {
  const range: PeriodRange = {
    from: query.from ? parseYm(query.from) : undefined,
    to: query.to ? parseYm(query.to) : undefined,
  };
  if (range.from && range.to && comparePeriods(range.from, range.to) > 0) {
    throw new BadRequestException('`from` must not be after `to`');
  }
  return range;
}

/**
 * Instants for a DateTime column (e.g. MicroLoan.disbursedAt): Lagos midnight on the 1st of
 * `from` up to, not including, Lagos midnight after `to`. Undefined when the range is open on
 * both sides, so it can be dropped straight into a `where`.
 */
export function instantRange(range: PeriodRange): Prisma.DateTimeFilter | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from && { gte: periodBounds(range.from).start }),
    ...(range.to && { lt: periodBounds(range.to).end }),
  };
}

/**
 * The Period rows inside the range, for relations filtered by period (PaymentInflow,
 * Deduction): `{ period: periodWhere(range) }`. Prisma can't compare enum values, so each end
 * is "a later year, or this year and one of these months".
 */
export function periodWhere(range: PeriodRange): Prisma.PeriodWhereInput {
  const bounds: Prisma.PeriodWhereInput[] = [];
  if (range.from) {
    const { year, month } = range.from;
    bounds.push({
      OR: [{ year: { gt: year } }, { year, month: { in: MONTHS.slice(monthNumber(month) - 1) } }],
    });
  }
  if (range.to) {
    const { year, month } = range.to;
    bounds.push({
      OR: [{ year: { lt: year } }, { year, month: { in: MONTHS.slice(0, monthNumber(month)) } }],
    });
  }
  return { AND: bounds };
}
