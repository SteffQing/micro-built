import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ChangeRequestsService } from 'src/change-requests/change-requests.service';
import type { PrismaService } from 'src/database/prisma.service';
import type { CreateIdentityDto } from './common/dto/identity.dto';
import type { CreatePaymentMethodDto } from './common/dto/payment-method.dto';
import type { CreatePayrollDto } from './common/dto/payroll.dto';
import {
  ACCOUNT_NUMBER_TAKEN,
  BVN_TAKEN,
  FLAG_REASONS,
  IPPIS_TAKEN,
  NOT_A_CUSTOMER,
  PPIService,
} from './ppi.service';

const USER = 'MB-AAAAA';

type Customer = {
  userId: string;
  externalId: string | null;
  user: { name: string };
  payroll: { externalId: string } | null;
};

const customerRow = (overrides: Partial<Customer> = {}): Customer => ({
  userId: USER,
  externalId: null,
  user: { name: 'John Adewale Doe' },
  payroll: null,
  ...overrides,
});

/** A transaction client whose writes we can inspect, and a PrismaService that hands it to $transaction. */
function setup(customer: Customer | null = customerRow()) {
  const tx = {
    customer: {
      findUnique: jest.fn().mockResolvedValue(customer),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
    customerIdentity: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    customerPaymentMethod: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    customerPayroll: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  // Every write must go through tx: the client outside the transaction has no models at all.
  const prisma = { $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
  const changeRequests = {
    submit: jest.fn().mockResolvedValue({ id: 'cr1' }),
    get: jest.fn().mockResolvedValue({ id: 'cr1' }),
  };
  const service = new PPIService(prisma as unknown as PrismaService, changeRequests as unknown as ChangeRequestsService);
  return { tx, prisma, service, changeRequests };
}

/** FLAGGED + the reason, written inside the one transaction. */
function expectFlagged(ctx: ReturnType<typeof setup>, reason: string, customerData: object = {}) {
  expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(ctx.tx.user.update).toHaveBeenCalledWith({ where: { id: USER }, data: { status: 'FLAGGED' } });
  expect(ctx.tx.customer.update).toHaveBeenCalledWith({
    where: { userId: USER },
    data: { ...customerData, flagReason: reason },
  });
}

function expectNothingWritten(ctx: ReturnType<typeof setup>) {
  expect(ctx.tx.user.update).not.toHaveBeenCalled();
  expect(ctx.tx.customer.update).not.toHaveBeenCalled();
  expect(ctx.tx.customerIdentity.create).not.toHaveBeenCalled();
  expect(ctx.tx.customerPaymentMethod.create).not.toHaveBeenCalled();
  expect(ctx.tx.customerPaymentMethod.update).not.toHaveBeenCalled();
  expect(ctx.tx.customerPayroll.create).not.toHaveBeenCalled();
}

function uniqueViolation(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

const payrollDto: CreatePayrollDto = { externalId: 'PF12033', command: 'Lagos Command', organization: 'NPF', step: 3 };
const paymentDto: CreatePaymentMethodDto = {
  bankName: 'Access Bank',
  accountNumber: '0123456789',
  accountName: 'John Doe',
  bvn: '01234567890',
};
const identityDto = {
  dateOfBirth: '1990-01-01',
  residencyAddress: '1 Main St',
  stateResidency: 'Lagos',
  landmarkOrBusStop: 'Bus stop',
  nextOfKinName: 'Jane Doe',
  nextOfKinContact: '08012345678',
  nextOfKinAddress: 'Ogun',
  nextOfKinRelationship: 'Sibling',
  gender: 'Male',
  maritalStatus: 'Single',
} as CreateIdentityDto;

describe('PPIService', () => {
  describe('payroll', () => {
    it('creates payroll, sets externalId and flags the account in one transaction', async () => {
      const ctx = setup();
      await expect(ctx.service.createPayroll(USER, payrollDto)).resolves.toBe('User payroll data created');

      expectFlagged(ctx, FLAG_REASONS.payrollCreated, { externalId: 'PF12033' });
      expect(ctx.tx.customerPayroll.create).toHaveBeenCalledWith({
        data: { externalId: 'PF12033', command: 'Lagos Command', organization: 'NPF', step: 3 },
      });
      // The Customer row carries externalId before the payroll row that references it.
      expect(ctx.tx.customer.update.mock.invocationCallOrder[0]).toBeLessThan(
        ctx.tx.customerPayroll.create.mock.invocationCallOrder[0],
      );
    });

    it('409s when another customer has the IPPIS number', async () => {
      const ctx = setup();
      ctx.tx.customer.findFirst.mockResolvedValue({ userId: 'MB-OTHER' });
      await expect(ctx.service.createPayroll(USER, payrollDto)).rejects.toThrow(new ConflictException(IPPIS_TAKEN));
      expect(ctx.tx.customer.findFirst).toHaveBeenCalledWith({
        where: { externalId: 'PF12033', userId: { not: USER } },
        select: { userId: true },
      });
      expectNothingWritten(ctx);
    });

    it('409s when a concurrent request takes the IPPIS number first (P2002)', async () => {
      const ctx = setup();
      ctx.tx.customer.update.mockRejectedValue(uniqueViolation(['externalId']));
      await expect(ctx.service.createPayroll(USER, payrollDto)).rejects.toThrow(new ConflictException(IPPIS_TAKEN));
    });

    it('409s when payroll details already exist', async () => {
      const ctx = setup(customerRow({ externalId: 'PF12033', payroll: { externalId: 'PF12033' } }));
      await expect(ctx.service.createPayroll(USER, payrollDto)).rejects.toThrow(ConflictException);
      expectNothingWritten(ctx);
    });

    it('409s when a different IPPIS number is already on file', async () => {
      const ctx = setup(customerRow({ externalId: 'PF99999' }));
      await expect(ctx.service.createPayroll(USER, payrollDto)).rejects.toThrow(/already on file as PF99999/);
      expectNothingWritten(ctx);
    });

    it('updates payroll and flags the account', async () => {
      const ctx = setup(customerRow({ externalId: 'PF12033', payroll: { externalId: 'PF12033' } }));
      await ctx.service.updatePayroll(USER, { grade: 'Level 13' });
      expect(ctx.tx.customerPayroll.update).toHaveBeenCalledWith({
        where: { externalId: 'PF12033' },
        data: { grade: 'Level 13' },
      });
      expectFlagged(ctx, FLAG_REASONS.payrollUpdated);
    });

    it('404s updating payroll that does not exist', async () => {
      const ctx = setup();
      await expect(ctx.service.updatePayroll(USER, { grade: 'Level 13' })).rejects.toThrow(NotFoundException);
      expectNothingWritten(ctx);
    });
  });

  describe('payment method', () => {
    it('adds the payment method and flags the account in one transaction', async () => {
      const ctx = setup();
      await ctx.service.addPaymentMethod(USER, paymentDto);
      expect(ctx.tx.customerPaymentMethod.create).toHaveBeenCalledWith({ data: { ...paymentDto, userId: USER } });
      expectFlagged(ctx, FLAG_REASONS.paymentMethodCreated);
    });

    it('409s when another customer has the account number', async () => {
      const ctx = setup();
      ctx.tx.customerPaymentMethod.findFirst.mockResolvedValue({ accountNumber: '0123456789', bvn: '99999999999' });
      await expect(ctx.service.addPaymentMethod(USER, paymentDto)).rejects.toThrow(
        new ConflictException(ACCOUNT_NUMBER_TAKEN),
      );
      expectNothingWritten(ctx);
    });

    it('409s when another customer has the BVN', async () => {
      const ctx = setup();
      ctx.tx.customerPaymentMethod.findFirst.mockResolvedValue({ accountNumber: '9999999999', bvn: '01234567890' });
      await expect(ctx.service.addPaymentMethod(USER, paymentDto)).rejects.toThrow(new ConflictException(BVN_TAKEN));
      expectNothingWritten(ctx);
    });

    it('409s on a racing unique violation of the BVN (P2002)', async () => {
      const ctx = setup();
      ctx.tx.customerPaymentMethod.create.mockRejectedValue(uniqueViolation(['bvn']));
      await expect(ctx.service.addPaymentMethod(USER, paymentDto)).rejects.toThrow(new ConflictException(BVN_TAKEN));
    });

    it('409s when the customer already has a payment method', async () => {
      const ctx = setup();
      ctx.tx.customerPaymentMethod.findUnique.mockResolvedValue({ userId: USER });
      await expect(ctx.service.addPaymentMethod(USER, paymentDto)).rejects.toThrow(
        new ConflictException('A payment method already exists for this user.'),
      );
      expectNothingWritten(ctx);
    });

    it('sends a payment method change for approval, checking only the fields sent, without writing it', async () => {
      const ctx = setup();
      const current = { userId: USER, bankName: 'Access Bank', accountNumber: '0123456789', accountName: 'John Doe', bvn: '01234567890' };
      ctx.tx.customerPaymentMethod.findUnique.mockResolvedValue(current);
      const result = await ctx.service.updatePaymentMethod(USER, { bvn: '11111111111' });
      expect(ctx.tx.customerPaymentMethod.findFirst).toHaveBeenCalledWith({
        where: { userId: { not: USER }, OR: [{ bvn: '11111111111' }] },
        select: { accountNumber: true, bvn: true },
      });
      expect(ctx.changeRequests.submit).toHaveBeenCalledWith(ctx.tx, USER, 'PAYMENT_METHOD', { bvn: '11111111111' }, current);
      expect(result.data).toEqual({ id: 'cr1' });
      expectNothingWritten(ctx);
    });

    it('says so when the change matches the live details', async () => {
      const ctx = setup();
      ctx.tx.customerPaymentMethod.findUnique.mockResolvedValue({ userId: USER, bvn: '11111111111' });
      ctx.changeRequests.submit.mockResolvedValue(null);
      const result = await ctx.service.updatePaymentMethod(USER, { bvn: '11111111111' });
      expect(result).toEqual({ message: expect.stringMatching(/Nothing to change/), data: null });
    });

    it('409s updating to an account number another customer has', async () => {
      const ctx = setup();
      ctx.tx.customerPaymentMethod.findUnique.mockResolvedValue({ userId: USER });
      ctx.tx.customerPaymentMethod.findFirst.mockResolvedValue({ accountNumber: '2222222222', bvn: 'x' });
      await expect(ctx.service.updatePaymentMethod(USER, { accountNumber: '2222222222' })).rejects.toThrow(
        new ConflictException(ACCOUNT_NUMBER_TAKEN),
      );
      expectNothingWritten(ctx);
    });
  });

  describe('identity', () => {
    it('submits identity and flags the account in one transaction', async () => {
      const ctx = setup();
      await ctx.service.submitVerification(USER, identityDto);
      expect(ctx.tx.customerIdentity.create).toHaveBeenCalledWith({
        data: { ...identityDto, userId: USER, dateOfBirth: new Date('1990-01-01') },
      });
      expectFlagged(ctx, FLAG_REASONS.identityCreated);
    });

    it('400s when identity was already submitted', async () => {
      const ctx = setup();
      ctx.tx.customerIdentity.findUnique.mockResolvedValue({ userId: USER });
      await expect(ctx.service.submitVerification(USER, identityDto)).rejects.toThrow(BadRequestException);
      expectNothingWritten(ctx);
    });

    it('sends an identity change for approval (dates compared as YYYY-MM-DD) without writing it', async () => {
      const ctx = setup();
      ctx.tx.customerIdentity.findUnique.mockResolvedValue({
        userId: USER,
        stateResidency: 'Lagos',
        dateOfBirth: new Date('1990-01-01T00:00:00Z'),
      });
      await ctx.service.updateVerification(USER, { stateResidency: 'Ogun' });
      expect(ctx.changeRequests.submit).toHaveBeenCalledWith(
        ctx.tx,
        USER,
        'IDENTITY',
        { stateResidency: 'Ogun' },
        { userId: USER, stateResidency: 'Lagos', dateOfBirth: '1990-01-01' },
      );
      expect(ctx.tx.customerIdentity.update).not.toHaveBeenCalled();
      expect(ctx.tx.user.update).not.toHaveBeenCalled();
    });
  });

  it('403s for an account without a Customer row (admins)', async () => {
    const ctx = setup(null);
    await expect(ctx.service.createPayroll(USER, payrollDto)).rejects.toThrow(new ForbiddenException(NOT_A_CUSTOMER));
    await expect(ctx.service.addPaymentMethod(USER, paymentDto)).rejects.toThrow(ForbiddenException);
    await expect(ctx.service.submitVerification(USER, identityDto)).rejects.toThrow(ForbiddenException);
    expectNothingWritten(ctx);
  });

  it('keeps v1’s flag reasons word for word', () => {
    expect(FLAG_REASONS).toEqual({
      identityCreated:
        'User uploaded identity documents. Needs review by admin to confirm correctness of information',
      paymentMethodCreated:
        'User added payment method. Needs review by admin to confirm correctness of information',
      payrollCreated:
        'User added payroll information. Needs review by admin to confirm correctness of information',
      payrollUpdated:
        'User updated payroll information. Needs review by admin to confirm correctness of information',
    });
  });
});
