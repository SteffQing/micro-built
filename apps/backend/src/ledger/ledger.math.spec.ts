import { Prisma } from '@prisma/client';
import {
  capExtension,
  interestFor,
  managementFee,
  openExpected,
  penaltyFor,
  remainingMonths,
  repriceInterest,
  splitPayment,
  total,
  type Components,
} from './ledger.math';
import { money, sum, ZERO, type Money } from './money';

const d = (value: Prisma.Decimal.Value) => money(value);
const parts = (principal: string, interest: string, penalty = '0'): Components => ({
  principal: d(principal),
  interest: d(interest),
  penalty: d(penalty),
});
const fixed = (c: Components) => [c.principal.toFixed(2), c.interest.toFixed(2), c.penalty.toFixed(2)];

// The deduction life cycle of V2.MD §0.5 on one loan, with the same functions the services use:
// submit freezes the OPEN month and opens the next; a payment settles a frozen month; closing a
// month charges its shortfall.
type Status = 'OPEN' | 'AWAITING' | 'FULFILLED' | 'PARTIAL' | 'FAILED';
class LoanCycle {
  months: { status: Status; expected: Money; paid: Money }[] = [];
  repaid = ZERO;

  constructor(
    public owed: Money,
    public tenure: number,
  ) {
    this.months.push({ status: 'OPEN', expected: ZERO, paid: ZERO });
    this.refresh();
  }

  get outstanding() {
    return money(this.owed.minus(this.repaid));
  }
  get frozen() {
    return this.months.filter((m) => m.status !== 'OPEN').length;
  }
  get committed() {
    return sum(this.months.filter((m) => m.status === 'AWAITING').map((m) => m.expected));
  }
  get open() {
    return this.months.find((m) => m.status === 'OPEN');
  }

  refresh() {
    const open = this.open;
    if (open) open.expected = openExpected(this.outstanding, this.committed, remainingMonths(this.tenure, this.frozen));
  }

  /** Sends the OPEN month to payroll; returns the amount sent. */
  submit(): Money {
    const open = this.open!;
    open.status = 'AWAITING';
    if (this.outstanding.gt(0)) this.months.push({ status: 'OPEN', expected: ZERO, paid: ZERO });
    this.refresh();
    return open.expected;
  }

  /** Payroll pays month `index` (0-based) `amount`, capped at what is outstanding. */
  pay(index: number, amount?: Money) {
    const month = this.months[index];
    const applied = money(Prisma.Decimal.min(amount ?? month.expected, this.outstanding));
    this.repaid = money(this.repaid.plus(applied));
    month.paid = money(month.paid.plus(applied));
    month.status = month.paid.gte(month.expected) ? 'FULFILLED' : 'PARTIAL';
    this.refresh();
  }

  close(index: number, penaltyRate: Prisma.Decimal) {
    const month = this.months[index];
    if (month.status === 'AWAITING') month.status = 'FAILED';
    const shortfall = money(Prisma.Decimal.max(0, month.expected.minus(month.paid)));
    this.owed = money(this.owed.plus(penaltyFor(shortfall, penaltyRate)));
    this.refresh();
  }
}

