import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from 'src/database/prisma.service';
import type { LedgerTx, Tx } from 'src/ledger/ledger.tx';
import type { AdminNotifierService } from 'src/notifications/admin-notifier.service';
import type { InappService } from 'src/notifications/inapp.service';
import { ALREADY_DECIDED, ChangeRequestsService } from './change-requests.service';

const CUSTOMER = 'MB-AAAAA';
const ADMIN = 'admin-1';
const SUPER = 'super-1';

function setup() {
  const tx = {
    changeRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn((args: { data: object }) => Promise.resolve({ id: 'cr1', ...args.data })),
      update: jest.fn((args: { data: object }) => Promise.resolve({ id: 'cr1', ...args.data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    customerPaymentMethod: {
      findUnique: jest.fn().mockResolvedValue({ userId: CUSTOMER }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    customer: {
      findUnique: jest.fn().mockResolvedValue({ externalId: null }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    customerPayroll: { create: jest.fn().mockResolvedValue({}) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: '2348012345678@phone.microbuiltprime.com' }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    changeRequest: { findUnique: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    user: { findUnique: jest.fn() },
  };
  const ledgerTx = {
    transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    audit: jest.fn().mockResolvedValue(undefined),
  };
  const inapp = { messageUser: jest.fn().mockResolvedValue(undefined) };
  const notifier = { notifyAdmins: jest.fn().mockResolvedValue(undefined), clear: jest.fn().mockResolvedValue(undefined) };
  const service = new ChangeRequestsService(
    prisma as unknown as PrismaService,
    ledgerTx as unknown as LedgerTx,
    inapp as unknown as InappService,
    notifier as unknown as AdminNotifierService,
  );
  return { tx, prisma, ledgerTx, inapp, service, db: tx as unknown as Tx };
}

const pendingRow = (overrides: object = {}) => ({
  id: 'cr1',
  userId: CUSTOMER,
  kind: 'PAYMENT_METHOD',
  status: 'PENDING',
  proposed: { bankName: 'Kuda MFB' },
  previous: { bankName: 'Access Bank' },
  decidedBy: null,
  requestedById: null,
  requestedBy: null,
  decidedAt: null,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: CUSTOMER, name: 'John Doe', type: 'CUSTOMER', admin: null },
  ...overrides,
});

describe('ChangeRequestsService', () => {
  describe('submit', () => {
    it('keeps only the fields that differ from the live details', async () => {
      const ctx = setup();
      await ctx.service.submit(ctx.db, CUSTOMER, 'PAYMENT_METHOD', { bankName: 'Kuda MFB', bvn: '111' }, {
        bankName: 'Access Bank',
        bvn: '111',
      });
      expect(ctx.tx.changeRequest.create).toHaveBeenCalledWith({
        data: {
          userId: CUSTOMER,
          kind: 'PAYMENT_METHOD',
          proposed: { bankName: 'Kuda MFB' },
          previous: { bankName: 'Access Bank' },
          requestedById: null,
        },
      });
    });

    it('returns null and writes nothing when nothing differs', async () => {
      const ctx = setup();
      const result = await ctx.service.submit(ctx.db, CUSTOMER, 'PAYMENT_METHOD', { bvn: '111' }, { bvn: '111' });
      expect(result).toBeNull();
      expect(ctx.tx.changeRequest.create).not.toHaveBeenCalled();
    });

    it('folds a later edit into the pending request, keeping the original previous values', async () => {
      const ctx = setup();
      ctx.tx.changeRequest.findFirst.mockResolvedValue(pendingRow());
      await ctx.service.submit(ctx.db, CUSTOMER, 'PAYMENT_METHOD', { accountNumber: '2222222222' }, {
        bankName: 'Access Bank',
        accountNumber: '0123456789',
      });
      expect(ctx.tx.changeRequest.update).toHaveBeenCalledWith({
        where: { id: 'cr1' },
        data: {
          proposed: { bankName: 'Kuda MFB', accountNumber: '2222222222' },
          previous: { bankName: 'Access Bank', accountNumber: '0123456789' },
        },
      });
    });

    it('cancels the pending request when every field goes back to its live value', async () => {
      const ctx = setup();
      ctx.tx.changeRequest.findFirst.mockResolvedValue(pendingRow());
      const result = await ctx.service.submit(ctx.db, CUSTOMER, 'PAYMENT_METHOD', { bankName: 'Access Bank' }, {
        bankName: 'Access Bank',
      });
      expect(result).toBeNull();
      expect(ctx.tx.changeRequest.update).toHaveBeenCalledWith({ where: { id: 'cr1' }, data: { status: 'CANCELLED' } });
    });
  });

  describe('holdProfileChange', () => {
    it('lets a super admin’s change through', async () => {
      const ctx = setup();
      ctx.prisma.user.findUnique.mockResolvedValue({ name: 'Boss', email: 'b@x.com', admin: { role: 'SUPER_ADMIN' } });
      await expect(ctx.service.holdProfileChange(SUPER, { email: 'new@x.com' })).resolves.toBeNull();
      expect(ctx.tx.changeRequest.create).not.toHaveBeenCalled();
    });

    it('holds anyone else’s, writing back the current values and verification flags', async () => {
      const ctx = setup();
      ctx.prisma.user.findUnique.mockResolvedValue({
        name: 'John Doe',
        email: 'john@x.com',
        emailVerified: true,
        phoneNumber: '+2348012345678',
        phoneNumberVerified: true,
        image: null,
        admin: null,
      });
      const keep = await ctx.service.holdProfileChange(CUSTOMER, { email: 'NEW@x.com' });
      expect(keep).toEqual({ email: 'john@x.com', emailVerified: true });
      expect(ctx.tx.changeRequest.create).toHaveBeenCalledWith({
        data: {
          userId: CUSTOMER,
          kind: 'PROFILE',
          proposed: { email: 'new@x.com' },
          previous: { email: 'john@x.com' },
          requestedById: null,
        },
      });
    });
  });

  describe('deciding', () => {
    it('approves a payment method change: CAS on the status, the write, and an audit entry', async () => {
      const ctx = setup();
      ctx.prisma.changeRequest.findUnique.mockResolvedValue(pendingRow());
      await ctx.service.approve('cr1', { userId: ADMIN, role: 'ADMIN' });
      expect(ctx.tx.changeRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'cr1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'APPROVED', decidedById: ADMIN }),
      });
      expect(ctx.tx.customerPaymentMethod.update).toHaveBeenCalledWith({
        where: { userId: CUSTOMER },
        data: { bankName: 'Kuda MFB' },
      });
      expect(ctx.ledgerTx.audit).toHaveBeenCalledWith(
        ctx.tx,
        expect.objectContaining({ action: 'CHANGE_REQUEST_APPROVED', entityType: 'CHANGE_REQUEST', entityId: 'cr1' }),
      );
      expect(ctx.inapp.messageUser).toHaveBeenCalledWith(expect.objectContaining({ userId: CUSTOMER }));
    });

    it('409s when another admin decided first', async () => {
      const ctx = setup();
      ctx.prisma.changeRequest.findUnique.mockResolvedValue(pendingRow());
      ctx.tx.changeRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(ctx.service.approve('cr1', { userId: ADMIN, role: 'ADMIN' })).rejects.toThrow(
        new ConflictException(ALREADY_DECIDED),
      );
      expect(ctx.tx.customerPaymentMethod.update).not.toHaveBeenCalled();
    });

    it('409s approving an account number someone else took meanwhile', async () => {
      const ctx = setup();
      ctx.prisma.changeRequest.findUnique.mockResolvedValue(
        pendingRow({ proposed: { accountNumber: '2222222222' }, previous: { accountNumber: '0123456789' } }),
      );
      ctx.tx.customerPaymentMethod.findFirst.mockResolvedValue({ accountNumber: '2222222222' });
      await expect(ctx.service.approve('cr1', { userId: ADMIN, role: 'ADMIN' })).rejects.toThrow(ConflictException);
    });

    it('only a super admin decides an admin’s change, and nobody decides their own', async () => {
      const ctx = setup();
      const adminRequest = pendingRow({
        kind: 'PROFILE',
        userId: ADMIN,
        user: { id: ADMIN, name: 'Ada', type: 'ADMIN', admin: { role: 'ADMIN' } },
      });
      ctx.prisma.changeRequest.findUnique.mockResolvedValue(adminRequest);
      await expect(ctx.service.approve('cr1', { userId: 'admin-2', role: 'ADMIN' })).rejects.toThrow(
        ForbiddenException,
      );
      await expect(ctx.service.reject('cr1', { userId: ADMIN, role: 'SUPER_ADMIN' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(ctx.tx.changeRequest.updateMany).not.toHaveBeenCalled();
    });

    it('moves a phone-only account’s placeholder email with its new number', async () => {
      const ctx = setup();
      ctx.prisma.changeRequest.findUnique.mockResolvedValue(
        pendingRow({ kind: 'PROFILE', proposed: { phoneNumber: '+2348099999999' }, previous: {} }),
      );
      await ctx.service.approve('cr1', { userId: ADMIN, role: 'ADMIN' });
      expect(ctx.tx.user.update).toHaveBeenCalledWith({
        where: { id: CUSTOMER },
        data: {
          phoneNumber: '+2348099999999',
          phoneNumberVerified: true,
          email: expect.stringContaining('2348099999999'),
        },
      });
    });
  });

  describe('admin proposals', () => {
    const proposal = (overrides: object = {}) =>
      pendingRow({
        requestedById: ADMIN,
        requestedBy: { userId: ADMIN, user: { name: 'Ada Admin' } },
        ...overrides,
      });

    it('records who proposed it, and never folds into the customer’s own pending request', async () => {
      const ctx = setup();
      await ctx.service.submit(ctx.db, CUSTOMER, 'PAYMENT_METHOD', { bankName: 'Kuda MFB' }, {}, ADMIN);
      expect(ctx.tx.changeRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ requestedById: ADMIN, previous: { bankName: null } }),
      });

      ctx.tx.changeRequest.findFirst.mockResolvedValue(pendingRow());
      await expect(
        ctx.service.submit(ctx.db, CUSTOMER, 'PAYMENT_METHOD', { bankName: 'GTBank' }, {}, ADMIN),
      ).rejects.toThrow(ConflictException);
    });

    it('only a super admin decides it (the proposing super admin included)', async () => {
      const ctx = setup();
      ctx.prisma.changeRequest.findUnique.mockResolvedValue(proposal());
      await expect(ctx.service.approve('cr1', { userId: 'admin-2', role: 'ADMIN' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(ctx.tx.changeRequest.updateMany).not.toHaveBeenCalled();

      ctx.prisma.changeRequest.findUnique.mockResolvedValue(proposal({ requestedById: SUPER }));
      await ctx.service.approve('cr1', { userId: SUPER, role: 'SUPER_ADMIN' });
      expect(ctx.tx.changeRequest.updateMany).toHaveBeenCalled();
    });

    it('approving creates bank details the customer never had, and tells them', async () => {
      const ctx = setup();
      const details = { bankName: 'Kuda MFB', accountNumber: '2222222222', accountName: 'John Doe', bvn: '22222222222' };
      ctx.prisma.changeRequest.findUnique.mockResolvedValue(proposal({ proposed: details, previous: {} }));
      ctx.tx.customerPaymentMethod.findUnique.mockResolvedValue(null);
      await ctx.service.approve('cr1', { userId: SUPER, role: 'SUPER_ADMIN' });
      expect(ctx.tx.customerPaymentMethod.create).toHaveBeenCalledWith({ data: { ...details, userId: CUSTOMER } });
      expect(ctx.inapp.messageUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: CUSTOMER, title: 'The change to your payment method was approved' }),
      );
    });

    it('approving a payroll proposal links the IPPIS number and adds the record', async () => {
      const ctx = setup();
      ctx.prisma.changeRequest.findUnique.mockResolvedValue(
        proposal({ kind: 'PAYROLL', proposed: { externalId: 'PF1', command: 'Lagos', organization: 'NPF' }, previous: {} }),
      );
      await ctx.service.approve('cr1', { userId: SUPER, role: 'SUPER_ADMIN' });
      expect(ctx.tx.customer.update).toHaveBeenCalledWith({ where: { userId: CUSTOMER }, data: { externalId: 'PF1' } });
      expect(ctx.tx.customerPayroll.create).toHaveBeenCalledWith({
        data: { externalId: 'PF1', command: 'Lagos', organization: 'NPF' },
      });
    });

    it('the customer can withdraw an admin’s proposal, and the proposer is told', async () => {
      const ctx = setup();
      ctx.prisma.changeRequest.findFirst.mockResolvedValue(proposal());
      ctx.prisma.changeRequest.findUnique.mockResolvedValue(proposal({ status: 'CANCELLED' }));
      ctx.prisma.user.findUnique.mockResolvedValue({ name: 'John Doe' });
      await ctx.service.cancel('cr1', CUSTOMER);
      expect(ctx.prisma.changeRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'cr1', status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      await new Promise((resolve) => setImmediate(resolve));
      expect(ctx.inapp.messageUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: ADMIN, title: 'Proposed change withdrawn' }),
      );
    });
  });
});
