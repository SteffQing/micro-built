jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
jest.mock('src/notifications/mail.service', () => ({ MailService: class {} }));
jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));

import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { captureJobError } from 'src/common/observability';
import { PLATFORM_ID } from 'src/common/constants';
import type { OnboardCustomer } from '../common/dto/customer.dto';
import { buildCustomerWhere } from './customer-filters';
import { CustomersService, MARKETER_FLAG_REASON } from './customers.service';

const RATES = { interestRate: new Prisma.Decimal('0.06'), managementFeeRate: new Prisma.Decimal('0.03') };

function onboardDto(overrides: Partial<OnboardCustomer> = {}): OnboardCustomer {
  return {
    user: { name: ' Jane Doe ', email: 'Jane@Example.com', phoneNumber: '08012345678' },
    payroll: { externalId: 'PF1', command: 'Lagos Command', organization: 'NPF', grade: 'L12', step: 3 },
    identity: {
      dateOfBirth: '1990-01-01',
      residencyAddress: '1 Main St',
      stateResidency: 'Lagos',
      landmarkOrBusStop: 'Bus stop',
      nextOfKinName: 'John',
      nextOfKinContact: '08000000000',
      nextOfKinAddress: 'Ikeja',
      nextOfKinRelationship: 'Sibling',
      gender: 'Female',
      maritalStatus: 'Single',
    },
    paymentMethod: { bankName: 'Access', accountNumber: '0123456789', accountName: 'Jane Doe', bvn: '01234567890' },
    ...overrides,
  };
}

function setup() {
  const tx = {
    $executeRaw: jest.fn(),
    organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'ORG-NPF' }) },
    customer: { create: jest.fn() },
    customerPayroll: { create: jest.fn() },
    loan: { create: jest.fn() },
    commodityLoan: { create: jest.fn().mockResolvedValue({ id: 'CL-1' }) },
  };
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue(null), groupBy: jest.fn() },
    customer: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn(), count: jest.fn() },
    customerPaymentMethod: { findFirst: jest.fn().mockResolvedValue(null) },
    commodity: { findFirst: jest.fn().mockResolvedValue({ id: 'COM-1' }) },
    loan: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const ledgerTx = {
    transaction: jest.fn((work: (t: typeof tx) => Promise<unknown>) => work(tx)),
    audit: jest.fn(),
  };
  const settings = { requireRates: jest.fn().mockResolvedValue(RATES) };
  const accounts = { createWithPassword: jest.fn().mockResolvedValue({}) };
  const mail = { sendOnboardedCustomerInvite: jest.fn().mockResolvedValue(undefined) };
  const sms = { send: jest.fn().mockResolvedValue(undefined) };
  const adminNotifier = { organizationAwaitingApproval: jest.fn().mockResolvedValue(undefined) };
  const service = new CustomersService(
    prisma as never,
    ledgerTx as never,
    settings as never,
    accounts as never,
    mail as never,
    sms as never,
    adminNotifier as never,
  );
  return { service, tx, prisma, ledgerTx, settings, accounts, mail, sms, adminNotifier };
}

