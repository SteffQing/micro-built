import { BadRequestException } from '@nestjs/common';
import type { FilterRepaymentsDto } from '../common/dto/repayment.dto';
import { buildAppliedWhere, buildDeductionWhere, buildInflowWhere } from './repayment-filters';

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

describe('buildDeductionWhere', () => {
  const contains = { contains: 'jane', mode: 'insensitive' };

  it('is empty without filters', () => {
    expect(buildDeductionWhere({ page: 1, limit: 20 })).toEqual({});
  });

  it('filters by status and customer (through the loan)', () => {
    expect(buildDeductionWhere({ status: 'PARTIAL', customerId: 'MB-1' })).toEqual({
      status: 'PARTIAL',
      loan: { borrowerId: 'MB-1' },
    });
  });

  it('searches the loan id and the borrower', () => {
    const where = buildDeductionWhere({ search: ' jane ' });
    expect(where.OR).toHaveLength(6);
    expect(where.OR?.[0]).toEqual({ loanId: contains });
    expect(where.OR?.[3]).toEqual({ loan: { borrower: { user: { name: contains } } } });
  });

  it('one period replaces from..to', () => {
    const where = buildDeductionWhere({ period: '2026-06', from: '2020-01' });
    expect(where.period).toEqual(buildInflowWhere({ from: '2026-06', to: '2026-06' }).period);
  });

  it('400 when from is after to', () => {
    expect(() => buildDeductionWhere({ from: '2026-06', to: '2026-01' })).toThrow(BadRequestException);
  });
});

describe('buildAppliedWhere', () => {
  it('is empty without filters', () => {
    expect(buildAppliedWhere({ page: 1, limit: 20 })).toEqual({});
  });

  it('filters by loan and customer, and by the payment month through the inflow', () => {
    const where = buildAppliedWhere({ loanId: 'LN-1', customerId: 'MB-1', to: '2026-01' });
    expect(where.loanId).toBe('LN-1');
    expect(where.loan).toEqual({ borrowerId: 'MB-1' });
    expect(where.paymentInflow).toEqual({
      period: { AND: [{ OR: [{ year: { lt: 2026 } }, { year: 2026, month: { in: ['JANUARY'] } }] }] },
    });
  });

  it('searches the loan id, the payment id and the borrower', () => {
    const where = buildAppliedWhere({ search: 'jane' });
    expect(where.OR).toHaveLength(7);
    expect(where.OR?.[1]).toEqual({ paymentInflowId: 'jane' });
  });
});
