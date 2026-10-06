import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, type TenureChange } from '@prisma/client';
import type { PrismaService } from 'src/database/prisma.service';
import type { DeductionsService } from './deductions.service';
import { ALREADY_DECIDED } from './ledger.constants';
import type { LedgerTx, Tx } from './ledger.tx';
import { TenureChangesService } from './tenure-changes.service';

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

function balancesRow(tenure: number, frozenCount: number) {
  return {
    loanId: 'LN-1',
    borrowerId: 'MB-1',
    status: 'DISBURSED',
    tenure,
    interestRate: D('0.06'),
    managementFeeRate: D('0.025'),
    principalBooked: D(100000),
    interestBooked: D(36000),
    penaltyBooked: D(0),
    principalCollected: D(0),
    interestCollected: D(0),
    penaltyCollected: D(0),
    frozenCount,
    committed: D(0),
  };
}

const change = (overrides: Partial<TenureChange> = {}): TenureChange => ({
  id: 'tc-1',
  loanId: 'LN-1',
  previousTenure: 6,
  monthsDelta: 2,
  reason: 'DEFAULT',
  status: 'PENDING',
  microLoanId: null,
  requestedById: null,
  reprice: false,
  interestAdded: null,
  createdAt: new Date(),
  ...overrides,
});

function setup({ tenure = 6, frozenCount = 2, found = change() } = {}) {
  const tx = {
    microLoan: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue({ loanId: 'LN-1', status: 'DISBURSED' }) },
    tenureChange: {
      findUnique: jest.fn().mockResolvedValue(found),
      findUniqueOrThrow: jest.fn().mockResolvedValue(change({ status: 'APPROVED' })),
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      // Like Prisma: the row as written.
      update: jest.fn(async ({ data }: { data: object }) => change(data)),
      create: jest.fn(async ({ data }: { data: object }) => change(data)),
    },
    loan: { update: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue({ borrowerId: 'MB-1' }) },
    // Loan locks, the balances query and the invariant check all go through $queryRaw.
    $queryRaw: jest.fn(async (sql: TemplateStringsArray) => {
      const text = sql.join('');
      if (text.includes('FOR UPDATE')) return [{ id: 'LN-1' }];
      if (text.includes('"splits"')) {
        return [{ owed: D(148000), repaid: D(0), booked: D(148000), paid: D(0), splits: D(0) }];
      }
      return [balancesRow(tenure, frozenCount)];
    }),
  };
  const ledgerTx = {
    run: (given: Tx | undefined, work: (t: Tx) => Promise<unknown>) => work(given ?? (tx as unknown as Tx)),
    lockLoan: jest.fn(),
    audit: jest.fn(),
    emit: jest.fn(),
  };
  const deductions = { refreshOpen: jest.fn() };
  const service = new TenureChangesService(
    {} as PrismaService,
    ledgerTx as unknown as LedgerTx,
    deductions as unknown as DeductionsService,
  );
  return { tx, ledgerTx, deductions, service };
}