describe('onboarding', () => {
  it('creates the account, customer, identity, bank details and payroll in one transaction', async () => {
    const { service, tx, accounts, ledgerTx, mail, sms } = setup();

    const result = await service.addCustomer(onboardDto(), 'AD-1', 'ADMIN');

    expect(ledgerTx.transaction).toHaveBeenCalledTimes(1);
    const input = accounts.createWithPassword.mock.calls[0][1];
    expect(input).toMatchObject({
      type: 'CUSTOMER',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phoneNumber: '+2348012345678',
      phoneNumberVerified: true,
      emailVerified: false,
      status: 'ACTIVE',
    });
    expect(input.id).toMatch(/^MB-/);
    expect(input.password.length).toBeGreaterThanOrEqual(12);
    expect(tx.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: input.id,
        externalId: 'PF1',
        accountOfficerId: 'AD-1',
        flagReason: null,
        identity: { create: expect.objectContaining({ dateOfBirth: new Date('1990-01-01') }) },
        paymentMethod: { create: onboardDto().paymentMethod },
      }),
    });
    expect(tx.customerPayroll.create).toHaveBeenCalledWith({
      data: { externalId: 'PF1', command: 'Lagos Command', organizationId: 'ORG-NPF', grade: 'L12', step: 3 },
    });
    expect(tx.loan.create).not.toHaveBeenCalled();
    expect(mail.sendOnboardedCustomerInvite).toHaveBeenCalledWith(
      'jane@example.com',
      'Jane Doe',
      input.password,
      '+2348012345678',
    );
    expect(sms.send).not.toHaveBeenCalled();
    expect(result.data).toEqual({ userId: input.id, loanId: null, commodityLoanId: null });
  });

  it('flags a customer a marketer onboards', async () => {
    const { service, tx, accounts } = setup();
    await service.addCustomer(onboardDto(), 'AD-M', 'MARKETER');
    expect(accounts.createWithPassword.mock.calls[0][1].status).toBe('FLAGGED');
    expect(tx.customer.create.mock.calls[0][0].data.flagReason).toBe(MARKETER_FLAG_REASON);
  });

  it('texts a phone-only customer without a password', async () => {
    const { service, accounts, mail, sms } = setup();
    await service.addCustomer(onboardDto({ user: { name: 'Ade', phoneNumber: '2348012345678' } }), 'AD-1', 'ADMIN');

    expect(accounts.createWithPassword.mock.calls[0][1].email).toBeNull();
    expect(mail.sendOnboardedCustomerInvite).not.toHaveBeenCalled();
    const [to, text] = sms.send.mock.calls[0];
    expect(to).toBe('+2348012345678');
    expect(text).toContain('Sign in at');
    expect(text).not.toContain(accounts.createWithPassword.mock.calls[0][1].password);
  });

  it('keeps the customer when the welcome message fails', async () => {
    const { service, mail } = setup();
    mail.sendOnboardedCustomerInvite.mockRejectedValue(new Error('resend down'));
    await expect(service.addCustomer(onboardDto(), 'AD-1', 'ADMIN')).resolves.toBeDefined();
    expect(captureJobError).toHaveBeenCalled();
  });

  it('approves a first cash loan with the Settings rates', async () => {
    const { service, tx, ledgerTx } = setup();
    const result = await service.addCustomer(
      onboardDto({ loan: { category: 'PERSONAL', cashLoan: { amount: 100000, tenure: 6 } } }),
      'AD-1',
      'ADMIN',
    );

    const data = tx.loan.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ category: 'PERSONAL', status: 'APPROVED', tenure: 6, requestedById: 'AD-1', ...RATES });
    expect(data.principal.toString()).toBe('100000');
    expect(data.id).toMatch(/^LN-/);
    expect(ledgerTx.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'LOAN_APPROVED', entityId: data.id }));
    expect(result.data.loanId).toBe(data.id);
  });

  it('leaves a marketer’s first cash loan for an admin to approve', async () => {
    const { service, tx, ledgerTx } = setup();
    const result = await service.addCustomer(
      onboardDto({ loan: { category: 'PERSONAL', cashLoan: { amount: 100000, tenure: 6 } } }),
      'AD-M',
      'MARKETER',
    );

    const data = tx.loan.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'PENDING', tenure: 0, requestedById: 'AD-M' });
    expect(ledgerTx.audit).not.toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'LOAN_APPROVED' }));
    expect(ledgerTx.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'CUSTOMER_ONBOARDED', note: 'With a first cash loan (6 months requested)' }),
    );
    expect(result.message).toContain('waiting for an admin to approve it');
  });

  it('creates a new organization a marketer names as waiting for a super admin, and tells them', async () => {
    const { service, tx, adminNotifier } = setup();
    // The INSERT made it: the row read back carries the id the call generated.
    tx.organization.findUniqueOrThrow.mockImplementation(() =>
      Promise.resolve({
        id: (tx.$executeRaw.mock.calls[0] as unknown[])[1],
        name: 'Nigerian Army',
        status: 'PENDING',
        requestedById: 'AD-M',
      }),
    );
    const result = await service.addCustomer(
      onboardDto({ payroll: { externalId: 'PF1', command: 'Lagos', organization: 'Nigerian Army' } }),
      'AD-M',
      'MARKETER',
    );

    expect((tx.$executeRaw.mock.calls[0] as unknown[]).slice(1)).toEqual([
      expect.any(String),
      'Nigerian Army',
      'nigerian army',
      'PENDING',
      'AD-M',
    ]);
    expect(adminNotifier.organizationAwaitingApproval).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Nigerian Army', requestedById: 'AD-M' }),
    );
    expect(result.message).toContain('Nigerian Army is new and waits for a super admin to approve it');
  });

  it('sends a first asset loan to review', async () => {
    const { service, tx, prisma } = setup();
    const result = await service.addCustomer(
      onboardDto({ loan: { category: 'ASSET_PURCHASE', commodityLoan: { assetName: 'laptop' } } }),
      'AD-1',
      'ADMIN',
    );

    expect(prisma.commodity.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'laptop', mode: 'insensitive' }, active: true },
      select: { id: true },
    });
    expect(tx.loan.create.mock.calls[0][0].data).toMatchObject({
      category: 'ASSET_PURCHASE',
      status: 'PENDING',
      principal: 0,
      tenure: 0,
    });
    expect(tx.commodityLoan.create).toHaveBeenCalledWith({
      data: { loanId: result.data.loanId, commodityId: 'COM-1', status: 'IN_REVIEW' },
      select: { id: true },
    });
    expect(result.data.commodityLoanId).toBe('CL-1');
  });

  it('refuses a loan until rates are set', async () => {
    const { service, settings, ledgerTx } = setup();
    settings.requireRates.mockRejectedValue(new ConflictException('Set rates in Settings first'));
    await expect(
      service.addCustomer(onboardDto({ loan: { category: 'PERSONAL', cashLoan: { amount: 1000, tenure: 3 } } }), 'AD-1', 'ADMIN'),
    ).rejects.toThrow('Set rates in Settings first');
    expect(ledgerTx.transaction).not.toHaveBeenCalled();
  });

  it('refuses a cash loan without a tenure, and a contact-less customer', async () => {
    const { service } = setup();
    await expect(
      service.addCustomer(onboardDto({ loan: { category: 'PERSONAL', cashLoan: { amount: 1000 } } }), 'AD-1', 'ADMIN'),
    ).rejects.toThrow('Enter the tenure (months) of this loan');
    await expect(service.addCustomer(onboardDto({ user: { name: 'X' } }), 'AD-1', 'ADMIN')).rejects.toThrow(
      "Enter the customer's email or phone number",
    );
  });

  it('refuses an IPPIS number that is already registered (409)', async () => {
    const { service, prisma } = setup();
    prisma.customer.findUnique.mockResolvedValue({ userId: 'MB-OLD' });
    await expect(service.addCustomer(onboardDto(), 'AD-1', 'ADMIN')).rejects.toThrow(
      new ConflictException('A customer with this IPPIS number already exists'),
    );
  });

  it('turns a unique-index race into a 409', async () => {
    const { service, accounts } = setup();
    accounts.createWithPassword.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x', meta: { target: ['bvn'] } }),
    );
    await expect(service.addCustomer(onboardDto(), 'AD-1', 'ADMIN')).rejects.toThrow(
      new ConflictException('A customer with this BVN already exists'),
    );
  });
});