describe('₦100,000 at 6 % a month over 6 months', () => {
  const principal = d(100000);
  const interest = interestFor(principal, new Prisma.Decimal('0.06'), 6);
  const owed = money(principal.plus(interest));

  it('books ₦36,000 interest, so ₦136,000 is owed', () => {
    expect(interest.toFixed(2)).toBe('36000.00');
    expect(owed.toFixed(2)).toBe('136000.00');
    expect(openExpected(owed, ZERO, 6).toFixed(2)).toBe('22666.67');
  });

  it('keeps the amount last sent when the next split differs from it by rounding alone', () => {
    const sent = d('22666.67');
    // (136,000 − 22,666.67) ÷ 5 = 22,666.666 → 22,666.67: equal anyway.
    expect(openExpected(owed, sent, 5, sent).toFixed(2)).toBe('22666.67');
    // 96,272.5 ÷ 3 = 32,090.83 against 32,090.84 sent: kept.
    expect(openExpected(d('96272.5'), ZERO, 3, d('32090.84')).toFixed(2)).toBe('32090.84');
    // A real change still goes through.
    expect(openExpected(d('96272.5'), ZERO, 3, d('30000')).toFixed(2)).toBe('32090.83');
    // The last month always takes the exact remainder.
    expect(openExpected(d('32090.80'), ZERO, 1, d('32090.84')).toFixed(2)).toBe('32090.80');
  });

  const expectInstallments = (sent: Money[]) => {
    expect(sent).toHaveLength(6);
    for (const amount of sent) expect(amount.minus('22666.67').abs().lte('0.01')).toBe(true);
    expect(sum(sent).toFixed(2)).toBe('136000.00');
  };

  it('sends six installments that sum to exactly ₦136,000 when each month is paid before the next is sent', () => {
    const loan = new LoanCycle(owed, 6);
    const sent: Money[] = [];
    for (let month = 0; month < 6; month++) {
      sent.push(loan.submit());
      loan.pay(month);
    }
    expectInstallments(sent);
    expect(loan.outstanding.isZero()).toBe(true);
  });

  it('does the same when payroll pays a month late', () => {
    const loan = new LoanCycle(owed, 6);
    const sent = [loan.submit()];
    for (let month = 1; month < 6; month++) {
      sent.push(loan.submit());
      loan.pay(month - 1);
    }
    loan.pay(5);
    expectInstallments(sent);
    expect(loan.outstanding.isZero()).toBe(true);
  });

  it('does the same when every month is sent before any payment lands', () => {
    const loan = new LoanCycle(owed, 6);
    const sent = Array.from({ length: 6 }, () => loan.submit());
    for (let month = 0; month < 6; month++) loan.pay(month);
    expectInstallments(sent);
    expect(loan.outstanding.isZero()).toBe(true);
    // Everything was committed, so the month after the last is a STOP (0).
    expect(loan.open?.expected.isZero() ?? true).toBe(true);
  });

  it('underpayment is charged at close and raises the next months, with the tenure unchanged', () => {
    const loan = new LoanCycle(owed, 6);
    loan.submit();
    loan.pay(0, d(10000));
    // The shortfall is re-spread as soon as the short payment lands…
    expect(loan.open!.expected.toFixed(2)).toBe('25200.00');
    loan.close(0, new Prisma.Decimal('0.1'));
    // …and the ₦1,266.67 penalty (10 % of ₦12,666.67) follows at close.
    expect(loan.owed.toFixed(2)).toBe('137266.67');
    expect(loan.open!.expected.toFixed(2)).toBe('25453.33');
    expect(loan.tenure).toBe(6);
  });

  it('a month that got nothing becomes FAILED at close and its amount moves into the open month', () => {
    const loan = new LoanCycle(owed, 6);
    loan.submit();
    expect(loan.open!.expected.toFixed(2)).toBe('22666.67');
    loan.close(0, new Prisma.Decimal('0.1'));
    expect(loan.months[0].status).toBe('FAILED');
    // 136,000 + 2,266.67 penalty over the 5 months left.
    expect(loan.open!.expected.toFixed(2)).toBe('27653.33');
  });
});

describe('remainingMonths / openExpected', () => {
  it('never drops below one month, and the last month takes the exact remainder', () => {
    expect(remainingMonths(6, 0)).toBe(6);
    expect(remainingMonths(6, 6)).toBe(1);
    expect(remainingMonths(6, 9)).toBe(1);
    expect(openExpected(d('100.01'), ZERO, 1).toFixed(2)).toBe('100.01');
    expect(openExpected(d('100.01'), ZERO, 3).toFixed(2)).toBe('33.34');
  });

  it('is 0 when payroll already has everything that is owed', () => {
    expect(openExpected(d(1000), d(1000), 3).isZero()).toBe(true);
    expect(openExpected(d(800), d(1000), 3).isZero()).toBe(true);
  });
});

describe('interest, fees and penalties', () => {
  it('books top-up interest on the months left', () => {
    const rate = new Prisma.Decimal('0.06');
    expect(interestFor(d(50000), rate, remainingMonths(6, 2)).toFixed(2)).toBe('12000.00');
    // With a +2 tenure change approved alongside, applied first.
    expect(interestFor(d(50000), rate, remainingMonths(8, 2)).toFixed(2)).toBe('18000.00');
  });

  it('takes the management fee from the cash, rounded to kobo', () => {
    expect(managementFee(d(100000), new Prisma.Decimal('0.025')).toFixed(2)).toBe('2500.00');
    expect(managementFee(d('33333.33'), new Prisma.Decimal('0.025')).toFixed(2)).toBe('833.33');
  });

  it('charges the penalty on the shortfall', () => {
    expect(penaltyFor(d('12666.67'), new Prisma.Decimal('0.1')).toFixed(2)).toBe('1266.67');
    expect(penaltyFor(ZERO, new Prisma.Decimal('0.1')).isZero()).toBe(true);
  });
});

