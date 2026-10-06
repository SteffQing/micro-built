import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { loanFiguresMany } from 'src/common/dto/loan.dto';
import { repaymentRates } from 'src/ledger/repayment-rate';
import { CustomerReportService, REPORT_HISTORY_LIMIT } from './customer-report.service';

jest.mock('src/common/dto/loan.dto', () => ({
  ...jest.requireActual('src/common/dto/loan.dto'),
  loanFiguresMany: jest.fn(),
}));
jest.mock('src/ledger/repayment-rate', () => ({ repaymentRates: jest.fn() }));

const dec = (n: number) => new Prisma.Decimal(n);
const NOW = new Date('2026-10-01T09:00:00Z');

const figures = (outstanding: number) => ({
  owed: outstanding + 20_000,
  repaid: 20_000,
  outstanding,
  principal: 100_000,
  interestBooked: 20_000,
  penaltyBooked: 0,
  tenure: 6,
  remainingMonths: 4,
  monthly: outstanding ? 20_000 : null,
});

function loan(id: string, status: string, disbursementDate: Date | null, extra: object = {}) {
  return {
    id,
    status,
    category: 'PERSONAL',
    principal: dec(100_000),
    tenure: 6,
    disbursementDate,
    microLoans: [],
    commodities: [],
    tenureChanges: [],
    ...extra,
  };
}

const customer = {
  userId: 'MB-1',
  externalId: '001234',
  flagReason: 'Two missed months',
  user: { name: 'Ada Obi', email: '2348012345678@phone.microbuiltprime.com', phoneNumber: '+2348012345678', status: 'ACTIVE' },
  payroll: { organization: { name: 'NIGERIAN NAVY' }, command: 'LAGOS' },
  accountOfficer: { userId: 'AD-1', user: { name: 'Jane Admin' } },
};

const assetLoan = loan('LN-1', 'DISBURSED', new Date('2026-05-31T23:30:00Z'), {
  category: 'ASSET_PURCHASE',
  commodities: [
    {
      id: 'CL-1',
      status: 'APPROVED',
      publicDetails: 'HP EliteBook',
      privateDetails: 'Invoice 4411',
      commodity: { name: 'Laptop' },
      microLoan: { purpose: 'NEW_LOAN' },
    },
  ],
  microLoans: [
    {
      id: 'ML-T1',
      purpose: 'TOPUP',
      amount: dec(50_000),
      status: 'DISBURSED',
      createdAt: new Date('2026-08-01T10:00:00Z'),
      disbursedAt: new Date('2026-08-02T10:00:00Z'),
      commodity: null,
    },
    {
      id: 'ML-T2',
      purpose: 'TOPUP',
      amount: dec(10_000),
      status: 'REJECTED',
      createdAt: new Date('2026-08-05T10:00:00Z'),
      disbursedAt: null,
      commodity: null,
    },
    {
      id: 'ML-P1',
      purpose: 'PENALTY',
      amount: dec(1_000),
      status: 'DISBURSED',
      createdAt: new Date('2026-09-01T10:00:00Z'),
      disbursedAt: new Date('2026-09-01T10:00:00Z'),
      commodity: null,
    },
  ],
  tenureChanges: [{ id: 'TC-1' }],
});

const adminStatement = {
  opening: 0,
  debits: 121_000,
  credits: 20_000,
  closing: 101_000,
  lines: [
    { date: new Date('2026-06-01T10:00:00Z'), loanId: 'LN-1', reference: 'ML-1', type: 'DISBURSEMENT', description: 'Loan disbursed', debit: 100_000, credit: 0, balance: 100_000, managementFee: 2_000 },
    { date: new Date('2026-06-01T10:00:00Z'), loanId: 'LN-1', reference: 'ML-2', type: 'INTEREST', description: 'Interest', debit: 20_000, credit: 0, balance: 120_000 },
    { date: new Date('2026-07-28T10:00:00Z'), loanId: 'LN-1', reference: 'RP-1', type: 'REPAYMENT', description: 'Payroll deduction, JULY 2026', debit: 0, credit: 20_000, balance: 100_000, split: { principal: 14_000, interest: 5_000, penalty: 1_000 } },
    { date: new Date('2026-09-01T10:00:00Z'), loanId: 'LN-1', reference: 'ML-P1', type: 'PENALTY', description: 'Penalty', debit: 1_000, credit: 0, balance: 101_000 },
  ],
};

