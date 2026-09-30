import { money } from './money';
import { periodBounds } from './period';
import { buildStatement, type StatementEntry } from './statement';

const at = (iso: string) => new Date(iso);
const entries: StatementEntry[] = [
  {
    at: at('2099-01-10T09:00:00Z'),
    loanId: 'LN-1',
    reference: 'm-loan',
    type: 'DISBURSEMENT',
    amount: money(100000),
    managementFee: money(2500),
  },
  { at: at('2099-01-10T09:00:00Z'), loanId: 'LN-1', reference: 'm-interest', type: 'INTEREST', amount: money(36000) },
  {
    at: at('2099-02-05T09:00:00Z'),
    loanId: 'LN-1',
    reference: 'r-jan',
    type: 'REPAYMENT',
    amount: money('22666.67'),
    source: 'PAYROLL',
    period: { year: 2099, month: 'JANUARY' },
    split: { principal: money('16666.67'), interest: money(6000), penalty: money(0) },
  },
  { at: at('2099-03-05T09:00:00Z'), loanId: 'LN-1', reference: 'm-penalty', type: 'PENALTY', amount: money('1266.67') },
  {
    at: at('2099-03-20T09:00:00Z'),
    loanId: 'LN-1',
    reference: 'r-liq',
    type: 'REPAYMENT',
    amount: money(10000),
    source: 'LIQUIDATION',
    period: { year: 2099, month: 'MARCH' },
    split: { principal: money('7352.94'), interest: money('2647.06'), penalty: money(0) },
  },
];
const range = (from: 'JANUARY' | 'FEBRUARY', to: 'MARCH' | 'DECEMBER') => ({
  start: periodBounds({ year: 2099, month: from }).start,
  end: periodBounds({ year: 2099, month: to }).end,
});

describe('buildStatement', () => {
  it('lists bookings as debits and payments as credits with a running balance', () => {
    const statement = buildStatement(entries, range('JANUARY', 'DECEMBER'), 'admin');
    expect(statement.lines.map((line) => [line.type, line.debit, line.credit, line.balance])).toEqual([
      ['DISBURSEMENT', 100000, 0, 100000],
      ['INTEREST', 36000, 0, 136000],
      ['REPAYMENT', 0, 22666.67, 113333.33],
      ['PENALTY', 1266.67, 0, 114600],
      ['REPAYMENT', 0, 10000, 104600],
    ]);
    expect(statement).toMatchObject({ opening: 0, debits: 137266.67, credits: 32666.67, closing: 104600 });
  });

  it('folds earlier activity into the opening balance and stops at the end of the range', () => {
    const statement = buildStatement(entries, range('FEBRUARY', 'MARCH'), 'admin');
    expect(statement.opening).toBe(136000);
    expect(statement.lines.map((line) => line.reference)).toEqual(['r-jan', 'm-penalty', 'r-liq']);
    expect(statement.closing).toBe(104600);

    const januaryOnly = buildStatement(entries, { start: range('JANUARY', 'MARCH').start, end: periodBounds({ year: 2099, month: 'JANUARY' }).end }, 'admin');
    expect(januaryOnly.lines).toHaveLength(2);
    expect(januaryOnly.closing).toBe(136000);
  });

  it('books before paying when rows share a moment, whatever order they arrive in', () => {
    const shuffled = [entries[1], entries[4], entries[0], entries[3], entries[2]];
    const types = buildStatement(shuffled, range('JANUARY', 'DECEMBER'), 'admin').lines.map((line) => line.type);
    expect(types.slice(0, 2)).toEqual(['DISBURSEMENT', 'INTEREST']);
  });

  it('describes each line for people', () => {
    const descriptions = buildStatement(entries, range('JANUARY', 'DECEMBER'), 'admin').lines.map((l) => l.description);
    expect(descriptions).toEqual([
      'Loan disbursed',
      'Interest',
      'Payroll deduction, JANUARY 2099',
      'Penalty on a missed or short deduction',
      'Liquidation, MARCH 2099',
    ]);
  });

  it("shows admins the management fee and each payment's split, and customers neither", () => {
    const admin = buildStatement(entries, range('JANUARY', 'DECEMBER'), 'admin').lines;
    expect(admin[0].managementFee).toBe(2500);
    expect(admin[2].split).toEqual({ principal: 16666.67, interest: 6000, penalty: 0 });

    const customer = buildStatement(entries, range('JANUARY', 'DECEMBER'), 'customer').lines;
    for (const line of customer) {
      expect(line).not.toHaveProperty('managementFee');
      expect(line).not.toHaveProperty('split');
    }
  });
});