describe('splitPayment (ratio method)', () => {
  const booked = parts('100000', '20000');
  const nothing = parts('0', '0');

  it('splits by the booked ratio: ₦10,000 → ₦8,333.33 principal, ₦1,666.67 interest', () => {
    expect(fixed(splitPayment(d(10000), booked, nothing))).toEqual(['8333.33', '1666.67', '0.00']);
  });

  it('pays charges first', () => {
    const withPenalty = parts('100000', '20000', '1500');
    expect(fixed(splitPayment(d(1000), withPenalty, nothing))).toEqual(['0.00', '0.00', '1000.00']);
    expect(fixed(splitPayment(d(13500), withPenalty, nothing))).toEqual(['10000.00', '2000.00', '1500.00']);
    expect(fixed(splitPayment(d(1000), withPenalty, parts('0', '0', '1500')))).toEqual(['833.33', '166.67', '0.00']);
  });

  it('clamps a component that is nearly paid (after a top-up changed the ratio) and moves the rest', () => {
    // Interest is all but collected; the booked ratio would still ask ₦264.71 of it.
    const split = splitPayment(d(1000), parts('100000', '36000'), parts('60000', '35990'));
    expect(fixed(split)).toEqual(['990.00', '10.00', '0.00']);
  });

  it('clears every component exactly when everything outstanding is paid', () => {
    // 100k + 20k booked, 60k paid at the old ratio; then a 100k top-up with 4k interest.
    const after = parts('200000', '24000', '1266.67');
    const collected = parts('50000', '10000');
    const outstanding = total(after).minus(total(collected));
    const split = splitPayment(money(outstanding), after, collected);
    expect(fixed(split)).toEqual(['150000.00', '14000.00', '1266.67']);
  });

  it('never splits more than is outstanding', () => {
    expect(() => splitPayment(d('120000.01'), booked, nothing)).toThrow();
    expect(total(splitPayment(d(120000), booked, nothing)).toFixed(2)).toBe('120000.00');
  });

  it('always adds up to the amount paid', () => {
    for (const amount of ['0.01', '1', '333.33', '9999.99', '45678.91', '119999.99']) {
      expect(total(splitPayment(d(amount), booked, nothing)).toFixed(2)).toBe(d(amount).toFixed(2));
    }
  });
});

describe('capExtension', () => {
  it('proposes the fewest extra months that bring the monthly deduction under the cap', () => {
    // ₦104,600 over 4 months left is ₦26,150; a ₦20,000 cap needs 6 months, so +2.
    expect(capExtension(d(104600), d(20000), 6, 2)).toBe(2);
    const newTenure = 6 + 2;
    expect(openExpected(d(104600), ZERO, remainingMonths(newTenure, 2)).lte(20000)).toBe(true);
  });

  it('counts the months really left once a loan has run past its tenure', () => {
    // Tenure 6 with 8 months already sent: 2 over. ₦30,000 at a ₦10,000 cap needs 3 months → tenure 11.
    expect(capExtension(d(30000), d(10000), 6, 8)).toBe(5);
    expect(remainingMonths(6 + 5, 8)).toBe(3);
  });

  it('proposes nothing when the deduction already fits, or with no cap', () => {
    expect(capExtension(d(30000), d(40000), 6, 5)).toBe(0);
    expect(capExtension(d(60000), d(20000), 6, 3)).toBe(0);
    expect(capExtension(d(60000), ZERO, 6, 3)).toBe(0);
  });
});

describe('repriceInterest: months added to a ₦50,000 loan at 6 % (₦6,000 interest over 2 months)', () => {
  const rate = d('0.06');
  const booked = parts('50000', '6000');

  it('charges the whole principal for a month added before anything is paid or sent: ₦3,000 (₦56,000 → ₦59,000)', () => {
    expect(repriceInterest(booked, parts('0', '0'), ZERO, rate, 1)).toEqual(d('3000'));
  });

  it('charges only the principal left once a month is paid: ₦28,000 paid is ₦25,000 principal, so ₦1,500', () => {
    const collected = splitPayment(d('28000'), booked, parts('0', '0'));
    expect(collected.principal).toEqual(d('25000'));
    expect(repriceInterest(booked, collected, ZERO, rate, 1)).toEqual(d('1500'));
  });

  it('treats a month sent to payroll but not yet paid as paid: same ₦1,500', () => {
    expect(repriceInterest(booked, parts('0', '0'), d('28000'), rate, 1)).toEqual(d('1500'));
  });

  it('books nothing when shortening', () => {
    expect(repriceInterest(booked, parts('0', '0'), ZERO, rate, -1)).toEqual(ZERO);
  });
});
