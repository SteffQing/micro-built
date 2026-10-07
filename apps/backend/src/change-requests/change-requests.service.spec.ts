import { Prisma } from '@prisma/client';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from 'src/database/prisma.service';
import type { DeductionsService } from 'src/ledger/deductions.service';
import type { LedgerTx, Tx } from 'src/ledger/ledger.tx';
import type { AdminNotifierService } from 'src/notifications/admin-notifier.service';
import type { InappService } from 'src/notifications/inapp.service';
import {
  ALREADY_DECIDED,
  ChangeRequestsService,
  MAX_SWITCH_IDS,
  ORGANIZATION_SUPER_ADMIN_ONLY,
} from './change-requests.service';

const CUSTOMER = 'MB-AAAAA';
const ADMIN = 'admin-1';
const SUPER = 'super-1';

function setup() {
  const tx = {
    $executeRaw: jest.fn(),
    organization: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'ORG-NPF' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'ORG-NAVY' }),
    },
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
    customerPayroll: { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
    deduction: { findMany: jest.fn().mockResolvedValue([]) },
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
    organization: { findUnique: jest.fn().mockResolvedValue({ id: 'ORG-NAVY', name: 'Navy' }) },
    customer: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const ledgerTx = {
    transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    audit: jest.fn().mockResolvedValue(undefined),
    lockLoan: jest.fn().mockResolvedValue(undefined),
  };
  const deductions = { rehomeOpen: jest.fn().mockResolvedValue(undefined) };
  const inapp = { messageUser: jest.fn().mockResolvedValue(undefined) };
  const notifier = { notifyAdmins: jest.fn().mockResolvedValue(undefined), clear: jest.fn().mockResolvedValue(undefined) };
  const service = new ChangeRequestsService(
    prisma as unknown as PrismaService,
    ledgerTx as unknown as LedgerTx,
    inapp as unknown as InappService,
    notifier as unknown as AdminNotifierService,
    deductions as unknown as DeductionsService,
  );
  return { tx, prisma, ledgerTx, inapp, notifier, deductions, service, db: tx as unknown as Tx };
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
        data: { externalId: 'PF1', command: 'Lagos', organizationId: 'ORG-NPF' },
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

  describe('organization changes (PLAN_V2 P12)', () => {
    const SUPER_DECIDER = { userId: SUPER, role: 'SUPER_ADMIN' } as const;
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    const customer = (externalId: string, payroll: { organizationId: string; name: string } | null = null) => ({
      userId: `MB-${externalId}`,
      externalId,
      user: { name: `Customer ${externalId}` },
      payroll: payroll && { organizationId: payroll.organizationId, organization: { name: payroll.name } },
    });
    const NPF = { organizationId: 'ORG-NPF', name: 'NPF' };

    describe('proposing', () => {
      function proposing(customers: ReturnType<typeof customer>[]) {
        const ctx = setup();
        ctx.prisma.customer.findMany.mockResolvedValue(customers);
        let created = 0;
        ctx.tx.changeRequest.create.mockImplementation((args: { data: object }) =>
          Promise.resolve({ id: `cr${++created}`, ...args.data }),
        );
        ctx.prisma.user.findUnique.mockResolvedValue({ name: 'Ada Admin', type: 'CUSTOMER' });
        return ctx;
      }

      it('proposes one customer’s move as an admin’s change request, and prompts the super admins', async () => {
        const ctx = proposing([customer('PF1', NPF)]);
        await expect(ctx.service.proposeOrganization('ORG-NAVY', ['PF1'], ADMIN)).resolves.toEqual([
          { externalId: 'PF1', outcome: 'CREATED', requestId: 'cr1' },
        ]);
        expect(ctx.tx.changeRequest.create).toHaveBeenCalledWith({
          data: {
            userId: 'MB-PF1',
            kind: 'ORGANIZATION',
            proposed: { organizationId: 'ORG-NAVY', organization: 'Navy' },
            previous: { organizationId: 'ORG-NPF', organization: 'NPF' },
            requestedById: ADMIN,
          },
        });
        expect(ctx.ledgerTx.audit).toHaveBeenCalledWith(
          ctx.tx,
          expect.objectContaining({
            actorId: ADMIN,
            action: 'CHANGE_REQUEST_PROPOSED',
            entityId: 'cr1',
            note: expect.stringContaining('NPF → Navy'),
          }),
        );
        await flush();
        expect(ctx.notifier.notifyAdmins).toHaveBeenCalledWith(
          ['SUPER_ADMIN'],
          expect.objectContaining({ ctaUrl: '/approvals?request=cr1' }),
        );
      });

      it('answers each external id: created, no such customer, already there, or already waiting', async () => {
        const ctx = proposing([
          customer('PF1', NPF),
          customer('PF2'),
          customer('PF3', { organizationId: 'ORG-NAVY', name: 'Navy' }),
          customer('PF4', NPF),
          customer('PF5', NPF),
        ]);
        ctx.tx.changeRequest.findFirst
          .mockResolvedValueOnce(null) // PF1: nothing pending
          .mockResolvedValueOnce(null) // PF1: submit's own look
          .mockResolvedValueOnce({ id: 'cr-waiting' }) // PF4: one waits already
          .mockResolvedValue(null);

        const results = await ctx.service.proposeOrganization(
          'ORG-NAVY',
          [' PF1 ', 'PF1', 'PF2', 'PF3', 'PF4', 'PF5', 'PF9'],
          ADMIN,
        );

        expect(results).toEqual([
          { externalId: 'PF1', outcome: 'CREATED', requestId: 'cr1' },
          // No payroll record to move.
          { externalId: 'PF2', outcome: 'NOT_FOUND' },
          { externalId: 'PF3', outcome: 'ALREADY_IN_ORGANIZATION' },
          { externalId: 'PF4', outcome: 'PENDING_EXISTS', requestId: 'cr-waiting' },
          { externalId: 'PF5', outcome: 'CREATED', requestId: 'cr2' },
          { externalId: 'PF9', outcome: 'NOT_FOUND' },
        ]);
        expect(ctx.tx.changeRequest.create).toHaveBeenCalledTimes(2);
      });

      it('sends the super admins one prompt for a bulk proposal, and tells each customer', async () => {
        const ctx = proposing([customer('PF1', NPF), customer('PF2', NPF)]);
        await ctx.service.proposeOrganization('ORG-NAVY', ['PF1', 'PF2'], ADMIN);
        await flush();
        expect(ctx.notifier.notifyAdmins).toHaveBeenCalledTimes(1);
        expect(ctx.notifier.notifyAdmins).toHaveBeenCalledWith(
          ['SUPER_ADMIN'],
          expect.objectContaining({ message: 'Ada Admin proposed moving 2 customers to Navy.', ctaUrl: '/approvals' }),
        );
        expect(ctx.inapp.messageUser).toHaveBeenCalledTimes(2);
      });

      it('treats a request that another admin created at the same moment as already waiting', async () => {
        const ctx = proposing([customer('PF1', NPF)]);
        ctx.tx.changeRequest.create.mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }),
        );
        await expect(ctx.service.proposeOrganization('ORG-NAVY', ['PF1'], ADMIN)).resolves.toEqual([
          { externalId: 'PF1', outcome: 'PENDING_EXISTS' },
        ]);
      });

      it('refuses an unknown organization, no ids, and too many', async () => {
        const ctx = proposing([]);
        ctx.prisma.organization.findUnique.mockResolvedValueOnce(null);
        await expect(ctx.service.proposeOrganization('NOPE', ['PF1'], ADMIN)).rejects.toThrow(
          new NotFoundException('Organization not found'),
        );
        await expect(ctx.service.proposeOrganization('ORG-NAVY', ['  ', ''], ADMIN)).rejects.toThrow(
          BadRequestException,
        );
        const many = Array.from({ length: MAX_SWITCH_IDS + 1 }, (_, i) => `PF${i}`);
        await expect(ctx.service.proposeOrganization('ORG-NAVY', many, ADMIN)).rejects.toThrow(BadRequestException);
        expect(ctx.tx.changeRequest.create).not.toHaveBeenCalled();
      });
    });

    describe('deciding', () => {
      const organizationRequest = (overrides: object = {}) =>
        pendingRow({
          kind: 'ORGANIZATION',
          proposed: { organizationId: 'ORG-NAVY', organization: 'Navy' },
          previous: { organizationId: 'ORG-NPF', organization: 'NPF' },
          requestedById: ADMIN,
          requestedBy: { userId: ADMIN, user: { name: 'Ada Admin' } },
          ...overrides,
        });

      it('only a super admin approves or rejects one, though an admin may call the route', async () => {
        const ctx = setup();
        ctx.prisma.changeRequest.findUnique.mockResolvedValue(organizationRequest());
        await expect(ctx.service.approve('cr1', { userId: 'admin-2', role: 'ADMIN' })).rejects.toThrow(
          new ForbiddenException(ORGANIZATION_SUPER_ADMIN_ONLY),
        );
        await expect(ctx.service.reject('cr1', { userId: 'admin-2', role: 'ADMIN' })).rejects.toThrow(
          new ForbiddenException(ORGANIZATION_SUPER_ADMIN_ONLY),
        );
        // Not even the admin who proposed it: the kind decides.
        await expect(ctx.service.approve('cr1', { userId: ADMIN, role: 'ADMIN' })).rejects.toThrow(ForbiddenException);
        expect(ctx.tx.changeRequest.updateMany).not.toHaveBeenCalled();
        expect(ctx.tx.customerPayroll.update).not.toHaveBeenCalled();
      });

      it('approving moves the payroll record to the proposed organization', async () => {
        const ctx = setup();
        ctx.prisma.changeRequest.findUnique.mockResolvedValue(organizationRequest());
        ctx.tx.customer.findUnique.mockResolvedValue({ payroll: { externalId: 'PF1' } });
        await ctx.service.approve('cr1', SUPER_DECIDER);
        expect(ctx.tx.customerPayroll.update).toHaveBeenCalledWith({
          where: { externalId: 'PF1' },
          data: { organizationId: 'ORG-NAVY' },
        });
        expect(ctx.tx.changeRequest.updateMany).toHaveBeenCalledWith({
          where: { id: 'cr1', status: 'PENDING' },
          data: expect.objectContaining({ status: 'APPROVED', decidedById: SUPER }),
        });
        expect(ctx.ledgerTx.audit).toHaveBeenCalledWith(
          ctx.tx,
          expect.objectContaining({
            action: 'CHANGE_REQUEST_APPROVED',
            note: expect.stringContaining('organization of John Doe'),
          }),
        );
        expect(ctx.inapp.messageUser).toHaveBeenCalledWith(
          expect.objectContaining({ userId: CUSTOMER, title: 'The change to your organization was approved' }),
        );
      });

      it("moves the OPEN deductions of the customer's loans past what the new organization has sent", async () => {
        const ctx = setup();
        ctx.prisma.changeRequest.findUnique.mockResolvedValue(organizationRequest());
        ctx.tx.customer.findUnique.mockResolvedValue({ payroll: { externalId: 'PF1' } });
        ctx.tx.deduction.findMany.mockResolvedValue([{ loanId: 'LN-1' }, { loanId: 'LN-2' }]);
        await ctx.service.approve('cr1', SUPER_DECIDER);
        expect(ctx.tx.deduction.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { status: 'OPEN', loan: { borrowerId: CUSTOMER } } }),
        );
        expect(ctx.ledgerTx.lockLoan.mock.calls.map((call) => call[1])).toEqual(['LN-1', 'LN-2']);
        expect(ctx.deductions.rehomeOpen.mock.calls).toEqual([
          ['LN-1', ctx.tx],
          ['LN-2', ctx.tx],
        ]);
      });

      it('writes nothing when the organization has gone, or the customer has no payroll record', async () => {
        const ctx = setup();
        ctx.prisma.changeRequest.findUnique.mockResolvedValue(organizationRequest());
        ctx.tx.customer.findUnique.mockResolvedValue({ payroll: { externalId: 'PF1' } });
        ctx.tx.organization.findUnique.mockResolvedValueOnce(null);
        await expect(ctx.service.approve('cr1', SUPER_DECIDER)).rejects.toThrow(
          new ConflictException('That organization no longer exists'),
        );

        ctx.tx.customer.findUnique.mockResolvedValue({ payroll: null });
        await expect(ctx.service.approve('cr1', SUPER_DECIDER)).rejects.toThrow(
          new ConflictException('This customer has no payroll record to move'),
        );
        expect(ctx.tx.customerPayroll.update).not.toHaveBeenCalled();
      });

      it('shows whether the viewer may decide it', () => {
        const ctx = setup();
        const row = organizationRequest();
        expect(ctx.service.present(row as never, { userId: 'admin-2', role: 'ADMIN' }).canDecide).toBe(false);
        expect(ctx.service.present(row as never, SUPER_DECIDER).canDecide).toBe(true);
      });
    });
  });
});
