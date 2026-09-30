import { PayrollVariationFilter } from 'src/common/types/report.interface';
import {
  calculatePayrollVariation,
  payrollChangeTypes,
  filterPayrollVariation,
  PayrollInstruction,
  PreviousPayrollInstruction,
} from './payroll-variation.logic';

const month = new Date('2026-08-31T23:00:00Z');
const instruction = (
  patch: Partial<PayrollInstruction> = {},
): PayrollInstruction => ({
  borrowerId: 'USER-1',
  obligationId: 'OBL-1',
  installmentId: 'INS-1',
  planId: 'PLAN-1',
  externalId: '00123',
  borrowerName: 'Customer One',
  command: 'LAGOS',
  amount: '10000.00',
  contractualOutstanding: '120000.00',
  penaltyOutstanding: '0.00',
  totalOutstanding: '120000.00',
  termRemaining: 12,
  effectiveFromPeriod: '2026-08-31T23:00:00Z',
  endDate: '2027-08-31T22:59:59.999Z',
  sourceEventIds: ['event-1'],
  changeTypes: ['NEW_LOAN'],
  reasons: ['New loan disbursed'],
  ...patch,
});
const prior = (
  patch: Partial<PreviousPayrollInstruction> = {},
): PreviousPayrollInstruction => ({
  ...instruction(),
  id: 'ROW-1',
  action: 'START',
  ...patch,
});

describe('Changes-only payroll comparison', () => {
  it('omits unchanged deductions when balances and remaining months decrease', () => {
    expect(
      calculatePayrollVariation(
        [
          instruction({
            contractualOutstanding: '110000.00',
            totalOutstanding: '110000.00',
            termRemaining: 11,
            installmentId: 'INS-2',
          }),
        ],
        [prior()],
        month,
      ),
    ).toEqual([]);
  });
  it('starts a new deduction only after a payable instruction exists', () => {
    expect(
      calculatePayrollVariation([instruction()], [], month)[0].action,
    ).toBe('START');
    expect(calculatePayrollVariation([], [], month)).toEqual([]);
  });
  it('combines top-up, tenure and liquidation reasons into one final amendment', () => {
    const rows = calculatePayrollVariation(
      [
        instruction({
          amount: '9000.00',
          reasons: [
            'Top-up disbursed',
            'Tenure changed',
            'Liquidation applied',
            'Tenure changed',
          ],
        }),
      ],
      [prior()],
      month,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'AMEND',
      amount: '9000.00',
      previousAmount: '10000.00',
      reasons: ['Top-up disbursed', 'Tenure changed', 'Liquidation applied'],
    });
  });
  it('includes a tenure change even if the deduction amount stays the same', () => {
    expect(
      calculatePayrollVariation(
        [instruction({ endDate: '2027-10-31T22:59:59.999Z' })],
        [prior()],
        month,
      )[0].action,
    ).toBe('AMEND');
  });
  it('stops once, and omits a loan borrowed and liquidated before any submission', () => {
    const stop = instruction({ amount: '0.00', endDate: null });
    expect(calculatePayrollVariation([stop], [prior()], month)[0].action).toBe(
      'STOP',
    );
    expect(
      calculatePayrollVariation(
        [stop],
        [prior({ ...stop, action: 'STOP' })],
        month,
      ),
    ).toEqual([]);
    expect(calculatePayrollVariation([stop], [], month)).toEqual([]);
  });
  it('does not send a stop after the previously instructed end date', () => {
    expect(
      calculatePayrollVariation(
        [instruction({ amount: '0.00' })],
        [prior({ endDate: '2026-08-31T22:59:59.999Z' })],
        month,
      ),
    ).toEqual([]);
  });
  it('sends the return to the normal deduction after a one-month penalty', () => {
    expect(
      calculatePayrollVariation(
        [instruction()],
        [prior({ amount: '15000.00' })],
        month,
      )[0].action,
    ).toBe('AMEND');
  });
  it('rejects duplicate final instructions for a customer', () => {
    expect(() =>
      calculatePayrollVariation([instruction(), instruction()], [], month),
    ).toThrow('More than one');
  });
});

describe('Payroll change categories', () => {
  const rows = () =>
    calculatePayrollVariation(
      [
        instruction({
          borrowerId: 'TOP',
          amount: '12000.00',
          changeTypes: ['TOPUP'],
        }),
        instruction({
          borrowerId: 'BOTH',
          amount: '9000.00',
          changeTypes: ['TOPUP', 'TENURE_CHANGE'],
        }),
        instruction({
          borrowerId: 'ALL',
          amount: '0.00',
          changeTypes: ['TOPUP', 'TENURE_CHANGE', 'LIQUIDATION'],
        }),
        instruction({
          borrowerId: 'OTHER',
          amount: '10500.00',
          changeTypes: [],
        }),
      ],
      ['TOP', 'BOTH', 'ALL', 'OTHER'].map((borrowerId) =>
        prior({ borrowerId }),
      ),
      month,
    );
  it('uses applied event types, independent of display wording', () => {
    expect(
      payrollChangeTypes([
        'TOPUP_DISBURSED',
        'TENURE_CHANGE_REQUESTED',
        'TENURE_CHANGE_APPROVED',
        'LIQUIDATION_REQUESTED',
        'LIQUIDATION_APPLIED',
        'TOPUP_DISBURSED',
        'PAYMENT_RECEIVED',
      ]),
    ).toEqual(['LIQUIDATION', 'TENURE_CHANGE', 'TOPUP']);
  });
  it('keeps the final STOP instruction when a settled customer matches the top-up filter', () => {
    const filtered = filterPayrollVariation(
      rows(),
      PayrollVariationFilter.TOPUP,
    );
    expect(filtered.map((row) => row.borrowerId)).toEqual([
      'TOP',
      'BOTH',
      'ALL',
    ]);
    expect(filtered.find((row) => row.borrowerId === 'ALL')).toMatchObject({
      action: 'STOP',
      amount: '0.00',
    });
  });
  it('requires all three types for combination, while All changes includes uncategorized adjustments', () => {
    expect(
      filterPayrollVariation(rows(), PayrollVariationFilter.COMBINED).map(
        (row) => row.borrowerId,
      ),
    ).toEqual(['ALL']);
    expect(
      filterPayrollVariation(rows(), PayrollVariationFilter.ALL),
    ).toHaveLength(4);
  });
  it('includes legacy first instructions under New loans without inventing review events', () => {
    const changes = calculatePayrollVariation(
      [instruction({ changeTypes: [] })],
      [],
      month,
    );
    expect(
      filterPayrollVariation(changes, PayrollVariationFilter.NEW_LOAN),
    ).toHaveLength(1);
  });
});
