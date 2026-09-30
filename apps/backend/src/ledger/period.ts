import {
  MONTHS,
  monthNumber,
  parsePeriodLabel,
  parseYm,
  type Month,
  type Period,
} from '@microbuilt/shared';

// The time-zone side of payroll periods. Labels, YYYY-MM parsing, ordering and nextPeriod
// live in @microbuilt/shared. Africa/Lagos is UTC+1 all year (no daylight saving), so a
// fixed offset is exact, and hosts in any time zone agree on every boundary.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Excel date serials count days from 1899-12-30.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** The payroll month an instant falls in, on the Lagos calendar. */
export function lagosMonthOf(date: Date): Period {
  const lagos = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return { year: lagos.getUTCFullYear(), month: MONTHS[lagos.getUTCMonth()] as Month };
}

/** Lagos midnight on the 1st of the month (`start`) and of the next month (`end`, exclusive). */
export function periodBounds(period: Period): { start: Date; end: Date } {
  const index = monthNumber(period.month) - 1;
  return {
    start: new Date(Date.UTC(period.year, index, 1) - LAGOS_OFFSET_MS),
    end: new Date(Date.UTC(period.year, index + 1, 1) - LAGOS_OFFSET_MS),
  };
}

/** Whole months from `from` to `to`; negative when `to` is earlier. */
export function monthsBetween(from: Period, to: Period): number {
  return (to.year - from.year) * 12 + monthNumber(to.month) - monthNumber(from.month);
}

/**
 * Reads the Period column of a payroll sheet: an Excel date serial (any day of the month),
 * a label such as "JUNE 2026" in any case, or "2026-06".
 */
export function periodFromPayrollCell(value: unknown): Period {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('Period column is empty');
  if (/^\d+(\.\d+)?$/.test(raw)) {
    // A serial is a calendar date without a time zone, so read it on the UTC calendar.
    const date = new Date(EXCEL_EPOCH_MS + Math.floor(Number(raw)) * DAY_MS);
    return { year: date.getUTCFullYear(), month: MONTHS[date.getUTCMonth()] as Month };
  }
  if (/^\d{4}-\d{2}$/.test(raw)) return parseYm(raw);
  return parsePeriodLabel(raw);
}
