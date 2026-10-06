import { periodLabel } from '@microbuilt/shared';
import type { Prisma } from '@prisma/client';
import { toNumber } from 'src/ledger/money';
import type { ActivityRows, ActivitySummary } from '../interface/activity';

// A customer's recent-activity feed, built from the ledger's rows: what they submitted, what
// was decided, what was disbursed and what was collected. Newest first.

export const ACTIVITY_LIMIT = 20;

function naira(amount: Prisma.Decimal): string {
  return `₦${toNumber(amount).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function changed(row: { createdAt: Date; updatedAt: Date }): boolean {
  return row.updatedAt.getTime() !== row.createdAt.getTime();
}

function months(delta: number): string {
  const n = Math.abs(delta);
  return `${n} month${n === 1 ? '' : 's'}`;
}

function profileItems(rows: ActivityRows): ActivitySummary[] {
  const items: ActivitySummary[] = [];
  if (rows.user) {
    items.push({
      title: 'Account created',
      description: 'Your account was created.',
      date: rows.user.createdAt,
      source: 'User',
    });
  }
  if (rows.identity) {
    const updated = changed(rows.identity);
    items.push({
      title: 'Identity details',
      description: updated
        ? 'You updated your identity details. They are being reviewed.'
        : 'You submitted your identity details. They are being reviewed.',
      date: rows.identity.updatedAt,
      source: 'UserIdentity',
    });
  }
  if (rows.paymentMethod) {
    const { bankName } = rows.paymentMethod;
    items.push({
      title: 'Bank details',
      description: changed(rows.paymentMethod)
        ? `You updated your bank account (${bankName}).`
        : `You added a bank account (${bankName}).`,
      date: rows.paymentMethod.updatedAt,
      source: 'UserPaymentMethod',
    });
  }
  return items;
}

/** A loan's request, and the decision on it when there was one (disbursement comes from its microloan). */
function loanItems(loan: ActivityRows['loans'][number]): ActivitySummary[] {
  const asset = loan.category === 'ASSET_PURCHASE';
  const what = asset ? 'asset loan request' : `loan request of ${naira(loan.principal)}`;
  const items: ActivitySummary[] = [
    {
      title: 'Loan requested',
      description: `You submitted a ${what}.`,
      date: loan.createdAt,
      source: 'Loan',
    },
  ];
  const decided: Partial<Record<typeof loan.status, Omit<ActivitySummary, 'date' | 'source'>>> = {
    APPROVED: { title: 'Loan approved', description: `Your ${what} was approved and is awaiting disbursement.` },
    REJECTED: { title: 'Loan declined', description: `Your ${what} was declined.` },
    REPAID: { title: 'Loan repaid', description: 'Your loan has been fully repaid.' },
  };
  const decision = decided[loan.status];
  if (decision && changed(loan)) items.push({ ...decision, date: loan.updatedAt, source: 'Loan' });
  return items;
}

function microLoanItem(row: ActivityRows['microLoans'][number]): ActivitySummary | null {
  const amount = naira(row.amount);
  const date = row.disbursedAt ?? row.createdAt;
  if (row.purpose === 'NEW_LOAN') {
    return { title: 'Loan disbursed', description: `Your loan of ${amount} was disbursed.`, date, source: 'Loan' };
  }
  if (row.purpose === 'PENALTY') {
    return {
      title: 'Penalty added',
      description: `A penalty of ${amount} was added to your loan for a missed deduction.`,
      date,
      source: 'Penalty',
    };
  }
  if (row.purpose !== 'TOPUP') return null;

  const extension =
    row.tenureChange && row.tenureChange.monthsDelta !== 0
      ? ` with ${months(row.tenureChange.monthsDelta)} ${row.tenureChange.monthsDelta > 0 ? 'added to' : 'taken off'} your tenure`
      : '';
  // An asset top-up is about the asset: it is named, with its price after it.
  const asset = row.commodity?.commodity.name;
  if (asset) {
    const priced = `the ${asset} (${amount})`;
    const byStatus = {
      PENDING: { title: 'Asset top-up requested', description: `You requested ${priced} as a top-up${extension}.` },
      APPROVED: {
        title: 'Asset top-up approved',
        description: `Your top-up for ${priced}${extension} was approved and is awaiting delivery.`,
      },
      REJECTED: { title: 'Asset top-up declined', description: `Your top-up request for ${priced} was declined.` },
      DISBURSED: {
        title: 'Asset top-up disbursed',
        description: `${priced.charAt(0).toUpperCase()}${priced.slice(1)} was added to your loan${extension}.`,
      },
    };
    return { ...byStatus[row.status], date, source: 'Topup' };
  }

  const byStatus = {
    PENDING: { title: 'Top-up requested', description: `You requested a top-up of ${amount}${extension}.` },
    APPROVED: {
      title: 'Top-up approved',
      description: `Your top-up of ${amount}${extension} was approved and is awaiting disbursement.`,
    },
    REJECTED: { title: 'Top-up declined', description: `Your top-up request of ${amount} was declined.` },
    DISBURSED: { title: 'Top-up disbursed', description: `Your top-up of ${amount}${extension} was disbursed.` },
  };
  return { ...byStatus[row.status], date, source: 'Topup' };
}

function commodityItem(row: ActivityRows['commodities'][number]): ActivitySummary {
  const name = row.commodity.name;
  const byStatus = {
    IN_REVIEW: { title: 'Asset requested', description: `You requested ${name}. It is being reviewed.` },
    APPROVED: { title: 'Asset request approved', description: `Your request for ${name} was approved.` },
    REJECTED: { title: 'Asset request declined', description: `Your request for ${name} was declined.` },
  };
  return { ...byStatus[row.status], date: row.createdAt, source: 'Commodity' };
}

function repaymentItem(row: ActivityRows['repayments'][number]): ActivitySummary {
  const amount = naira(row.amount);
  if (row.paymentInflow.source === 'LIQUIDATION') {
    return {
      title: 'Liquidation applied',
      description: `Your liquidation payment of ${amount} was applied to your loan.`,
      date: row.createdAt,
      source: 'Repayment',
    };
  }
  return {
    title: 'Repayment received',
    description: `${amount} was deducted from your ${periodLabel(row.paymentInflow.period)} salary.`,
    date: row.createdAt,
    source: 'Repayment',
  };
}

function liquidationItem(row: ActivityRows['liquidations'][number]): ActivitySummary {
  const amount = naira(row.amount);
  const description =
    row.state === 'REJECTED'
      ? `Your liquidation request of ${amount} was declined.`
      : row.state === 'SETTLED'
        ? `You requested to liquidate ${amount}.`
        : `You requested to liquidate ${amount}. It is being reviewed.`;
  return { title: 'Liquidation requested', description, date: row.createdAt, source: 'Liquidation' };
}

/** Every row as feed items, newest first, at most `limit`. */
export function buildActivityFeed(rows: ActivityRows, limit = ACTIVITY_LIMIT): ActivitySummary[] {
  const items: ActivitySummary[] = [
    ...profileItems(rows),
    ...rows.loans.flatMap(loanItems),
    ...rows.microLoans.map(microLoanItem).filter((item): item is ActivitySummary => item !== null),
    ...rows.commodities.map(commodityItem),
    ...rows.repayments.map(repaymentItem),
    ...rows.liquidations.map(liquidationItem),
  ];
  return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}
