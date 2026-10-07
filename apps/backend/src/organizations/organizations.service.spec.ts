import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from 'src/database/prisma.service';
import type { LedgerClock } from 'src/ledger/ledger.clock';
import type { LedgerTx } from 'src/ledger/ledger.tx';
import type { ChangeRequestsService } from 'src/change-requests/change-requests.service';
import type { AdminNotifierService } from 'src/notifications/admin-notifier.service';
import { organizationPayrollStates } from './organizations';
import { OrganizationsService } from './organizations.service';

jest.mock('./organizations', () => ({
  ...jest.requireActual('./organizations'),
  organizationPayrollStates: jest.fn(),
}));

// 2026-11-10 12:00 Lagos.
const NOW = new Date('2026-11-10T11:00:00Z');
const ACTOR = 'super-1';
const ORGS: Record<string, { id: string; name: string }> = {
  S: { id: 'S', name: 'Nigerian Navey' },
  T: { id: 'T', name: 'Nigerian Navy' },
};
const OCTOBER = { year: 2026, month: 'OCTOBER' } as const;
const NOVEMBER = { year: 2026, month: 'NOVEMBER' } as const;

function setup() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    organization: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(ORGS[where.id] ?? null)),
      delete: jest.fn().mockResolvedValue({}),
      create: jest.fn(({ data }: { data: { name: string } }) => Promise.resolve({ id: 'NEW', ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
    variation: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
    },
    deduction: { findFirst: jest.fn().mockResolvedValue(null) },
    customerPayroll: { updateMany: jest.fn().mockResolvedValue({ count: 3 }), count: jest.fn().mockResolvedValue(0) },
    changeRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    customer: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = {
    customerPayroll: { groupBy: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const ledgerTx = {
    transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    audit: jest.fn().mockResolvedValue(undefined),
  };
  const changeRequests = { proposeOrganization: jest.fn() };
  const notifier = { clear: jest.fn().mockResolvedValue(undefined) };
  const service = new OrganizationsService(
    prisma as unknown as PrismaService,
    ledgerTx as unknown as LedgerTx,
    { now: () => NOW } as unknown as LedgerClock,
    changeRequests as unknown as ChangeRequestsService,
    notifier as unknown as AdminNotifierService,
  );
  return { tx, prisma, ledgerTx, changeRequests, notifier, service };
}

const variation = (organizationId: string, period: { year: number; month: string }, locked = false) => ({
  organizationId,
  noPayrollReason: null,
  voucher: locked ? { id: 'VOUCHER' } : null,
  period,
});

describe('OrganizationsService.list', () => {
  it('joins each organization’s payroll state with its customers, running loans and this month’s deductions', async () => {
    const { prisma, service } = setup();
    jest.mocked(organizationPayrollStates).mockResolvedValue([
      {
        id: 'T',
        name: 'Nigerian Navy',
        latestLocked: { ym: '2026-09', label: 'SEPTEMBER 2026' },
        unlocked: [],
        awaitingVoucher: [],
        toGenerate: null,
      },
      { id: 'S', name: 'Police', latestLocked: null, unlocked: [], awaitingVoucher: [], toGenerate: null },
    ]);
    prisma.customerPayroll.groupBy.mockResolvedValue([{ organizationId: 'T', _count: { _all: 120 } }]);
    prisma.$queryRaw
      .mockResolvedValueOnce([{ organizationId: 'T', loans: 37 }])
      .mockResolvedValueOnce([{ organizationId: 'T' }]);

    await expect(service.list()).resolves.toEqual([
      {
        id: 'T',
        name: 'Nigerian Navy',
        customers: 120,
        runningLoans: 37,
        latestLocked: { ym: '2026-09', label: 'SEPTEMBER 2026' },
        unlocked: [],
        deductionsThisMonth: true,
      },
      {
        id: 'S',
        name: 'Police',
        customers: 0,
        runningLoans: 0,
        latestLocked: null,
        unlocked: [],
        deductionsThisMonth: false,
      },
    ]);
    expect(organizationPayrollStates).toHaveBeenCalledWith(prisma, { year: 2026, month: 'NOVEMBER' });
  });
});

describe('OrganizationsService.merge', () => {
  it('moves the payrolls and variations, deletes the misspelling and audits it', async () => {
    const { tx, ledgerTx, service } = setup();
    tx.variation.findMany.mockResolvedValue([variation('S', OCTOBER, true), variation('T', NOVEMBER)]);
    tx.variation.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.merge('S', 'T', ACTOR)).resolves.toEqual({ intoId: 'T', movedPayrolls: 3, movedVariations: 1 });

    expect(tx.customerPayroll.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'S' },
      data: { organizationId: 'T' },
    });
    expect(tx.variation.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'S' },
      data: { organizationId: 'T' },
    });
    expect(tx.organization.delete).toHaveBeenCalledWith({ where: { id: 'S' } });
    expect(ledgerTx.audit).toHaveBeenCalledWith(tx, {
      actorId: ACTOR,
      action: 'ORGANIZATIONS_MERGED',
      entityType: 'ORGANIZATION',
      entityId: 'T',
      note: expect.stringContaining('Nigerian Navey (S) merged into Nigerian Navy: 3 payroll records, 1 variations'),
    });
  });

  it('locks both rows before reading anything', async () => {
    const { tx, service } = setup();
    await service.merge('S', 'T', ACTOR);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.organization.findUnique.mock.invocationCallOrder[0]);
  });

  it('refuses to merge an organization into itself, or one that does not exist', async () => {
    const { tx, service } = setup();
    await expect(service.merge('S', 'S', ACTOR)).rejects.toThrow(BadRequestException);
    await expect(service.merge('S', 'NOPE', ACTOR)).rejects.toThrow(new NotFoundException('Organization not found'));
    expect(tx.customerPayroll.updateMany).not.toHaveBeenCalled();
  });

  it('refuses when both have a variation for the same month, and writes nothing', async () => {
    const { tx, ledgerTx, service } = setup();
    tx.variation.findMany.mockResolvedValue([variation('S', OCTOBER), variation('T', OCTOBER, true)]);
    await expect(service.merge('S', 'T', ACTOR)).rejects.toThrow(
      new ConflictException('Nigerian Navey and Nigerian Navy both have a variation for OCTOBER 2026, so they can’t be merged'),
    );
    expect(tx.customerPayroll.updateMany).not.toHaveBeenCalled();
    expect(tx.variation.updateMany).not.toHaveBeenCalled();
    expect(tx.organization.delete).not.toHaveBeenCalled();
    expect(ledgerTx.audit).not.toHaveBeenCalled();
  });

  it('refuses when its loans have deductions waiting in a month the other organization has locked', async () => {
    const { tx, service } = setup();
    tx.variation.findMany.mockResolvedValue([variation('T', OCTOBER, true)]);
    tx.deduction.findFirst.mockImplementation(
      ({ where }: { where: { loan: { borrower: { payroll: { organizationId: string } } } } }) =>
        Promise.resolve(where.loan.borrower.payroll.organizationId === 'S' ? { period: OCTOBER } : null),
    );
    await expect(service.merge('S', 'T', ACTOR)).rejects.toThrow(
      /Nigerian Navey’s loans have deductions waiting for OCTOBER 2026/,
    );
    expect(tx.customerPayroll.updateMany).not.toHaveBeenCalled();
  });

  describe('pending organization changes', () => {
    const request = (id: string, userId: string, proposed: object, previous: object = {}) => ({
      id,
      userId,
      proposed,
      previous,
    });

    it('withdraws the one the merge made pointless, and points the others at the organization that stays', async () => {
      const { tx, notifier, service } = setup();
      tx.changeRequest.findMany.mockResolvedValue([
        // Ada was in Navey, now in Navy through the merge: moving her to Navy is pointless.
        request('CR-1', 'ADA', { organizationId: 'T' }, { organizationId: 'S' }),
        // Bola, in Police, was to move into Navey: she goes into Navy instead.
        request('CR-2', 'BOLA', { organizationId: 'S', organization: 'Nigerian Navey' }, { organizationId: 'P' }),
        // Chi, in Navey, was to move to Police: only her "from" changes.
        request('CR-3', 'CHI', { organizationId: 'P', organization: 'Police' }, { organizationId: 'S', organization: 'Nigerian Navey' }),
        // Dayo, in Police, was to move into Air Force: untouched.
        request('CR-4', 'DAYO', { organizationId: 'A' }, { organizationId: 'P' }),
      ]);
      tx.customer.findMany.mockResolvedValue([
        { userId: 'ADA', payroll: { organizationId: 'T' } },
        { userId: 'BOLA', payroll: { organizationId: 'P' } },
        { userId: 'CHI', payroll: { organizationId: 'T' } },
        { userId: 'DAYO', payroll: { organizationId: 'P' } },
      ]);

      await service.merge('S', 'T', ACTOR);

      expect(tx.changeRequest.update).toHaveBeenCalledTimes(3);
      expect(tx.changeRequest.update).toHaveBeenCalledWith({
        where: { id: 'CR-1' },
        data: { status: 'CANCELLED', note: 'Nigerian Navey was merged into Nigerian Navy' },
      });
      expect(tx.changeRequest.update).toHaveBeenCalledWith({
        where: { id: 'CR-2' },
        data: { proposed: { organizationId: 'T', organization: 'Nigerian Navy' } },
      });
      expect(tx.changeRequest.update).toHaveBeenCalledWith({
        where: { id: 'CR-3' },
        data: { previous: { organizationId: 'T', organization: 'Nigerian Navy' } },
      });
      await new Promise((resolve) => setImmediate(resolve));
      expect(notifier.clear).toHaveBeenCalledTimes(1);
      expect(notifier.clear).toHaveBeenCalledWith('change-request:CR-1');
    });
  });
});

