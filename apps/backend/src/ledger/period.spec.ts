import { MONTHS, nextPeriod, type Period } from '@microbuilt/shared';
import { lagosMonthOf, monthsBetween, periodBounds, periodFromPayrollCell } from './period';

const DAY_MS = 24 * 60 * 60 * 1000;
const excelSerial = (year: number, monthIndex: number, day: number) =>
  (Date.UTC(year, monthIndex, day) - Date.UTC(1899, 11, 30)) / DAY_MS;

describe('lagosMonthOf', () => {
  it('turns the month at Lagos midnight, an hour before UTC', () => {
    expect(lagosMonthOf(new Date('2025-12-31T22:59:59.999Z'))).toEqual({ year: 2025, month: 'DECEMBER' });
    expect(lagosMonthOf(new Date('2025-12-31T23:00:00.000Z'))).toEqual({ year: 2026, month: 'JANUARY' });
    expect(lagosMonthOf(new Date('2026-06-30T23:30:00.000Z'))).toEqual({ year: 2026, month: 'JULY' });
  });
});

describe('periodBounds', () => {
  it('starts and ends at Lagos midnight', () => {
    const { start, end } = periodBounds({ year: 2026, month: 'DECEMBER' });
    expect(start.toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-31T23:00:00.000Z');
  });

  it('covers exactly the instants lagosMonthOf puts in the period, every month', () => {
    for (const month of MONTHS) {
      const period: Period = { year: 2026, month };
      const { start, end } = periodBounds(period);
      expect(lagosMonthOf(start)).toEqual(period);
      expect(lagosMonthOf(new Date(end.getTime() - 1))).toEqual(period);
      expect(lagosMonthOf(end)).toEqual(nextPeriod(period));
      expect(lagosMonthOf(new Date(start.getTime() - 1))).not.toEqual(period);
    }
  });
});

describe('monthsBetween', () => {
  it('counts across a year end, and backwards', () => {
    expect(monthsBetween({ year: 2025, month: 'DECEMBER' }, { year: 2026, month: 'JANUARY' })).toBe(1);
    expect(monthsBetween({ year: 2026, month: 'JUNE' }, { year: 2026, month: 'JUNE' })).toBe(0);
    expect(monthsBetween({ year: 2026, month: 'JANUARY' }, { year: 2027, month: 'MARCH' })).toBe(14);
    expect(monthsBetween({ year: 2026, month: 'MARCH' }, { year: 2026, month: 'JANUARY' })).toBe(-2);
  });
});

describe('periodFromPayrollCell', () => {
  const june2026 = { year: 2026, month: 'JUNE' };

  it('reads Excel date serials, as numbers or text, on any day of the month', () => {
    expect(periodFromPayrollCell(excelSerial(2026, 5, 1))).toEqual(june2026);
    expect(periodFromPayrollCell(String(excelSerial(2026, 5, 30)))).toEqual(june2026);
    expect(periodFromPayrollCell(excelSerial(2026, 5, 15) + 0.75)).toEqual(june2026);
    expect(periodFromPayrollCell(excelSerial(2025, 11, 31))).toEqual({ year: 2025, month: 'DECEMBER' });
  });

  it('reads month labels and YYYY-MM', () => {
    expect(periodFromPayrollCell('JUNE 2026')).toEqual(june2026);
    expect(periodFromPayrollCell(' june   2026 ')).toEqual(june2026);
    expect(periodFromPayrollCell('2026-06')).toEqual(june2026);
  });

  it('rejects anything else', () => {
    expect(() => periodFromPayrollCell('')).toThrow('Period column is empty');
    expect(() => periodFromPayrollCell(null)).toThrow('Period column is empty');
    expect(() => periodFromPayrollCell('Smarch 2026')).toThrow();
    expect(() => periodFromPayrollCell('2026-13')).toThrow();
  });
});