describe('customer list', () => {
  it('adds each customer’s computed repayment rate and hides placeholder emails', async () => {
    const { service, prisma } = setup();
    prisma.customer.findMany.mockResolvedValue([
      { userId: 'MB-1', externalId: 'PF1', user: { name: 'A', email: 'a@x.com', phoneNumber: null, status: 'ACTIVE' } },
      {
        userId: 'MB-2',
        externalId: null,
        user: { name: 'B', email: '2348012345678@phone.microbuiltprime.com', phoneNumber: '+2348012345678', status: 'FLAGGED' },
      },
    ]);
    prisma.customer.count.mockResolvedValue(2);
    prisma.$queryRaw.mockResolvedValue([{ customerId: 'MB-1', rate: new Prisma.Decimal('87.5') }]);

    const result = await service.getCustomers({ page: 1, limit: 20 });

    expect(result.meta).toEqual({ total: 2, page: 1, limit: 20 });
    expect(result.data).toEqual([
      { id: 'MB-1', name: 'A', email: 'a@x.com', phoneNumber: null, externalId: 'PF1', status: 'ACTIVE', repaymentRate: 87.5 },
      {
        id: 'MB-2',
        name: 'B',
        email: null,
        phoneNumber: '+2348012345678',
        externalId: null,
        status: 'FLAGGED',
        repaymentRate: 100,
      },
    ]);
  });
});

