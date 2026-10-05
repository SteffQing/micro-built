import { Logger } from '@nestjs/common';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { captureJobError } from 'src/common/observability';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerEvents, type LedgerEventName, type LedgerEventPayloads } from 'src/ledger/ledger.events';
import { AdminNotifierService } from 'src/notifications/admin-notifier.service';
import { CustomerNotifierService } from 'src/notifications/customer-notifier.service';
import { LedgerListeners } from './ledger.listeners';

jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));

const loan = { loanId: 'LN-1', borrowerId: 'MB-1' };
const DECIDERS = ['ADMIN', 'SUPER_ADMIN'];

describe('LedgerListeners', () => {
  const customers = { notify: jest.fn() };
  const admins = { notifyAdmins: jest.fn() };
  const prisma = { user: { findUnique: jest.fn() }, tenureChange: { findUnique: jest.fn() } };
  let moduleRef: TestingModule;
  let events: EventEmitter2;
  let listeners: LedgerListeners;

  // Through the emitter, so the @OnEvent wiring is what's under test.
  const emit = <K extends LedgerEventName>(name: K, payload: LedgerEventPayloads[K]) => events.emitAsync(name, payload);
  const notified = () => customers.notify.mock.calls.map(([userId, message]) => ({ userId, ...message }));

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        LedgerListeners,
        { provide: CustomerNotifierService, useValue: customers },
        { provide: AdminNotifierService, useValue: admins },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    await moduleRef.init();
    events = moduleRef.get(EventEmitter2);
    listeners = moduleRef.get(LedgerListeners);
  });

  afterAll(() => moduleRef.close());

  beforeEach(() => {
    jest.clearAllMocks();
    customers.notify.mockResolvedValue(undefined);
    admins.notifyAdmins.mockResolvedValue(undefined);
    prisma.user.findUnique.mockResolvedValue({ name: 'Ada Obi' });
    prisma.tenureChange.findUnique.mockResolvedValue({ status: 'PENDING', requestedBy: null });
  });

  it('listens to every ledger event', () => {
    for (const name of Object.values(LedgerEvents)) expect(events.listeners(name)).toHaveLength(1);
  });

  it('tells the customer a loan was disbursed, with the amount and the monthly deduction', async () => {
    await emit('loan.disbursed', { ...loan, principal: 500000, interest: 90000, owed: 590000, monthly: 49166.67 });
    expect(notified()).toEqual([
      {
        userId: 'MB-1',
        title: 'Loan Disbursed',
        message: expect.stringMatching(/loan of ₦500,000 has been disbursed\. ₦49,166\.67 will be deducted/),
      },
    ]);
    expect(admins.notifyAdmins).not.toHaveBeenCalled();
  });

  it('tells the customer how a top-up was decided, with the reason for a rejection', async () => {
    await emit('topup.decided', { ...loan, microLoanId: 'ml-1', amount: 100000, approved: true });
    await emit('topup.decided', { ...loan, microLoanId: 'ml-2', amount: 50000, approved: false, note: 'Net pay too low' });
    expect(notified()).toEqual([
      { userId: 'MB-1', title: 'Top-up Approved', message: expect.stringContaining('₦100,000 has been approved') },
      {
        userId: 'MB-1',
        title: 'Top-up Rejected',
        message: expect.stringMatching(/₦50,000 has been rejected\. Reason: Net pay too low$/),
      },
    ]);
  });

  it('tells the customer a top-up was disbursed and the new monthly deduction', async () => {
    await emit('topup.disbursed', { ...loan, microLoanId: 'ml-1', amount: 100000, interest: 18000, monthly: 61000 });
    expect(notified()).toEqual([
      {
        userId: 'MB-1',
        title: 'Top-up Disbursed',
        message: expect.stringMatching(/₦100,000 has been disbursed\. Your monthly deduction is now ₦61,000\./),
      },
    ]);
  });

  it('tells the customer about a penalty and why', async () => {
    const note = 'SEPTEMBER 2026: ₦12,000.00 short × 5%';
    await emit('penalty.applied', { ...loan, microLoanId: 'ml-9', amount: 600, note });
    expect(notified()).toEqual([
      { userId: 'MB-1', title: 'Penalty Applied', message: expect.stringContaining(`₦600 has been added`) },
    ]);
    expect(notified()[0].message).toContain(`(${note})`);
  });

  it('tells every deciding admin, not the customer, about a proposal the system made after a default', async () => {
    await emit('tenure-change.proposed', { ...loan, changeId: 'tc-1', monthsDelta: 2, reason: 'DEFAULT', bySystem: true });
    expect(customers.notify).not.toHaveBeenCalled();
    expect(admins.notifyAdmins).toHaveBeenCalledWith(DECIDERS, {
      title: 'Tenure Change Proposed',
      message: expect.stringMatching(/^The system proposed extending Ada Obi's loan by 2 months after a missed deduction/),
      ctaUrl: '/loans/tenure-changes',
    });
  });

  it('names the admin who proposed a change, and the customer behind a top-up’s change', async () => {
    prisma.tenureChange.findUnique.mockResolvedValueOnce({
      status: 'PENDING',
      requestedBy: { user: { name: 'Bola Admin' } },
    });
    await emit('tenure-change.proposed', { ...loan, changeId: 'tc-2', monthsDelta: -1, reason: 'ADMIN', bySystem: false });
    await emit('tenure-change.proposed', { ...loan, changeId: 'tc-3', monthsDelta: 3, reason: 'TOPUP', bySystem: true });
    const messages = admins.notifyAdmins.mock.calls.map(([, notification]) => notification.message);
    expect(messages).toEqual([
      "Bola Admin proposed shortening Ada Obi's loan by 1 month.",
      "The customer proposed extending Ada Obi's loan by 3 months with a top-up request; it is decided with the top-up.",
    ]);
  });

  it('says nothing about a proposal already decided (an admin proposed and applied it at once)', async () => {
    prisma.tenureChange.findUnique.mockResolvedValueOnce({
      status: 'APPROVED',
      requestedBy: { user: { name: 'Bola Admin' } },
    });
    await emit('tenure-change.proposed', { ...loan, changeId: 'tc-4', monthsDelta: 2, reason: 'ADMIN', bySystem: false });
    expect(admins.notifyAdmins).not.toHaveBeenCalled();
  });

  it('tells the customer the new tenure, and the admins only when the loan got longer', async () => {
    await emit('tenure-change.approved', { ...loan, changeId: 'tc-1', monthsDelta: 2, tenure: 14 });
    expect(notified()).toEqual([
      {
        userId: 'MB-1',
        title: 'Loan Tenure Updated',
        message: expect.stringContaining('extended by 2 months and is now 14 months'),
      },
    ]);
    expect(admins.notifyAdmins).toHaveBeenCalledWith(DECIDERS, {
      title: 'Loan Duration Increased',
      message: "Ada Obi's loan was extended by 2 months and now runs 14 months.",
      ctaUrl: '/loans/tenure-changes',
    });

    jest.clearAllMocks();
    await emit('tenure-change.approved', { ...loan, changeId: 'tc-2', monthsDelta: -1, tenure: 11 });
    expect(notified()).toEqual([
      expect.objectContaining({ message: expect.stringContaining('shortened by 1 month and is now 11 months') }),
    ]);
    expect(admins.notifyAdmins).not.toHaveBeenCalled();
  });

  it('tells nobody about a rejected change', async () => {
    await emit('tenure-change.rejected', { ...loan, changeId: 'tc-1', monthsDelta: 2, note: 'No' });
    expect(customers.notify).not.toHaveBeenCalled();
    expect(admins.notifyAdmins).not.toHaveBeenCalled();
  });

  it('congratulates the customer on a repaid loan', async () => {
    await emit('loan.repaid', loan);
    expect(notified()).toEqual([expect.objectContaining({ userId: 'MB-1', title: 'Loan Fully Repaid' })]);
  });

  it('tells the customer how a liquidation was decided', async () => {
    await emit('liquidation.decided', { ...loan, inflowId: 'in-1', amount: 250000, approved: true });
    await emit('liquidation.decided', { ...loan, inflowId: 'in-2', amount: 90000, approved: false });
    expect(notified()).toEqual([
      {
        userId: 'MB-1',
        title: 'Loan Liquidation Approved',
        message: expect.stringContaining('₦250,000 has been approved and applied'),
      },
      {
        userId: 'MB-1',
        title: 'Loan Liquidation Rejected',
        message: expect.stringMatching(/₦90,000 has been rejected\. Please contact support/),
      },
    ]);
  });

  it('reports a failing notification instead of throwing it', async () => {
    const down = new Error('mail is down');
    customers.notify.mockRejectedValue(down);
    await expect(
      listeners.loanDisbursed({ ...loan, principal: 1000, interest: 0, owed: 1000, monthly: 100 }),
    ).resolves.toBeUndefined();
    expect(captureJobError).toHaveBeenCalledWith(down, { queue: 'events', job: 'loan.disbursed' });
  });

  it('still tells the admins when telling the customer fails, and the other way round', async () => {
    customers.notify.mockRejectedValueOnce(new Error('sms is down'));
    await listeners.tenureChangeApproved({ ...loan, changeId: 'tc-1', monthsDelta: 1, tenure: 7 });
    expect(admins.notifyAdmins).toHaveBeenCalledTimes(1);

    prisma.user.findUnique.mockRejectedValueOnce(new Error('db is down'));
    await expect(
      listeners.tenureChangeProposed({ ...loan, changeId: 'tc-1', monthsDelta: 1, reason: 'DEFAULT', bySystem: true }),
    ).resolves.toBeUndefined();
    expect(captureJobError).toHaveBeenCalledTimes(2);
    expect(captureJobError).toHaveBeenLastCalledWith(expect.any(Error), {
      queue: 'events',
      job: 'tenure-change.proposed',
    });
  });
});