describe('CustomerReportService.build', () => {
  let prisma: {
    customer: { findUnique: jest.Mock };
    loan: { findMany: jest.Mock };
    paymentInflow: { findMany: jest.Mock };
    auditLog: { findMany: jest.Mock };
  };
  const statements = { lines: jest.fn() };
  const clock = { now: () => NOW };
  let service: CustomerReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue(customer) },
      loan: { findMany: jest.fn().mockResolvedValue([assetLoan]) },
      paymentInflow: { findMany: jest.fn().mockResolvedValue([{ id: 'PI-1' }]) },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            action: 'LOAN_DISBURSED',
            note: null,
            createdAt: new Date('2026-06-01T10:00:00Z'),
            actor: { user: { name: 'Jane Admin' } },
          },
        ]),
      },
    };
    statements.lines.mockResolvedValue(adminStatement);
    (loanFiguresMany as jest.Mock).mockResolvedValue(new Map([['LN-1', figures(101_000)]]));
    (repaymentRates as jest.Mock).mockResolvedValue(new Map([['MB-1', 87.5]]));
    service = new CustomerReportService(prisma as never, statements as never, clock as never);
  });

  it('defaults to the month of the first disbursement (Lagos) through the current month', async () => {
    const report = await service.build('MB-1', 'admin');

    // 23:30 UTC on 31 May is June in Lagos.
    expect(statements.lines).toHaveBeenCalledWith(
      { customerId: 'MB-1' },
      { from: { year: 2026, month: 'JUNE' }, to: { year: 2026, month: 'OCTOBER' } },
      'admin',
    );
    expect(report.range).toEqual({ from: '2026-06', to: '2026-10', fromLabel: 'JUNE 2026', toLabel: 'OCTOBER 2026' });
    expect(report.generatedAt).toBe(NOW);
  });

  it('reports only the current month for a customer who never borrowed', async () => {
    prisma.loan.findMany.mockResolvedValue([loan('LN-9', 'PENDING', null)]);
    (loanFiguresMany as jest.Mock).mockResolvedValue(new Map());

    const report = await service.build('MB-1', 'customer');

    expect(report.range).toMatchObject({ from: '2026-10', to: '2026-10' });
    expect(loanFiguresMany).toHaveBeenCalledWith(prisma, []);
    expect(report.loans).toEqual([]);
    expect(report.totals).toEqual({ repaid: 20_000, outstanding: 0, repaymentRate: 87.5 });
  });

  it('gives an admin the revenue, private details, account officer and internal notes', async () => {
    const report = await service.build('MB-1', 'admin', { from: '2026-06', to: '2026-09' });

    expect(report.customer).toEqual({
      id: 'MB-1',
      name: 'Ada Obi',
      externalId: '001234',
      phoneNumber: '+2348012345678',
      email: null,
      organization: 'NIGERIAN NAVY',
      command: 'LAGOS',
      address: null,
      status: 'ACTIVE',
    });
    const [summary] = report.loans;
    expect(summary).toMatchObject({ id: 'LN-1', category: 'ASSET_PURCHASE', outstanding: 101_000 });
    expect(summary.commodity).toEqual({ name: 'Laptop', details: 'HP EliteBook', privateDetails: 'Invoice 4411' });
    // The rejected top-up and the penalty are not top-ups to list.
    expect(summary.topups.map((t) => [t.id, t.amount])).toEqual([['ML-T1', 50_000]]);
    expect(report.totals).toEqual({ repaid: 20_000, outstanding: 101_000, repaymentRate: 87.5 });
    expect(report.revenue).toEqual({
      interestBooked: 20_000,
      interestCollected: 5_000,
      managementFee: 2_000,
      penaltyCharged: 1_000,
      penaltyCollected: 1_000,
    });
    expect(report.accountOfficer).toEqual({ id: 'AD-1', name: 'Jane Admin' });
    expect(report.notes).toEqual({
      flagReason: 'Two missed months',
      history: [
        { action: 'LOAN_DISBURSED', note: null, actorName: 'Jane Admin', createdAt: new Date('2026-06-01T10:00:00Z') },
      ],
    });

    const query = prisma.auditLog.findMany.mock.calls[0][0];
    expect(query.take).toBe(REPORT_HISTORY_LIMIT);
    expect(query.orderBy).toEqual({ createdAt: 'desc' });
    expect(query.where.OR).toEqual([
      { entityType: 'USER', entityId: { in: ['MB-1'] } },
      { entityType: 'LOAN', entityId: { in: ['LN-1'] } },
      { entityType: 'MICRO_LOAN', entityId: { in: ['ML-T1', 'ML-T2', 'ML-P1'] } },
      { entityType: 'COMMODITY_LOAN', entityId: { in: ['CL-1'] } },
      { entityType: 'TENURE_CHANGE', entityId: { in: ['TC-1'] } },
      { entityType: 'PAYMENT_INFLOW', entityId: { in: ['PI-1'] } },
    ]);
  });

  it("leaves every admin-only item out of the customer's copy (absent, not null)", async () => {
    const report = await service.build('MB-1', 'customer', { from: '2026-06', to: '2026-09' });

    expect(statements.lines).toHaveBeenCalledWith({ customerId: 'MB-1' }, expect.anything(), 'customer');
    expect(Object.keys(report)).toEqual(['audience', 'generatedAt', 'range', 'customer', 'loans', 'statement', 'totals']);
    expect('privateDetails' in report.loans[0].commodity!).toBe(false);
    expect(report.loans[0].commodity).toEqual({ name: 'Laptop', details: 'HP EliteBook' });
    expect(JSON.stringify(report)).not.toContain('Invoice 4411');
    expect(JSON.stringify(report)).not.toContain('Two missed months');
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.paymentInflow.findMany).not.toHaveBeenCalled();
  });

  it('lists loans disbursed in or running during the range, and counts every loan as outstanding now', async () => {
    const paidOffBefore = loan('LN-OLD', 'REPAID', new Date('2025-01-10T10:00:00Z'));
    const paidOffInRange = loan('LN-MID', 'REPAID', new Date('2025-02-10T10:00:00Z'));
    const disbursedAfter = loan('LN-NEW', 'DISBURSED', new Date('2026-09-15T10:00:00Z'));
    const pending = loan('LN-PEND', 'PENDING', null);
    prisma.loan.findMany.mockResolvedValue([paidOffBefore, paidOffInRange, assetLoan, disbursedAfter, pending]);
    statements.lines.mockResolvedValue({
      ...adminStatement,
      lines: [...adminStatement.lines, { ...adminStatement.lines[2], loanId: 'LN-MID', reference: 'RP-9' }],
    });
    (loanFiguresMany as jest.Mock).mockResolvedValue(
      new Map([
        ['LN-OLD', figures(0)],
        ['LN-MID', figures(0)],
        ['LN-1', figures(101_000)],
        ['LN-NEW', figures(60_000)],
      ]),
    );

    const report = await service.build('MB-1', 'customer', { from: '2026-06', to: '2026-08' });

    expect(loanFiguresMany).toHaveBeenCalledWith(prisma, [paidOffBefore, paidOffInRange, assetLoan, disbursedAfter]);
    expect(report.loans.map((l) => l.id)).toEqual(['LN-MID', 'LN-1']);
    expect(report.totals.outstanding).toBe(161_000);
  });

  it('404s for an unknown customer', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(service.build('MB-X', 'admin')).rejects.toThrow(new NotFoundException('Customer not found'));
    expect(statements.lines).not.toHaveBeenCalled();
  });

  it('400s when `from` is after `to`, or a month is not YYYY-MM', async () => {
    await expect(service.build('MB-1', 'admin', { from: '2026-09', to: '2026-06' })).rejects.toThrow(
      new BadRequestException('`from` must not be after `to`'),
    );
    // `to` defaults to the current month.
    await expect(service.build('MB-1', 'admin', { from: '2026-11' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.build('MB-1', 'admin', { from: 'June 2026' })).rejects.toBeInstanceOf(BadRequestException);
    expect(statements.lines).not.toHaveBeenCalled();
  });
});