describe('TenureChangesService', () => {
  it('approves once: moves the tenure, re-spreads the open month and tells listeners', async () => {
    const { tx, ledgerTx, deductions, service } = setup();
    await service.approve('tc-1', 'AD-1');
    expect(tx.tenureChange.updateMany).toHaveBeenCalledWith({
      where: { id: 'tc-1', status: 'PENDING' },
      data: { status: 'APPROVED' },
    });
    expect(tx.tenureChange.update).toHaveBeenCalledWith({ where: { id: 'tc-1' }, data: { previousTenure: 6 } });
    expect(tx.loan.update).toHaveBeenCalledWith({ where: { id: 'LN-1' }, data: { tenure: 8 } });
    expect(deductions.refreshOpen).toHaveBeenCalledWith('LN-1', tx);
    expect(ledgerTx.emit).toHaveBeenCalledWith(tx, 'tenure-change.approved', expect.objectContaining({ tenure: 8 }));
  });

  it('gives the second of two admins deciding at once a 409', async () => {
    const { tx, service } = setup();
    tx.tenureChange.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.approve('tc-1', 'AD-2')).rejects.toThrow(new ConflictException(ALREADY_DECIDED));
    await expect(service.reject('tc-1', 'AD-2')).rejects.toThrow(new ConflictException(ALREADY_DECIDED));
    expect(tx.loan.update).not.toHaveBeenCalled();
  });

  it('leaves a change requested with a top-up to that top-up’s decision', async () => {
    const { tx, service } = setup();
    tx.tenureChange.findUnique.mockResolvedValue(change({ reason: 'TOPUP', microLoanId: 'ml-1' }));
    await expect(service.approve('tc-1', 'AD-1')).rejects.toThrow('This change is decided with its top-up');
    await expect(service.reject('tc-1', 'AD-1')).rejects.toThrow('This change is decided with its top-up');
  });

  it('404s an unknown change', async () => {
    const { tx, service } = setup();
    tx.tenureChange.findUnique.mockResolvedValue(null);
    await expect(service.approve('nope', 'AD-1')).rejects.toThrow(NotFoundException);
  });

  it('refuses a change that would leave no month to repay', async () => {
    // 6 months, 5 already sent to payroll: shortening by 1 leaves nothing.
    const { service } = setup({ tenure: 6, frozenCount: 5 });
    await expect(
      service.propose({ loanId: 'LN-1', monthsDelta: -1, reason: 'ADMIN', requestedById: 'AD-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows one pending change per loan', async () => {
    const { tx, service } = setup();
    tx.tenureChange.findFirst.mockResolvedValue({ id: 'tc-0' });
    await expect(
      service.propose({ loanId: 'LN-1', monthsDelta: 2, reason: 'ADMIN', requestedById: 'AD-1' }),
    ).rejects.toThrow('This loan already has a pending tenure change');
  });

  it('records a system proposal against the system admin', async () => {
    const { ledgerTx, service } = setup();
    await service.propose({ loanId: 'LN-1', monthsDelta: 2, reason: 'DEFAULT' });
    expect(ledgerTx.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actorId: 'system' }));
    expect(ledgerTx.emit).toHaveBeenCalledWith(
      expect.anything(),
      'tenure-change.proposed',
      expect.objectContaining({ bySystem: true, monthsDelta: 2 }),
    );
  });

  it('rejects whole, non-zero months only, and only an admin applying at once', async () => {
    const { service } = setup();
    await expect(service.propose({ loanId: 'LN-1', monthsDelta: 0, reason: 'ADMIN' })).rejects.toThrow(BadRequestException);
    await expect(service.propose({ loanId: 'LN-1', monthsDelta: 1.5, reason: 'ADMIN' })).rejects.toThrow(BadRequestException);
    await expect(service.propose({ loanId: 'LN-1', monthsDelta: 1, reason: 'ADMIN', apply: true })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('reprices a lengthening: books principal left × rate × months added as interest', async () => {
    const { tx, service } = setup({ found: change({ reason: 'ADMIN', reprice: true }) });
    await service.approve('tc-1', 'AD-1');
    // ₦100,000 still owed (nothing paid or sent) × 6 % × 2 months.
    expect(tx.microLoan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ loanId: 'LN-1', amount: D(12000), purpose: 'INTEREST', status: 'DISBURSED' }),
    });
    expect(tx.loan.update).toHaveBeenCalledWith({ where: { id: 'LN-1' }, data: { owed: { increment: D(12000) } } });
    expect(tx.tenureChange.update).toHaveBeenCalledWith({
      where: { id: 'tc-1' },
      data: { previousTenure: 6, interestAdded: D(12000) },
    });
  });

  it('books nothing for an unrepriced change', async () => {
    const { tx, service } = setup({ found: change({ reason: 'ADMIN' }) });
    await service.approve('tc-1', 'AD-1');
    expect(tx.microLoan.create).not.toHaveBeenCalled();
  });

  it('reprices only a lengthening', async () => {
    const { service } = setup();
    await expect(
      service.propose({ loanId: 'LN-1', monthsDelta: -1, reason: 'ADMIN', requestedById: 'AD-1', reprice: true }),
    ).rejects.toThrow(BadRequestException);
  });

  describe('adjustForTopup', () => {
    it("changes the top-up's requested months and repricing", async () => {
      const { tx, service } = setup();
      tx.tenureChange.findFirst.mockResolvedValue(change({ reason: 'TOPUP', microLoanId: 'ml-1' }));
      await service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: 3, reprice: true }, 'AD-1', tx as unknown as Tx);
      expect(tx.tenureChange.update).toHaveBeenCalledWith({ where: { id: 'tc-1' }, data: { monthsDelta: 3, reprice: true } });
    });

    it('adds a change when the top-up came without one', async () => {
      const { tx, service } = setup();
      await service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: 2 }, 'AD-1', tx as unknown as Tx);
      expect(tx.tenureChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ monthsDelta: 2, reason: 'TOPUP', microLoanId: 'ml-1', reprice: false }),
      });
    });

    it('drops the requested change for 0', async () => {
      const { tx, service } = setup();
      tx.tenureChange.findFirst.mockResolvedValue(change({ reason: 'TOPUP', microLoanId: 'ml-1' }));
      await service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: 0 }, 'AD-1', tx as unknown as Tx);
      expect(tx.tenureChange.update).toHaveBeenCalledWith({ where: { id: 'tc-1' }, data: { status: 'REJECTED' } });
    });

    it('refuses repricing without months added', async () => {
      const { tx, service } = setup();
      await expect(
        service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: -1, reprice: true }, 'AD-1', tx as unknown as Tx),
      ).rejects.toThrow(BadRequestException);
    });

    it('never takes months off with a top-up', async () => {
      const { tx, service } = setup();
      await expect(
        service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: -1 }, 'AD-1', tx as unknown as Tx),
      ).rejects.toThrow("A top-up's tenure change can only add months (0 for none)");
    });
  });

  describe('reviseTopupChange (after the top-up is disbursed)', () => {
    const applied = (overrides: Partial<TenureChange> = {}) =>
      change({ reason: 'TOPUP', microLoanId: 'ml-1', status: 'APPROVED', monthsDelta: 2, ...overrides });

    it('moves the loan by the difference and revises the change in place', async () => {
      const { tx, ledgerTx, deductions, service } = setup({ found: applied() });
      await service.reviseTopupChange('ml-1', { monthsDelta: 3, reprice: false }, 'AD-1');
      expect(tx.loan.update).toHaveBeenCalledWith({ where: { id: 'LN-1' }, data: { tenure: 7 } });
      expect(tx.microLoan.create).not.toHaveBeenCalled();
      expect(deductions.refreshOpen).toHaveBeenCalledWith('LN-1', tx);
      expect(tx.tenureChange.update).toHaveBeenCalledWith({
        where: { id: 'tc-1' },
        data: { monthsDelta: 3, status: 'APPROVED', reprice: false, interestAdded: null },
      });
      expect(ledgerTx.emit).toHaveBeenCalledWith(
        tx,
        'tenure-change.approved',
        expect.objectContaining({ monthsDelta: 1, tenure: 7 }),
      );
    });

    it("prices every month of a change that wasn't repriced, without moving the tenure", async () => {
      const { tx, ledgerTx, service } = setup({ found: applied() });
      await service.reviseTopupChange('ml-1', { monthsDelta: 2, reprice: true }, 'AD-1');
      // ₦100,000 still owed × 6 % × the change's 2 months.
      expect(tx.microLoan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: D(12000), purpose: 'INTEREST' }),
      });
      expect(tx.loan.update).toHaveBeenCalledWith({ where: { id: 'LN-1' }, data: { owed: { increment: D(12000) } } });
      expect(tx.loan.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: { tenure: expect.anything() } }));
      expect(tx.tenureChange.update).toHaveBeenCalledWith({
        where: { id: 'tc-1' },
        data: expect.objectContaining({ reprice: true, interestAdded: D(12000) }),
      });
      expect(ledgerTx.emit).not.toHaveBeenCalled();
    });

    it('prices only the added months of a change already repriced', async () => {
      const { tx, service } = setup({ found: applied({ reprice: true, interestAdded: D(12000) }) });
      await service.reviseTopupChange('ml-1', { monthsDelta: 3, reprice: true }, 'AD-1');
      expect(tx.microLoan.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: D(6000) }) });
      expect(tx.tenureChange.update).toHaveBeenCalledWith({
        where: { id: 'tc-1' },
        data: expect.objectContaining({ monthsDelta: 3, interestAdded: D(18000) }),
      });
    });

    it('takes the change off the loan for 0', async () => {
      const { tx, service } = setup({ found: applied() });
      await service.reviseTopupChange('ml-1', { monthsDelta: 0, reprice: false }, 'AD-1');
      expect(tx.loan.update).toHaveBeenCalledWith({ where: { id: 'LN-1' }, data: { tenure: 4 } });
      expect(tx.tenureChange.update).toHaveBeenCalledWith({
        where: { id: 'tc-1' },
        data: expect.objectContaining({ status: 'REJECTED', monthsDelta: 2 }),
      });
    });

    it('adds a change to a top-up disbursed without one', async () => {
      const { tx, service } = setup({ found: null as unknown as TenureChange });
      await service.reviseTopupChange('ml-1', { monthsDelta: 2, reprice: false }, 'AD-1');
      expect(tx.loan.update).toHaveBeenCalledWith({ where: { id: 'LN-1' }, data: { tenure: 8 } });
      expect(tx.tenureChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ monthsDelta: 2, status: 'APPROVED', reason: 'TOPUP', microLoanId: 'ml-1' }),
      });
    });

    it("can't take back booked interest: no shortening or un-repricing", async () => {
      const { tx, service } = setup({ found: applied({ reprice: true, interestAdded: D(12000) }) });
      await expect(service.reviseTopupChange('ml-1', { monthsDelta: 1, reprice: true }, 'AD-1')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.reviseTopupChange('ml-1', { monthsDelta: 2, reprice: false }, 'AD-1')).rejects.toThrow(
        ConflictException,
      );
      expect(tx.loan.update).not.toHaveBeenCalled();
    });

    it('refuses a top-up not yet disbursed, negative months, and no change at all', async () => {
      const { tx, service } = setup({ found: applied() });
      await expect(service.reviseTopupChange('ml-1', { monthsDelta: -1, reprice: false }, 'AD-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.reviseTopupChange('ml-1', { monthsDelta: 2, reprice: false }, 'AD-1')).rejects.toThrow(
        'Nothing to change',
      );
      tx.microLoan.findFirst.mockResolvedValue({ loanId: 'LN-1', status: 'APPROVED' });
      await expect(service.reviseTopupChange('ml-1', { monthsDelta: 3, reprice: false }, 'AD-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
