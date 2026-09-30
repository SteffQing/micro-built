// Payroll periods are calendar months. The API labels them "JUNE 2026" and
// range filters send them as "2026-06". Time-zone math (Africa/Lagos instants)
// belongs to the backend; these helpers only convert between representations.
export const MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
] as const;

export type Month = (typeof MONTHS)[number];

export interface Period {
  year: number;
  month: Month;
}

const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function monthNumber(month: Month): number {
  return MONTHS.indexOf(month) + 1;
}

export function periodLabel(period: Period): string {
  return `${period.month} ${period.year}`;
}

export function parsePeriodLabel(label: string): Period {
  const [month, year] = label.trim().toUpperCase().split(/\s+/);
  if (!MONTHS.includes(month as Month) || !/^\d{4}$/.test(year ?? '')) {
    throw new Error(`Invalid period label: ${label}`);
  }
  return { month: month as Month, year: Number(year) };
}

export function toYm(period: Period): string {
  return `${period.year}-${String(monthNumber(period.month)).padStart(2, '0')}`;
}

export function parseYm(ym: string): Period {
  const match = YM.exec(ym);
  if (!match) throw new Error(`Invalid period (expected YYYY-MM): ${ym}`);
  return { year: Number(match[1]), month: MONTHS[Number(match[2]) - 1] as Month };
}

// Negative when a is earlier than b, 0 when equal.
export function comparePeriods(a: Period, b: Period): number {
  return a.year - b.year || monthNumber(a.month) - monthNumber(b.month);
}

export function nextPeriod(period: Period): Period {
  const index = monthNumber(period.month);
  return index === 12
    ? { year: period.year + 1, month: 'JANUARY' }
    : { year: period.year, month: MONTHS[index] as Month };
}