describe('OrganizationsService.requestSwitches', () => {
  it('hands the ids to the change requests, as the admin who asked', async () => {
    const { changeRequests, service } = setup();
    changeRequests.proposeOrganization.mockResolvedValue([{ externalId: 'PF1', outcome: 'CREATED', requestId: 'CR-1' }]);
    await expect(service.requestSwitches('T', ['PF1'], 'admin-1')).resolves.toEqual([
      { externalId: 'PF1', outcome: 'CREATED', requestId: 'CR-1' },
    ]);
    expect(changeRequests.proposeOrganization).toHaveBeenCalledWith('T', ['PF1'], 'admin-1');
  });
});

describe('OrganizationsService.create, rename, remove', () => {
  /** An organization lookup by id or by normalized name over `rows`. */
  function lookups(rows: { id: string; name: string }[]) {
    return ({ where }: { where: { id?: string; normalizedName?: string } }) =>
      Promise.resolve(
        rows.find((row) => (where.id ? row.id === where.id : row.name.toLowerCase() === where.normalizedName)) ?? null,
      );
  }

  function withOrganizations(rows: { id: string; name: string }[]) {
    const ctx = setup();
    ctx.tx.organization.findUnique.mockImplementation(lookups(rows) as never);
    jest.spyOn(ctx.service, 'get').mockImplementation((id) => Promise.resolve({ id } as never));
    return ctx;
  }

  it('adds one with its spaces tidied, and audits it', async () => {
    const { tx, ledgerTx, service } = withOrganizations([]);
    await service.create('  Nigerian   Army ', ACTOR);
    expect(tx.organization.create).toHaveBeenCalledWith({ data: { name: 'Nigerian Army', normalizedName: 'nigerian army' } });
    expect(ledgerTx.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'ORGANIZATION_CREATED', entityType: 'ORGANIZATION', entityId: 'NEW' }),
    );
  });

  it('refuses a name that is taken (ignoring case), or blank', async () => {
    const { tx, service } = withOrganizations([{ id: 'T', name: 'Nigerian Navy' }]);
    await expect(service.create('NIGERIAN NAVY', ACTOR)).rejects.toThrow(new ConflictException('Nigerian Navy already exists'));
    await expect(service.create('   ', ACTOR)).rejects.toThrow(BadRequestException);
    expect(tx.organization.create).not.toHaveBeenCalled();
  });

  it('renames one, and audits the old and new names', async () => {
    const { tx, ledgerTx, service } = withOrganizations([{ id: 'S', name: 'Nigerian Navey' }]);
    await service.rename('S', 'Nigerian Navy', ACTOR);
    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: 'S' },
      data: { name: 'Nigerian Navy', normalizedName: 'nigerian navy' },
    });
    expect(ledgerTx.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'ORGANIZATION_RENAMED', note: 'Nigerian Navey → Nigerian Navy' }),
    );
  });

  it('refuses to rename into another organization’s name: merge instead', async () => {
    const { tx, service } = withOrganizations([
      { id: 'S', name: 'Nigerian Navey' },
      { id: 'T', name: 'Nigerian Navy' },
    ]);
    await expect(service.rename('S', 'nigerian navy', ACTOR)).rejects.toThrow(
      new ConflictException('Nigerian Navy already exists: merge Nigerian Navey into it instead'),
    );
    expect(tx.organization.update).not.toHaveBeenCalled();
  });

  it('only fixes the case of its own name', async () => {
    const { tx, service } = withOrganizations([{ id: 'S', name: 'npf' }]);
    await service.rename('S', 'NPF', ACTOR);
    expect(tx.organization.update).toHaveBeenCalledWith({ where: { id: 'S' }, data: { name: 'NPF', normalizedName: 'npf' } });
  });

  it('deletes an organization nothing uses', async () => {
    const { tx, ledgerTx, service } = withOrganizations([{ id: 'S', name: 'Spare' }]);
    await service.remove('S', ACTOR);
    expect(tx.organization.delete).toHaveBeenCalledWith({ where: { id: 'S' } });
    expect(ledgerTx.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'ORGANIZATION_DELETED', note: 'Spare' }));
  });

  it('refuses to delete one with customers, variations or pending moves into it', async () => {
    const { tx, service } = withOrganizations([{ id: 'S', name: 'Navy' }]);
    tx.customerPayroll.count.mockResolvedValue(2);
    tx.variation.count.mockResolvedValue(1);
    tx.changeRequest.count.mockResolvedValue(1);
    await expect(service.remove('S', ACTOR)).rejects.toThrow(
      new ConflictException(
        'Navy has 2 customers, 1 variation, 1 pending move into it, so it can’t be deleted: merge it into another instead',
      ),
    );
    expect(tx.changeRequest.count).toHaveBeenCalledWith({
      where: { kind: 'ORGANIZATION', status: 'PENDING', proposed: { path: ['organizationId'], equals: 'S' } },
    });
    expect(tx.organization.delete).not.toHaveBeenCalled();
  });

  it('answers 404 for an organization that does not exist', async () => {
    const { service } = withOrganizations([]);
    await expect(service.rename('X', 'Name', ACTOR)).rejects.toThrow(NotFoundException);
    await expect(service.remove('X', ACTOR)).rejects.toThrow(NotFoundException);
  });
});
