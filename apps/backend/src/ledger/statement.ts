import { periodLabel, type Period } from '@microbuilt/shared';
import type { Components } from './ledger.math';
import { money, toNumber, ZERO, type Money } from './money';

// A loan statement from the ledger's own rows: what was booked (debits) and what was paid
// (credits), in order, with a running balance. Kept pure so every line is testable.

export type StatementLineType = 'DISBURSEMENT' | 'INTEREST' | 'PENALTY' | 'REPAYMENT';
/** A customer's copy leaves out the management fee and how each payment was split. */
export type StatementAudience = 'admin' | 'customer';

export interface StatementEntry {
  at: Date;
  loanId: string;
  /** The microloan or repayment id. */
  reference: string;
  type: StatementLineType;
  amount: Money;
  /** A DISBURSEMENT of a top-up rather than the loan itself. */
  topup?: boolean;
  /** Where a REPAYMENT came from, and the payroll month it belongs to. */
  source?: 'PAYROLL' | 'LIQUIDATION';
  period?: Period;
  /** On a DISBURSEMENT: kept from the cash handed over, never owed. */
  managementFee?: Money;
  /** On a REPAYMENT. */
  split?: Components;
}

export interface StatementLine {
  date: Date;
  loanId: string;
  reference: string;
  type: StatementLineType;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  managementFee?: number;
  split?: { principal: number; interest: number; penalty: number };
}

export interface Statement {
  opening: number;
  debits: number;
  credits: number;
  closing: number;
  lines: StatementLine[];
}

// Rows written in the same transaction share a timestamp; book before paying.
const ORDER: Record<StatementLineType, number> = { DISBURSEMENT: 0, INTEREST: 1, PENALTY: 2, REPAYMENT: 3 };

function describe(entry: StatementEntry): string {
  switch (entry.type) {
    case 'DISBURSEMENT':
      return entry.topup ? 'Top-up disbursed' : 'Loan disbursed';
    case 'INTEREST':
      return entry.topup ? 'Interest on top-up' : 'Interest';
    case 'PENALTY':
      return 'Penalty on a missed or short deduction';
    case 'REPAYMENT': {
      const what = entry.source === 'LIQUIDATION' ? 'Liquidation' : 'Payroll deduction';
      return entry.period ? `${what}, ${periodLabel(entry.period)}` : what;
    }
  }
}

/** Lines within [start, end); everything earlier folds into the opening balance. */
export function buildStatement(
  entries: StatementEntry[],
  range: { start: Date; end: Date },
  audience: StatementAudience,
): Statement {
  const sorted = [...entries].sort(
    (a, b) => a.at.getTime() - b.at.getTime() || ORDER[a.type] - ORDER[b.type],
  );
  let balance = ZERO;
  let opening = ZERO;
  let debits = ZERO;
  let credits = ZERO;
  const lines: StatementLine[] = [];

  for (const entry of sorted) {
    const isCredit = entry.type === 'REPAYMENT';
    balance = money(isCredit ? balance.minus(entry.amount) : balance.plus(entry.amount));
    if (entry.at < range.start) {
      opening = balance;
      continue;
    }
    if (entry.at >= range.end) break;
    if (isCredit) credits = money(credits.plus(entry.amount));
    else debits = money(debits.plus(entry.amount));

    const line: StatementLine = {
      date: entry.at,
      loanId: entry.loanId,
      reference: entry.reference,
      type: entry.type,
      description: describe(entry),
      debit: isCredit ? 0 : toNumber(entry.amount),
      credit: isCredit ? toNumber(entry.amount) : 0,
      balance: toNumber(balance),
    };
    if (audience === 'admin' && entry.managementFee) line.managementFee = toNumber(entry.managementFee);
    if (audience === 'admin' && entry.split) {
      line.split = {
        principal: toNumber(entry.split.principal),
        interest: toNumber(entry.split.interest),
        penalty: toNumber(entry.split.penalty),
      };
    }
    lines.push(line);
  }

  return {
    opening: toNumber(opening),
    debits: toNumber(debits),
    credits: toNumber(credits),
    closing: toNumber(money(opening.plus(debits).minus(credits))),
    lines,
  };
}
