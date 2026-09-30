import { Prisma } from '@prisma/client';
import { max, min, money, sum, toNumber, ZERO } from './money';

describe('money', () => {
  it('rounds to kobo, half away from zero', () => {
    expect(money('1666.665').toFixed(2)).toBe('1666.67');
    expect(money('1666.664').toFixed(2)).toBe('1666.66');
    expect(money('-0.005').toFixed(2)).toBe('-0.01');
    expect(money(12).toFixed(2)).toBe('12.00');
  });

  it('keeps Decimal precision where floats drift', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sum(['0.1', '0.2']).toFixed(2)).toBe('0.30');
    expect(money(new Prisma.Decimal(100000).div(6)).toFixed(2)).toBe('16666.67');
  });

  it('splits a payment by the booked ratio without losing a kobo (V2.MD §0.5)', () => {
    // ₦100,000 principal + ₦20,000 interest booked; ₦10,000 paid.
    const paid = money(10000);
    const interest = money(paid.mul(20000).div(120000));
    const principal = money(paid.minus(interest));
    expect(interest.toFixed(2)).toBe('1666.67');
    expect(principal.toFixed(2)).toBe('8333.33');
    expect(sum([interest, principal]).equals(paid)).toBe(true);
  });

  it('sums, and sums nothing to zero', () => {
    expect(sum([money('10.10'), '20.20', 30]).toFixed(2)).toBe('60.30');
    expect(sum([]).equals(ZERO)).toBe(true);
  });

  it('picks the smaller or larger amount', () => {
    expect(min('5.00', '4.99').toFixed(2)).toBe('4.99');
    expect(max('5.00', '4.99').toFixed(2)).toBe('5.00');
  });

  it('turns an amount into a number only for DTOs', () => {
    expect(toNumber(money('8333.33'))).toBe(8333.33);
    expect(toNumber('0.125')).toBe(0.13);
  });
});
