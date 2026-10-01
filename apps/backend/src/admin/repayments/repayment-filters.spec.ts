import { BadRequestException } from '@nestjs/common';
import type { FilterRepaymentsDto } from '../common/dto/repayment.dto';
import { buildInflowWhere } from './repayment-filters';

describe('buildInflowWhere', () => {
  it('is empty without filters (pagination is not a filter)', () => {
    expect(buildInflowWhere({ page: 2, limit: 10 })).toEqual({});
  });

  it('filters by state, source, customer, upload and amount range', () => {
    const where = buildInflowWhere({
      state: 'REVIEWING',
      source: 'PAYROLL',
      customerId: 'MB-1',
      uploadId: 'UP-1',
      amountMin: 5000,
      amountMax: 100000,
    } as FilterRepaymentsDto);
    expect(where).toEqual({
      state: 'REVIEWING',
      source: 'PAYROLL',
      customerId: 'MB-1',
      uploadId: 'UP-1',
      amount: { gte: 5000, lte: 100000 },
    });
    expect(buildInflowWhere({ amountMin: 5000 })).toEqual({ amount: { gte: 5000 } });
  });

  it('searches the inflow id, the staff ID and the customer, including a normalised phone number', () => {
    const where = buildInflowWhere({ search: ' 08012345678 ' });
    const contains = { contains: '08012345678', mode: 'insensitive' };
    expect(where.OR).toEqual([
      { id: '08012345678' },
      { externalUserId: contains },
      { customer: { userId: contains } },
      { customer: { externalId: contains } },
      { customer: { user: { name: contains } } },
      { customer: { user: { email: contains } } },
      { customer: { user: { phoneNumber: contains } } },
      { customer: { user: { phoneNumber: '+2348012345678' } } },
    ]);
    expect(buildInflowWhere({ search: 'jane' }).OR).toHaveLength(7);
    expect(buildInflowWhere({ search: '   ' }).OR).toBeUndefined();
  });

  it('filters by payroll month through the period relation', () => {
    expect(buildInflowWhere({ from: '2026-11', to: '2027-02' }).period).toEqual({
      AND: [
        { OR: [{ year: { gt: 2026 } }, { year: 2026, month: { in: ['NOVEMBER', 'DECEMBER'] } }] },
        { OR: [{ year: { lt: 2027 } }, { year: 2027, month: { in: ['JANUARY', 'FEBRUARY'] } }] },
      ],
    });
    expect(buildInflowWhere({ to: '2026-01' }).period).toEqual({
      AND: [{ OR: [{ year: { lt: 2026 } }, { year: 2026, month: { in: ['JANUARY'] } }] }],
    });
  });

  it('400 when from is after to', () => {
    expect(() => buildInflowWhere({ from: '2026-06', to: '2026-01' })).toThrow(BadRequestException);
  });
});
