import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ALREADY_DECIDED } from 'src/ledger/ledger.constants';
import { money, ZERO } from 'src/ledger/money';
import { RepaymentsService } from './repayments.service';

const d = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

function setup() {
  const tx = {
    paymentInflow: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
    customer: { findUnique: jest.fn().mockResolvedValue({ userId: 'MB-1' }) },
    loan: { findFirst: jest.fn().mockResolvedValue({ id: 'LN-1' }) },
    deduction: { findFirst: jest.fn().mockResolvedValue({ id: 'DED-1' }) },
  };
  const prisma = {
    payrollPeriod: { findMany: jest.fn() },
    deduction: { aggregate: jest.fn() },
    paymentInflow: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const ledgerTx = {
    transaction: jest.fn((work: (t: typeof tx) => unknown) => work(tx)),
    audit: jest.fn(),
  };
  const ledger = { allocatePayment: jest.fn() };
  const liquidations = { decide: jest.fn() };
  const periodClose = { close: jest.fn() };
  const periods = {
    ensure: jest.fn(
      ({ year, month }: { year: number; month: string }): Promise<Record<string, unknown>> =>
        Promise.resolve({ id: `P-${year}-${month}`, year, month, variationSubmittedAt: null, variationFilePath: null }),
    ),
  };
  const variations = { preview: jest.fn(), submit: jest.fn() };
  const supabase = { signedUrl: jest.fn().mockResolvedValue('https://signed') };
  const queue = { generateVariationDraft: jest.fn() };
  const notifier = { notify: jest.fn() };
  const clock = { now: () => new Date('2026-07-15T10:00:00Z') };
  const service = new RepaymentsService(
    prisma as never,
    ledgerTx as never,
    ledger as never,
    liquidations as never,
    periodClose as never,
    periods as never,
    variations as never,
    supabase as never,
    queue as never,
    notifier as never,
    clock as never,
  );
  return { service, tx, prisma, ledgerTx, ledger, liquidations, periodClose, periods, variations, supabase, queue, notifier };
}

const payrollInflow = (overrides: object = {}) => ({
  id: 'IN-1',
  source: 'PAYROLL',
  state: 'UNMATCHED',
  amount: d(27500),
  customerId: null,
  periodId: 'P-JUNE',
  period: { year: 2026, month: 'JUNE' },
  repayment: null,
  ...overrides,
});

const allocation = (applied: number, unapplied: number) => ({
  repaymentId: 'RP-1',
  applied: money(applied),
  unapplied: money(unapplied),
  split: { principal: ZERO, interest: ZERO, penalty: ZERO },
  outstanding: money(50000),
  repaid: false,
  deductionStatus: 'FULFILLED',
});

describe('RepaymentsService', () => {
  describe('manual resolution', () => {
    it('APPLY: claims the row, settles the month deduction and tells the customer', async () => {
      const { service, tx, ledger, ledgerTx, notifier } = setup();
      tx.paymentInflow.findUnique.mockResolvedValue(payrollInflow());
      ledger.allocatePayment.mockResolvedValue(allocation(27500, 0));

      const result = await service.resolve('IN-1', { action: 'APPLY', customerId: 'MB-1' }, 'AD-1');

      expect(tx.paymentInflow.updateMany).toHaveBeenCalledWith({
        where: { id: 'IN-1', state: 'UNMATCHED' },
        data: { customerId: 'MB-1' },
      });
      expect(tx.deduction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { loanId: 'LN-1', periodId: 'P-JUNE', status: { in: ['AWAITING', 'PARTIAL'] } },
        }),
      );
      expect(ledger.allocatePayment).toHaveBeenCalledWith(
        { loanId: 'LN-1', amount: d(27500), inflowId: 'IN-1', deductionId: 'DED-1' },
        tx,
      );
      expect(tx.paymentInflow.update).toHaveBeenCalledWith({ where: { id: 'IN-1' }, data: { state: 'SETTLED' } });
      expect(ledgerTx.audit).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: 'PAYMENT_INFLOW_APPROVED', entityType: 'PAYMENT_INFLOW', entityId: 'IN-1' }),
      );
      expect(result).toEqual({
        id: 'IN-1',
        state: 'SETTLED',
        customerId: 'MB-1',
        loanId: 'LN-1',
        applied: 27500,
        unapplied: 0,
        deductionStatus: 'FULFILLED',
      });
      expect(notifier.notify).toHaveBeenCalledWith('MB-1', expect.objectContaining({ title: 'Repayment Received' }));
    });

    it('APPLY: an overpayment stays REVIEWING, and works without a deduction due that month', async () => {
      const { service, tx, ledger, notifier } = setup();
      tx.paymentInflow.findUnique.mockResolvedValue(payrollInflow({ state: 'REVIEWING', customerId: 'MB-1' }));
      tx.deduction.findFirst.mockResolvedValue(null);
      ledger.allocatePayment.mockResolvedValue(allocation(25000, 2500));

      const result = await service.resolve('IN-1', { action: 'APPLY', customerId: 'MB-1' }, 'AD-1');

      expect(ledger.allocatePayment).toHaveBeenCalledWith(expect.objectContaining({ deductionId: undefined }), tx);
      expect(tx.paymentInflow.update).toHaveBeenCalledWith({ where: { id: 'IN-1' }, data: { state: 'REVIEWING' } });
      expect(result).toMatchObject({ state: 'REVIEWING', applied: 25000, unapplied: 2500 });
      expect(notifier.notify.mock.calls[0][1].message).toContain('refund');
    });

    it('APPLY: 409 when the customer has no active loan, 404 when there is no such customer', async () => {
      const { service, tx, ledger } = setup();
      tx.paymentInflow.findUnique.mockResolvedValue(payrollInflow());
      tx.loan.findFirst.mockResolvedValue(null);
      await expect(service.resolve('IN-1', { action: 'APPLY', customerId: 'MB-1' }, 'AD-1')).rejects.toThrow(
        'This customer has no active loan',
      );
      tx.customer.findUnique.mockResolvedValue(null);
      await expect(service.resolve('IN-1', { action: 'APPLY', customerId: 'MB-X' }, 'AD-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ledger.allocatePayment).not.toHaveBeenCalled();
    });

    it('SETTLE: closes an overpayment with the refund in the audit note', async () => {
      const { service, tx, ledgerTx, notifier } = setup();
      tx.paymentInflow.findUnique.mockResolvedValue(
        payrollInflow({ state: 'REVIEWING', customerId: 'MB-1', repayment: { loanId: 'LN-1', amount: d(25000) } }),
      );

      const result = await service.resolve('IN-1', { action: 'SETTLE', note: 'Refunded by transfer' }, 'AD-1');

      expect(tx.paymentInflow.updateMany).toHaveBeenCalledWith({
        where: { id: 'IN-1', state: 'REVIEWING' },
        data: { state: 'SETTLED' },
      });
      const entry = ledgerTx.audit.mock.calls[0][1];
      expect(entry.action).toBe('PAYMENT_INFLOW_APPROVED');
      expect(entry.note).toContain('Refunded by transfer');
      expect(entry.note).toContain('2,500');
      expect(result).toMatchObject({ state: 'SETTLED', loanId: 'LN-1', applied: 25000, unapplied: 2500 });
      expect(notifier.notify).not.toHaveBeenCalled();
    });

    it('SETTLE: 409 when nothing was applied', async () => {
      const { service, tx } = setup();
      tx.paymentInflow.findUnique.mockResolvedValue(payrollInflow({ state: 'REVIEWING' }));
      await expect(service.resolve('IN-1', { action: 'SETTLE', note: 'x' }, 'AD-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.paymentInflow.updateMany).not.toHaveBeenCalled();
    });

    it('REJECT: marks it REJECTED with the note audited', async () => {
      const { service, tx, ledgerTx } = setup();
      tx.paymentInflow.findUnique.mockResolvedValue(payrollInflow());

      const result = await service.resolve('IN-1', { action: 'REJECT', note: 'Not our customer' }, 'AD-1');

      expect(tx.paymentInflow.updateMany).toHaveBeenCalledWith({
        where: { id: 'IN-1', state: 'UNMATCHED' },
        data: { state: 'REJECTED' },
      });
      expect(ledgerTx.audit).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: 'PAYMENT_INFLOW_REJECTED', note: 'Not our customer' }),
      );
      expect(result).toMatchObject({ state: 'REJECTED', applied: 0, unapplied: 27500 });
    });

    it('REJECT: 409 once part of it is applied to a loan', async () => {
      const { service, tx } = setup();
      tx.paymentInflow.findUnique.mockResolvedValue(
        payrollInflow({ state: 'REVIEWING', repayment: { loanId: 'LN-1', amount: d(25000) } }),
      );
      await expect(service.resolve('IN-1', { action: 'REJECT', note: 'x' }, 'AD-1')).rejects.toThrow(
        'refund the rest, then settle it',
      );
    });

    it('compare-and-swap: a second admin gets 409 Already decided', async () => {
      const { service, tx, ledger } = setup();
      tx.paymentInflow.findUnique.mockResolvedValue(payrollInflow());
      tx.paymentInflow.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.resolve('IN-1', { action: 'APPLY', customerId: 'MB-1' }, 'AD-1')).rejects.toThrow(
        ALREADY_DECIDED,
      );
      await expect(service.resolve('IN-1', { action: 'REJECT', note: 'x' }, 'AD-1')).rejects.toThrow(ALREADY_DECIDED);
      expect(ledger.allocatePayment).not.toHaveBeenCalled();
    });

    it('refuses settled rows, liquidations and unknown ids', async () => {
      const { service, tx } = setup();
      tx.paymentInflow.findUnique.mockResolvedValueOnce(payrollInflow({ state: 'SETTLED' }));
      await expect(service.resolve('IN-1', { action: 'REJECT', note: 'x' }, 'AD-1')).rejects.toThrow(
        'This payment is already settled',
      );
      tx.paymentInflow.findUnique.mockResolvedValueOnce(payrollInflow({ source: 'LIQUIDATION', state: 'AWAITING' }));
      await expect(service.resolve('IN-1', { action: 'REJECT', note: 'x' }, 'AD-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      tx.paymentInflow.findUnique.mockResolvedValueOnce(null);
      await expect(service.resolve('IN-1', { action: 'REJECT', note: 'x' }, 'AD-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('overview', () => {
    const row = {
      expected: d('100000.00'),
      collected: d('70000.00'),
      underpaidAmount: d('5000.00'),
      underpaidCount: 1,
      failedAmount: d('25000.00'),
      failedCount: 1,
    };

    it('defaults to the current Lagos month and adds overdue = underpaid + failed', async () => {
      const { service, prisma } = setup();
      prisma.payrollPeriod.findMany.mockResolvedValue([{ id: 'P-JULY' }]);
      prisma.$queryRaw.mockResolvedValue([row]);
      prisma.deduction.aggregate.mockResolvedValue({ _sum: { expected: d('42000.50') } });

      await expect(service.overview({})).resolves.toEqual({
        from: 'JULY 2026',
        to: 'JULY 2026',
        expected: 100000,
        collected: 70000,
        overdue: 30000,
        underpaid: { amount: 5000, count: 1 },
        failed: { amount: 25000, count: 1 },
        currentPeriod: 'JULY 2026',
        expectingThisPeriod: 42000.5,
      });
      expect(prisma.deduction.aggregate).toHaveBeenCalledWith({
        where: { status: 'AWAITING', period: { year: 2026, month: 'JULY' } },
        _sum: { expected: true },
      });
    });

    it('is all zeros when no month in the range exists, and 400 when from is after to', async () => {
      const { service, prisma } = setup();
      prisma.payrollPeriod.findMany.mockResolvedValue([]);
      prisma.deduction.aggregate.mockResolvedValue({ _sum: { expected: null } });
      await expect(service.overview({ from: '2026-01', to: '2026-03' })).resolves.toMatchObject({
        from: 'JANUARY 2026',
        to: 'MARCH 2026',
        expected: 0,
        collected: 0,
        overdue: 0,
        underpaid: { amount: 0, count: 0 },
        failed: { amount: 0, count: 0 },
        expectingThisPeriod: 0,
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      await expect(service.overview({ from: '2026-09' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('payroll variations', () => {
    it('resolves the month from YYYY-MM and turns money into numbers', async () => {
      const { service, periods, variations } = setup();
      variations.preview.mockResolvedValue({
        period: { id: 'P', label: 'JUNE 2026', ym: '2026-06', submittedAt: null, closedAt: null, filePath: null },
        rows: [{ loanId: 'LN-1', balance: money(90000), amount: money(22500), action: 'AMEND' }],
        counts: { START: 0, AMEND: 1, STOP: 0 },
      });

      const preview = await service.variationPreview('2026-06', { action: 'AMEND' });

      expect(periods.ensure).toHaveBeenCalledWith({ year: 2026, month: 'JUNE' });
      expect(variations.preview).toHaveBeenCalledWith('P-2026-JUNE', { action: 'AMEND' });
      expect(preview.period).toEqual({
        id: 'P',
        label: 'JUNE 2026',
        ym: '2026-06',
        submittedAt: null,
        closedAt: null,
        hasFile: false,
      });
      expect(preview.rows[0]).toMatchObject({ balance: 90000, amount: 22500 });
    });

    it('generate: 400 without an email, 409 once submitted, else queues the draft', async () => {
      const { service, periods, queue } = setup();
      await expect(service.generateVariationDraft('2026-06', null, 'AD-1')).rejects.toThrow(
        'Add an email address to send the draft to',
      );
      await expect(service.generateVariationDraft('2026-06', 'pay@x.com', 'AD-1')).resolves.toEqual({
        period: 'JUNE 2026',
        email: 'pay@x.com',
      });
      expect(queue.generateVariationDraft).toHaveBeenCalledWith({
        periodId: 'P-2026-JUNE',
        email: 'pay@x.com',
        requestedById: 'AD-1',
      });
      periods.ensure.mockResolvedValueOnce({ id: 'P', year: 2026, month: 'JUNE', variationSubmittedAt: new Date() });
      await expect(service.generateVariationDraft('2026-06', 'pay@x.com', 'AD-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('file: 404 before submission, then a 10-minute link named after the month', async () => {
      const { service, periods, supabase } = setup();
      await expect(service.variationFileUrl('2026-06')).rejects.toThrow(
        "The JUNE 2026 variation hasn't been submitted yet",
      );
      periods.ensure.mockResolvedValueOnce({ id: 'P', year: 2026, month: 'JUNE', variationFilePath: '2026-06.xlsx' });
      await expect(service.variationFileUrl('2026-06')).resolves.toEqual({ url: 'https://signed', expiresIn: 600 });
      expect(supabase.signedUrl).toHaveBeenCalledWith('variations', '2026-06.xlsx', 600, 'variation-2026-06.xlsx');
    });

    it('submit: passes the period and the admin to the ledger', async () => {
      const { service, variations } = setup();
      variations.submit.mockResolvedValue({
        periodId: 'P-2026-JUNE',
        label: 'JUNE 2026',
        filePath: '2026-06.xlsx',
        counts: { START: 1, AMEND: 0, STOP: 0 },
        frozen: 3,
        opened: 2,
      });
      await expect(service.submitVariation('2026-06', 'AD-1')).resolves.toEqual({
        periodId: 'P-2026-JUNE',
        period: 'JUNE 2026',
        counts: { START: 1, AMEND: 0, STOP: 0 },
        frozen: 3,
        opened: 2,
      });
      expect(variations.submit).toHaveBeenCalledWith('P-2026-JUNE', 'AD-1');
    });
  });

  describe('liquidations and close', () => {
    it('maps the liquidation decision', async () => {
      const { service, liquidations } = setup();
      liquidations.decide.mockResolvedValue({
        inflow: { id: 'IN-2', customerId: 'MB-1', state: 'SETTLED', amount: d(150000) },
        allocation: allocation(150000, 0),
      });
      await expect(service.decideLiquidation('IN-2', true, 'AD-1')).resolves.toEqual({
        id: 'IN-2',
        customerId: 'MB-1',
        state: 'SETTLED',
        amount: 150000,
        applied: 150000,
        outstanding: 50000,
      });
      expect(liquidations.decide).toHaveBeenCalledWith('IN-2', { approve: true }, 'AD-1');

      liquidations.decide.mockResolvedValue({
        inflow: { id: 'IN-2', customerId: 'MB-1', state: 'REJECTED', amount: d(150000) },
        allocation: null,
      });
      await expect(service.decideLiquidation('IN-2', false, 'AD-1', ' Wrong receipt ')).resolves.toMatchObject({
        state: 'REJECTED',
        applied: null,
        outstanding: null,
      });
      expect(liquidations.decide).toHaveBeenLastCalledWith('IN-2', { approve: false, note: 'Wrong receipt' }, 'AD-1');
    });

    it('proof: 404 without one, else a 5-minute link from the proofs bucket', async () => {
      const { service, prisma, supabase } = setup();
      prisma.paymentInflow.findUnique.mockResolvedValueOnce({ proofPath: null });
      await expect(service.proofUrl('IN-2')).rejects.toThrow('This payment has no proof attached');
      prisma.paymentInflow.findUnique.mockResolvedValueOnce({ proofPath: 'MB-1/IN-2.pdf' });
      await expect(service.proofUrl('IN-2')).resolves.toEqual({ url: 'https://signed', expiresIn: 300 });
      expect(supabase.signedUrl).toHaveBeenCalledWith('liquidation-proofs', 'MB-1/IN-2.pdf', 300);
    });

    it('close: resolves the month and closes it as the admin', async () => {
      const { service, periodClose } = setup();
      periodClose.close.mockResolvedValue({ periodId: 'P-2026-JUNE', closed: true });
      await service.closePeriod('2026-06', 'AD-1');
      expect(periodClose.close).toHaveBeenCalledWith('P-2026-JUNE', 'AD-1');
    });
  });
});
