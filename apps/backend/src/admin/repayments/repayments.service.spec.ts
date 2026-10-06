jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
import { BadRequestException, ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
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
    paymentInflow: { findUnique: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null }, _count: 0 }) },
    $queryRaw: jest.fn(),
    user: { findUnique: jest.fn().mockResolvedValue({ name: 'Ada Admin' }) },
    admin: {
      findMany: jest.fn().mockResolvedValue([
        { user: { email: 'boss@example.com', name: 'Boss' } },
        { user: { email: '2348031234567@phone.microbuiltprime.com', name: 'Phone only' } },
      ]),
    },
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
  const variations = { preview: jest.fn(), submit: jest.fn(), revert: jest.fn() };
  const supabase = {
    signedUrl: jest.fn().mockResolvedValue('https://signed'),
    removePrivate: jest.fn().mockResolvedValue(undefined),
    downloadPrivate: jest.fn().mockResolvedValue(Buffer.from('xlsx')),
  };
  const accounts = { assertTwoFactorCode: jest.fn().mockResolvedValue(undefined) };
  const adminNotifier = { notifyAdmins: jest.fn() };
  const mail = { sendLoanScheduleReport: jest.fn(), sendCustomerNotification: jest.fn() };
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
    accounts as never,
    adminNotifier as never,
    mail as never,
  );
  return { service, tx, prisma, ledgerTx, ledger, liquidations, periodClose, periods, variations, supabase, queue, notifier, accounts, adminNotifier, mail };
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
      prisma.$queryRaw.mockResolvedValueOnce([row]).mockResolvedValueOnce([
        {
          payroll: d('70000.00'),
          liquidation: d('5000.00'),
          imported: d('0'),
          receivedCount: 4,
          appliedAmount: d('75000.00'),
          appliedCount: 4,
          principal: d('60000.00'),
          interest: d('14000.00'),
          penalty: d('1000.00'),
        },
      ]);
      prisma.deduction.aggregate.mockResolvedValue({ _sum: { expected: d('42000.50') } });
      prisma.paymentInflow.aggregate.mockResolvedValue({ _sum: { amount: d('3000.00') }, _count: 1 });

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
        received: { amount: 75000, count: 4, bySource: { PAYROLL: 70000, LIQUIDATION: 5000, IMPORT: 0 } },
        applied: { amount: 75000, count: 4, principal: 60000, interest: 14000, penalty: 1000 },
        unresolved: { amount: 3000, count: 1 },
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
        received: { amount: 0, count: 0 },
        applied: { amount: 0, count: 0 },
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
        'Add an email address to your account to receive drafts',
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

    it('submit: passes the period and the admin to the ledger, then tells every super admin', async () => {
      const { service, variations, adminNotifier, mail } = setup();
      variations.submit.mockResolvedValue({
        periodId: 'P-2026-JUNE',
        label: 'JUNE 2026',
        filePath: '2026-06.xlsx',
        counts: { START: 1, AMEND: 0, STOP: 0 },
        rows: 1,
        amount: d('42975'),
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
      await new Promise((resolve) => setImmediate(resolve));
      expect(adminNotifier.notifyAdmins).toHaveBeenCalledWith(
        ['SUPER_ADMIN'],
        expect.objectContaining({ title: 'JUNE 2026 variation generated', ctaUrl: '/dashboard?variation=open' }),
      );
      // The file goes to every super admin with a real email; phone-only placeholders are skipped.
      expect(mail.sendLoanScheduleReport).toHaveBeenCalledTimes(1);
      expect(mail.sendLoanScheduleReport).toHaveBeenCalledWith(
        'boss@example.com',
        { period: 'JUNE 2026', len: 1, amount: 42975, submittedBy: 'Ada Admin' },
        Buffer.from('xlsx'),
      );
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

describe('RepaymentsService lists', () => {
  const borrower = { userId: 'MB-1', externalId: '123456', user: { name: 'Jane Doe' } };

  function listSetup() {
    const s = setup();
    const prisma = s.prisma as unknown as Record<string, Record<string, jest.Mock>>;
    prisma.deduction.findMany = jest.fn();
    prisma.deduction.count = jest.fn();
    prisma.repayment = { findMany: jest.fn(), count: jest.fn() };
    return { service: s.service, prisma };
  }

  it('deductions: sums what was paid, never reports a negative outstanding, labels the month', async () => {
    const { service, prisma } = listSetup();
    const base = {
      loanId: 'LN-1',
      settledAt: null,
      penalizedAt: null,
      period: { year: 2026, month: 'JUNE' },
      loan: { borrower },
    };
    prisma.deduction.findMany.mockResolvedValue([
      { ...base, id: 'D-1', expected: d(25000), status: 'PARTIAL', repayments: [{ amount: d(10000) }, { amount: d(5000.5) }] },
      { ...base, id: 'D-2', expected: d(1000), status: 'FULFILLED', repayments: [{ amount: d(1500) }] },
    ]);
    prisma.deduction.count.mockResolvedValue(2);

    const { rows, total } = await service.listDeductions({ page: 2, limit: 10, status: 'PARTIAL' });

    expect(total).toBe(2);
    expect(prisma.deduction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PARTIAL' }, skip: 10, take: 10 }),
    );
    expect(rows[0]).toMatchObject({
      id: 'D-1',
      period: { ym: '2026-06', label: 'JUNE 2026' },
      customer: { id: 'MB-1', name: 'Jane Doe', externalId: '123456' },
      expected: 25000,
      paid: 15000.5,
      outstanding: 9999.5,
      status: 'PARTIAL',
    });
    expect(rows[1]).toMatchObject({ paid: 1500, outstanding: 0 });
  });

  it('applied: splits each repayment into principal, interest and penalty', async () => {
    const { service, prisma } = listSetup();
    prisma.repayment.findMany.mockResolvedValue([
      {
        id: 'RP-1',
        loanId: 'LN-1',
        paymentInflowId: 'IN-1',
        deductionId: 'D-1',
        amount: d(25000),
        createdAt: new Date('2026-07-01T00:00:00Z'),
        breakdown: [
          { component: 'PRINCIPAL', amount: d(20000) },
          { component: 'INTEREST', amount: d(4000) },
          { component: 'PENALTY', amount: d(1000) },
        ],
        paymentInflow: { source: 'PAYROLL', period: { year: 2026, month: 'JUNE' } },
        loan: { borrower },
      },
    ]);
    prisma.repayment.count.mockResolvedValue(1);

    const { rows, total } = await service.listApplied({ loanId: 'LN-1' });

    expect(total).toBe(1);
    expect(prisma.repayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { loanId: 'LN-1' }, skip: 0, take: 20 }),
    );
    expect(rows[0]).toMatchObject({
      id: 'RP-1',
      source: 'PAYROLL',
      period: { ym: '2026-06', label: 'JUNE 2026' },
      customer: { id: 'MB-1', name: 'Jane Doe', externalId: '123456' },
      amount: 25000,
      principal: 20000,
      interest: 4000,
      penalty: 1000,
      deductionId: 'D-1',
    });
  });
  describe('deduction detail', () => {
    const row = {
      id: 'D-9',
      loanId: 'LN-9',
      expected: d(32090.63),
      settledAt: null,
      penalizedAt: null,
      createdAt: new Date('2026-10-05T08:06:41Z'),
      period: { year: 2026, month: 'OCTOBER' },
      loan: { borrower },
    };
    const balancesRow = {
      loanId: 'LN-9',
      borrowerId: 'MB-1',
      status: 'DISBURSED',
      tenure: 8,
      interestRate: d(0.06),
      managementFeeRate: d(0),
      principalBooked: d(313775),
      interestBooked: d(0),
      penaltyBooked: d(0),
      principalCollected: d(57050),
      interestCollected: d(0),
      penaltyCollected: d(0),
      frozenCount: 0,
      committed: d(0),
    };

    function detailSetup() {
      const s = setup();
      const prisma = s.prisma as unknown as Record<string, unknown> & { deduction: Record<string, jest.Mock> };
      prisma.deduction.findUnique = jest.fn();
      prisma.$queryRaw = jest.fn().mockResolvedValue([balancesRow]);
      return { service: s.service, prisma };
    }

    it('shows how an OPEN deduction is worked out: (outstanding − committed) ÷ months left', async () => {
      const { service, prisma } = detailSetup();
      prisma.deduction.findUnique.mockResolvedValue({ ...row, status: 'OPEN', repayments: [] });

      const detail = await service.deductionDetail('D-9');

      expect(detail).toMatchObject({ id: 'D-9', status: 'OPEN', expected: 32090.63, paid: 0, payments: [] });
      expect(detail.period).toEqual({ ym: '2026-10', label: 'OCTOBER 2026' });
      expect(detail.calculation).toEqual({
        owed: 313775,
        repaid: 57050,
        outstanding: 256725,
        committed: 0,
        toSpread: 256725,
        tenure: 8,
        monthsSent: 0,
        remainingMonths: 8,
        amount: 32090.63,
        stopped: false,
      });
    });

    it('a frozen deduction keeps its amount: no live calculation, payments split like the statement', async () => {
      const { service, prisma } = detailSetup();
      prisma.deduction.findUnique.mockResolvedValue({
        ...row,
        status: 'FULFILLED',
        repayments: [
          {
            id: 'RP-9',
            amount: d(32090.63),
            createdAt: new Date('2026-11-02T00:00:00Z'),
            paymentInflowId: 'IN-9',
            paymentInflow: { source: 'PAYROLL' },
            breakdown: [{ component: 'PRINCIPAL', amount: d(32090.63) }],
          },
        ],
      });

      const detail = await service.deductionDetail('D-9');

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(detail.calculation).toBeNull();
      expect(detail).toMatchObject({ paid: 32090.63, outstanding: 0 });
      expect(detail.payments).toEqual([
        expect.objectContaining({ id: 'RP-9', paymentInflowId: 'IN-9', principal: 32090.63, interest: 0, penalty: 0 }),
      ]);
    });

    it('404s an unknown deduction', async () => {
      const { service, prisma } = detailSetup();
      prisma.deduction.findUnique.mockResolvedValue(null);
      await expect(service.deductionDetail('nope')).rejects.toThrow('Deduction not found');
    });
  });

  describe('revertVariation', () => {
    it('checks the authenticator code before touching anything', async () => {
      const { service, accounts, variations } = setup();
      accounts.assertTwoFactorCode.mockRejectedValue(new ForbiddenException('That code is not correct'));
      await expect(service.revertVariation('2026-10', '000000', 'Submitted by mistake', 'AD-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(variations.revert).not.toHaveBeenCalled();
    });

    it('reverts the month and removes the stored file', async () => {
      const { service, accounts, variations, supabase } = setup();
      variations.revert.mockResolvedValue({
        periodId: 'P-2026-OCTOBER',
        label: 'OCTOBER 2026',
        filePath: '2026-10.xlsx',
        reopened: 5,
        removed: 5,
      });
      await expect(service.revertVariation('2026-10', '123456', 'Submitted by mistake', 'AD-1')).resolves.toEqual({
        periodId: 'P-2026-OCTOBER',
        period: 'OCTOBER 2026',
        reopened: 5,
        removed: 5,
      });
      expect(accounts.assertTwoFactorCode).toHaveBeenCalledWith('AD-1', '123456');
      expect(variations.revert).toHaveBeenCalledWith('P-2026-OCTOBER', 'AD-1', 'Submitted by mistake');
      expect(supabase.removePrivate).toHaveBeenCalledWith('variations', '2026-10.xlsx');
    });
  });
});
