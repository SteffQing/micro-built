import { Prisma } from '@prisma/client';
import {
  calculateFuturePlanBalances,
  calculatePlanPeriodSnapshot,
  calculateRepaymentPlan,
  canonicalPeriod,
  money,
  nextPayrollPeriod,
  stableHash,
} from './repayment-plan.logic';

describe('repayment plan policy', () => {
  it('implements Charles longer-tenor top-up example without calculation drift', () => {
    const plan = calculateRepaymentPlan({
      scheduledBalance: '614666.00',
      penaltyBalance: 0,
      termMonths: 12,
      effectiveFrom: new Date(2026, 7, 1),
    });

    expect(plan.termMonths).toBe(12);
    expect(plan.scheduledMonthly.toFixed(2)).toBe('51222.17');
    expect(plan.installments[11].scheduledAmount.toFixed(2)).toBe('51222.13');
    expect(
      plan.installments
        .reduce(
          (total, installment) => total.add(installment.scheduledAmount),
          new Prisma.Decimal(0),
        )
        .toFixed(2),
    ).toBe('614666.00');
  });

  it('keeps penalty separate and due without capitalizing it', () => {
    const plan = calculateRepaymentPlan({
      scheduledBalance: '120000.00',
      penaltyBalance: '5000.00',
      termMonths: 3,
      effectiveFrom: new Date(2026, 8, 1),
    });

    expect(plan.scheduledMonthly.toFixed(2)).toBe('40000.00');
    expect(plan.installments[0].penaltyDue.toFixed(2)).toBe('5000.00');
    expect(plan.installments[0].totalExpected.toFixed(2)).toBe('45000.00');
    expect(plan.installments[1].totalExpected.toFixed(2)).toBe('40000.00');
  });

  it('keeps a historical variation on its plan snapshot after later top-ups', () => {
    const plan = calculateRepaymentPlan({
      scheduledBalance: '600000.00',
      penaltyBalance: '2000.00',
      termMonths: 12,
      effectiveFrom: new Date(2026, 7, 1),
    });

    const august = calculatePlanPeriodSnapshot({
      termMonths: plan.termMonths,
      currentSequence: 1,
      installments: plan.installments,
    });
    expect(august.contractualOutstanding.toFixed(2)).toBe('600000.00');
    expect(august.penaltyOutstanding.toFixed(2)).toBe('2000.00');
    expect(august.termRemaining).toBe(12);
    expect(august.endDate.toISOString()).toBe('2027-07-31T22:59:59.999Z');

    const september = calculatePlanPeriodSnapshot({
      termMonths: plan.termMonths,
      currentSequence: 2,
      installments: plan.installments,
    });
    expect(september.contractualOutstanding.toFixed(2)).toBe('550000.00');
    expect(september.penaltyOutstanding.toFixed(2)).toBe('0.00');
    expect(september.termRemaining).toBe(11);
  });

  it('rejects invalid terms and non-positive balances', () => {
    expect(() =>
      calculateRepaymentPlan({
        scheduledBalance: 100,
        termMonths: 0,
        effectiveFrom: new Date(),
      }),
    ).toThrow('Term must be a positive whole number');

    expect(() =>
      calculateRepaymentPlan({
        scheduledBalance: 0,
        termMonths: 1,
        effectiveFrom: new Date(),
      }),
    ).toThrow('A repayment plan must have an outstanding balance');
  });

  it('creates one penalty-only installment after contractual settlement', () => {
    const plan = calculateRepaymentPlan({
      scheduledBalance: 0,
      penaltyBalance: 2500,
      termMonths: 12,
      effectiveFrom: new Date(2026, 7, 1),
    });

    expect(plan.termMonths).toBe(1);
    expect(plan.scheduledMonthly.toFixed(2)).toBe('0.00');
    expect(plan.installments).toHaveLength(1);
    expect(plan.installments[0].totalExpected.toFixed(2)).toBe('2500.00');
  });

  it('does not schedule a published-but-unsettled deduction twice', () => {
    const balances = calculateFuturePlanBalances({
      contractualOutstanding: '614666.00',
      penaltyOutstanding: '5000.00',
      frozenContractual: '51222.17',
      frozenPenalty: '1000.00',
    });

    expect(balances.contractual.toFixed(2)).toBe('563443.83');
    expect(balances.penalty.toFixed(2)).toBe('4000.00');
  });

  it('rounds money consistently and hashes key-order independently', () => {
    expect(money('10.005').toFixed(2)).toBe('10.01');
    expect(stableHash({ b: 2, a: 1 })).toBe(stableHash({ a: 1, b: 2 }));
  });

  it('uses one Lagos payroll-month key regardless of worker timezone', () => {
    const september = canonicalPeriod(
      new Date('2026-09-15T12:00:00.000Z'),
    );

    expect(september.toISOString()).toBe('2026-08-31T23:00:00.000Z');
    expect(canonicalPeriod(september).toISOString()).toBe(
      '2026-08-31T23:00:00.000Z',
    );
    expect(nextPayrollPeriod(september).toISOString()).toBe(
      '2026-09-30T23:00:00.000Z',
    );
  });
});
