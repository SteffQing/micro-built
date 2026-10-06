import { Prisma } from '@prisma/client';
import type { ActivityRows } from '../interface/activity';
import { buildActivityFeed } from './activity';

const at = new Date('2026-10-06T10:00:00Z');

function rows(microLoans: ActivityRows['microLoans']): ActivityRows {
  return {
    user: null,
    identity: null,
    paymentMethod: null,
    loans: [],
    microLoans,
    commodities: [],
    repayments: [],
    liquidations: [],
  };
}

const topup = {
  loanId: 'LN-1',
  purpose: 'TOPUP' as const,
  amount: new Prisma.Decimal(250000),
  createdAt: at,
  disbursedAt: at,
  tenureChange: null,
};

describe('buildActivityFeed: top-ups', () => {
  it('names the asset, then its price, for an asset top-up', () => {
    const [item] = buildActivityFeed(
      rows([{ ...topup, status: 'DISBURSED', commodity: { commodity: { name: 'Solar Inverter' } } }]),
    );
    expect(item).toMatchObject({
      title: 'Asset top-up disbursed',
      description: 'The Solar Inverter (₦250,000) was added to your loan.',
      source: 'Topup',
    });
  });

  it('leaves out a tenure change that was rejected, and names one that applied', () => {
    const [dropped] = buildActivityFeed(
      rows([{ ...topup, status: 'DISBURSED', commodity: null, tenureChange: { monthsDelta: 1, status: 'REJECTED' } }]),
    );
    expect(dropped.description).toBe('Your top-up of ₦250,000 was disbursed.');
    const [applied] = buildActivityFeed(
      rows([{ ...topup, status: 'DISBURSED', commodity: null, tenureChange: { monthsDelta: 1, status: 'APPROVED' } }]),
    );
    expect(applied.description).toBe('Your top-up of ₦250,000 with 1 month added to your tenure was disbursed.');
  });

  it('keeps the amount wording for a cash top-up', () => {
    const [item] = buildActivityFeed(rows([{ ...topup, status: 'DISBURSED', commodity: null }]));
    expect(item).toMatchObject({ title: 'Top-up disbursed', description: 'Your top-up of ₦250,000 was disbursed.' });
  });
});
