import { describe, expect, it } from 'vitest';
import {
  comparePeriods,
  isPlaceholderEmail,
  nextPeriod,
  normalizeNgPhone,
  parsePeriodLabel,
  parseYm,
  periodLabel,
  placeholderEmail,
  toYm,
  visibleEmail,
} from './index';

describe('normalizeNgPhone', () => {
  it.each([
    ['08012345678', '+2348012345678'],
    ['8012345678', '+2348012345678'],
    ['2348012345678', '+2348012345678'],
    ['+234 801 234 5678', '+2348012345678'],
    ['(0703)-123-4567', '+2347031234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeNgPhone(input)).toBe(expected);
  });

  it.each(['0801234567', '0601234567', '+4478012345678', 'abc'])('rejects %s', (input) => {
    expect(normalizeNgPhone(input)).toBeNull();
  });
});

describe('placeholder email', () => {
  it('is built from the normalized number without +', () => {
    expect(placeholderEmail('08012345678')).toBe('2348012345678@phone.microbuiltprime.com');
  });

  it('is recognised and hidden, real emails are not', () => {
    expect(isPlaceholderEmail('2348012345678@phone.microbuiltprime.com')).toBe(true);
    expect(isPlaceholderEmail('system@system.microbuiltprime.com')).toBe(true);
    expect(isPlaceholderEmail('ada@microbuiltprime.com')).toBe(false);
    expect(visibleEmail('2348012345678@PHONE.microbuiltprime.com')).toBeNull();
    expect(visibleEmail('ada@example.com')).toBe('ada@example.com');
  });
});

describe('periods', () => {
  it('round-trips labels and YYYY-MM', () => {
    const june = parsePeriodLabel('June 2026');
    expect(periodLabel(june)).toBe('JUNE 2026');
    expect(toYm(june)).toBe('2026-06');
    expect(parseYm('2026-06')).toEqual(june);
  });

  it('orders and advances across the year boundary', () => {
    expect(nextPeriod({ year: 2026, month: 'DECEMBER' })).toEqual({ year: 2027, month: 'JANUARY' });
    expect(comparePeriods(parseYm('2026-12'), parseYm('2027-01'))).toBeLessThan(0);
  });

  it('rejects malformed input', () => {
    expect(() => parseYm('2026-13')).toThrow();
    expect(() => parsePeriodLabel('SMARCH 2026')).toThrow();
  });
});