describe('buildCustomerWhere', () => {
  it('is empty without filters', async () => {
    expect(await buildCustomerWhere({ $queryRaw: jest.fn() } as never, {})).toEqual({});
  });

  it('filters on the repayment rate through the computed rates', async () => {
    const db = { $queryRaw: jest.fn().mockResolvedValue([{ customerId: 'MB-1' }, { customerId: 'MB-3' }]) };
    const where = await buildCustomerWhere(db as never, { repaymentRateMin: 0, repaymentRateMax: 50 });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(where).toEqual({ userId: { in: ['MB-1', 'MB-3'] } });
  });

  it('maps the other filters onto Customer, User and CustomerPayroll', async () => {
    const db = { $queryRaw: jest.fn() };
    const where = await buildCustomerWhere(db as never, {
      status: 'ACTIVE',
      signupStart: '2026-01-01' as never,
      signupEnd: '2026-01-31' as never,
      accountOfficerId: PLATFORM_ID,
      hasActiveLoan: false,
      organizationId: ' ORG-NPF ',
      netPayMin: 0,
      grossPayMax: 250000,
    });
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(where).toEqual({
      AND: [
        {
          user: {
            status: 'ACTIVE',
            createdAt: { gte: new Date('2025-12-31T23:00:00Z'), lt: new Date('2026-01-31T23:00:00Z') },
          },
        },
        { accountOfficerId: null },
        { loans: { none: { status: 'DISBURSED' } } },
        {
          payroll: {
            is: {
              organizationId: 'ORG-NPF',
              employeeGross: { lte: 250000 },
              netPay: { gte: 0 },
            },
          },
        },
      ],
    });
  });

  it('searches name, email, phone (normalised too), customer id and IPPIS number', async () => {
    const where = await buildCustomerWhere({} as never, { search: '08012345678' });
    expect(where).toEqual({
      OR: expect.arrayContaining([
        { userId: { contains: '08012345678', mode: 'insensitive' } },
        { externalId: { contains: '08012345678', mode: 'insensitive' } },
        { user: { phoneNumber: '+2348012345678' } },
      ]),
    });
  });
});

describe('account officer stats', () => {
  it('counts customers by status and sums the ledger figures of disbursed loans', async () => {
    const { service, prisma } = setup();
    prisma.user.groupBy.mockResolvedValue([
      { status: 'ACTIVE', _count: { _all: 3 } },
      { status: 'FLAGGED', _count: { _all: 1 } },
    ]);
    prisma.customer.findMany.mockResolvedValue([{ userId: 'MB-1' }, { userId: 'MB-2' }]);
    prisma.loan.findMany.mockResolvedValue([{ id: 'LN-1' }]);
    const d = (value: string) => new Prisma.Decimal(value);
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { customerId: 'MB-1', rate: d('50') },
        { customerId: 'MB-2', rate: d('100') },
      ])
      .mockResolvedValueOnce([
        {
          loanId: 'LN-1',
          borrowerId: 'MB-1',
          status: 'DISBURSED',
          tenure: 6,
          interestRate: d('0.06'),
          managementFeeRate: d('0.03'),
          principalBooked: d('100000'),
          interestBooked: d('36000'),
          penaltyBooked: d('500'),
          principalCollected: d('20000'),
          interestCollected: d('7200'),
          penaltyCollected: d('500'),
          frozenCount: 2,
          committed: d('0'),
        },
      ]);

    const stats = await service.getAccountOfficerStats(PLATFORM_ID);

    expect(prisma.user.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customer: { is: { accountOfficerId: null } } } }),
    );
    expect(stats).toEqual({
      customers: { total: 4, active: 3, inactive: 0, flagged: 1, avgRepaymentScore: 75 },
      portfolio: {
        totalLoans: 1,
        totalDisbursed: 100000,
        totalRepaid: 27700,
        totalPenalty: 500,
        outstandingBalance: 108800,
      },
    });
  });
});
