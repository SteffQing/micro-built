import { parseDateToPeriod, parsePeriodToDate } from './shared-repayment.logic';

describe('Repayment month formatting', () => {
  it.each(['JANUARY 2027', 'JUNE 2026', 'SEPTEMBER 2026', 'DECEMBER 2026'])(
    'preserves %s when parsing and formatting the start of a Lagos month',
    (period) => {
      expect(parseDateToPeriod(parsePeriodToDate(period))).toBe(period);
    },
  );

  it.each([
    ['2026-08-31T22:59:59.999Z', 'AUGUST 2026'],
    ['2026-08-31T23:00:00.000Z', 'SEPTEMBER 2026'],
    ['2026-12-31T23:00:00.000Z', 'JANUARY 2027'],
  ])('formats %s using the business timezone', (instant, expected) => {
    expect(parseDateToPeriod(new Date(instant))).toBe(expected);
  });
});
