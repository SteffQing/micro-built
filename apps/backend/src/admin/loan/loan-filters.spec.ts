import { buildCashLoanWhere, buildCommodityLoanWhere } from './loan-filters';

describe('buildCashLoanWhere', () => {
  it('lists every category except asset loans by default', () => {
    expect(buildCashLoanWhere({})).toEqual({ category: { not: 'ASSET_PURCHASE' } });
  });

  it('maps the filters onto v2 fields', () => {
    const where = buildCashLoanWhere({
      status: 'DISBURSED',
      category: 'RENT',
      principalMin: 50000,
      principalMax: 500000,
      hasPenalties: true,
      hasCommodityLoan: false,
    });
    expect(where).toEqual({
      category: 'RENT',
      status: 'DISBURSED',
      principal: { gte: 50000, lte: 500000 },
      microLoans: { some: { purpose: 'PENALTY', status: 'DISBURSED' } },
      commodities: { none: { status: 'APPROVED' } },
    });
  });

  it('never lets asset loans in through the category (exports skip validation)', () => {
    expect(buildCashLoanWhere({ category: 'ASSET_PURCHASE' }).category).toEqual({ not: 'ASSET_PURCHASE' });
  });

  it('bounds dates by the Lagos calendar day, from Dates or ISO strings', () => {
    const where = buildCashLoanWhere({
      disbursementStart: new Date('2026-06-01'),
      requestedEnd: '2026-05-31T00:00:00.000Z' as unknown as Date,
    });
    expect(where.disbursementDate).toEqual({ gte: new Date('2026-05-31T23:00:00.000Z') });
    expect(where.createdAt).toEqual({ lt: new Date('2026-05-31T23:00:00.000Z') });
  });

  it('searches the loan id and the customer, matching phone numbers as typed or normalised', () => {
    const where = buildCashLoanWhere({ search: '08012345678' });
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { id: { contains: '08012345678', mode: 'insensitive' } },
        { borrower: { externalId: { contains: '08012345678', mode: 'insensitive' } } },
        { borrower: { user: { name: { contains: '08012345678', mode: 'insensitive' } } } },
        { borrower: { user: { phoneNumber: '+2348012345678' } } },
      ]),
    );
  });
});

describe('buildCommodityLoanWhere', () => {
  it('is empty without filters', () => {
    expect(buildCommodityLoanWhere({})).toEqual({});
  });

  it('maps inReview onto the request status', () => {
    expect(buildCommodityLoanWhere({ inReview: true })).toEqual({ status: 'IN_REVIEW' });
    expect(buildCommodityLoanWhere({ inReview: false })).toEqual({ status: { not: 'IN_REVIEW' } });
  });

  it('combines status, search and dates', () => {
    const where = buildCommodityLoanWhere({ status: 'APPROVED', search: 'laptop', requestedStart: new Date('2026-05-01') });
    expect(where.AND).toEqual([
      { status: 'APPROVED' },
      {
        OR: expect.arrayContaining([
          { commodity: { name: { contains: 'laptop', mode: 'insensitive' } } },
          { loan: { borrower: { user: { email: { contains: 'laptop', mode: 'insensitive' } } } } },
        ]),
      },
      { createdAt: { gte: new Date('2026-04-30T23:00:00.000Z') } },
    ]);
  });
});
