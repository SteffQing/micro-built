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

  it('checks the invariants after a repriced approval, but leaves applyToLoan alone to its caller', async () => {
    const invariantQueries = (tx: ReturnType<typeof setup>['tx']) =>
      tx.$queryRaw.mock.calls.filter(([sql]) => (sql as TemplateStringsArray).join('').includes('"splits"')).length;

    const approved = setup({ found: change({ reason: 'ADMIN', reprice: true }) });
    await approved.service.approve('tc-1', 'AD-1');
    expect(invariantQueries(approved.tx)).toBe(1);

    // A top-up disbursement applies its change mid-way (the top-up DISBURSED, owed not yet raised) and checks the
    // invariants itself once everything is written: checking here would see owed short by the top-up.
    const disbursing = setup();
    await disbursing.service.applyToLoan(
      change({ reason: 'TOPUP', microLoanId: 'ml-1', status: 'APPROVED', reprice: true }),
      disbursing.tx as unknown as Tx,
    );
    expect(disbursing.tx.microLoan.create).toHaveBeenCalled();
    expect(invariantQueries(disbursing.tx)).toBe(0);
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
    const topupChange = (overrides: Partial<TenureChange> = {}) =>
      change({ reason: 'TOPUP', microLoanId: 'ml-1', ...overrides });

    it("changes the top-up's requested months and repricing at approval", async () => {
      const { tx, service } = setup({ found: topupChange() });
      await service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: 3, reprice: true }, 'AD-1', tx as unknown as Tx);
      expect(tx.tenureChange.findUnique).toHaveBeenCalledWith({ where: { microLoanId: 'ml-1' } });
      expect(tx.tenureChange.update).toHaveBeenCalledWith({
        where: { id: 'tc-1' },
        data: { monthsDelta: 3, reprice: true, status: 'PENDING' },
      });
    });

    it('adds a change when the top-up came without one', async () => {
      const { tx, service } = setup({ found: null as unknown as TenureChange });
      await service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: 2 }, 'AD-1', tx as unknown as Tx);
      expect(tx.tenureChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ monthsDelta: 2, reason: 'TOPUP', microLoanId: 'ml-1', reprice: false, status: 'PENDING' }),
      });
    });

    it('drops the requested change for 0', async () => {
      const { tx, service } = setup({ found: topupChange() });
      await service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: 0 }, 'AD-1', tx as unknown as Tx);
      expect(tx.tenureChange.update).toHaveBeenCalledWith({ where: { id: 'tc-1' }, data: { status: 'REJECTED' } });
    });

    it('refuses repricing without months added', async () => {
      const { tx, service } = setup({ found: null as unknown as TenureChange });
      await expect(
        service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: 0, reprice: true }, 'AD-1', tx as unknown as Tx),
      ).rejects.toThrow(BadRequestException);
    });

    it('never takes months off with a top-up', async () => {
      const { tx, service } = setup({ found: null as unknown as TenureChange });
      await expect(
        service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: -1 }, 'AD-1', tx as unknown as Tx),
      ).rejects.toThrow("A top-up's tenure change can only add months (0 for none)");
    });

    describe('at disbursement (the approved change)', () => {
      it('changes the approved months and repricing before they apply', async () => {
        const { tx, service } = setup({ found: topupChange({ status: 'APPROVED', monthsDelta: 2 }) });
        await service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: 4, reprice: true }, 'AD-1', tx as unknown as Tx, 'APPROVED');
        expect(tx.tenureChange.update).toHaveBeenCalledWith({
          where: { id: 'tc-1' },
          data: { monthsDelta: 4, reprice: true, status: 'APPROVED' },
        });
        // Not applied here: the disbursement applies it next.
        expect(tx.loan.update).not.toHaveBeenCalled();
      });

      it('brings back a change dropped at approval instead of adding a second one', async () => {
        const { tx, service } = setup({ found: topupChange({ status: 'REJECTED' }) });
        await service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: 1 }, 'AD-1', tx as unknown as Tx, 'APPROVED');
        expect(tx.tenureChange.create).not.toHaveBeenCalled();
        expect(tx.tenureChange.update).toHaveBeenCalledWith({
          where: { id: 'tc-1' },
          data: { monthsDelta: 1, reprice: false, status: 'APPROVED' },
        });
      });

      it('drops the approved change for 0', async () => {
        const { tx, ledgerTx, service } = setup({ found: topupChange({ status: 'APPROVED' }) });
        await service.adjustForTopup('LN-1', 'ml-1', { monthsDelta: 0 }, 'AD-1', tx as unknown as Tx, 'APPROVED');
        expect(tx.tenureChange.update).toHaveBeenCalledWith({ where: { id: 'tc-1' }, data: { status: 'REJECTED' } });
        expect(ledgerTx.audit).toHaveBeenCalledWith(
          tx,
          expect.objectContaining({ note: 'Dropped when its top-up was disbursed' }),
        );
      });
    });
  });
});
