import { Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PrismaService } from 'src/database/prisma.service';
import type { LedgerClock } from './ledger.clock';
import { LedgerTx, type Tx } from './ledger.tx';

function setup() {
  const tx = {
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'LN-1' }]),
  };
  const prisma = { $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(tx)) };
  const events = new EventEmitter2();
  const heard: string[] = [];
  events.onAny((name) => heard.push(String(name)));
  const clock = { now: () => new Date('2099-01-01T00:00:00Z') } as LedgerClock;
  const ledgerTx = new LedgerTx(prisma as unknown as PrismaService, events, clock);
  return { tx, prisma, events, heard, ledgerTx };
}

const repaid = { loanId: 'LN-1', borrowerId: 'MB-1' };

describe('LedgerTx', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  it('emits events only once the transaction has committed', async () => {
    const { ledgerTx, heard } = setup();
    await ledgerTx.transaction(async (tx) => {
      ledgerTx.emit(tx, 'loan.repaid', repaid);
      expect(heard).toEqual([]);
    });
    expect(heard).toEqual(['loan.repaid']);
  });

  it('drops the events of a transaction that fails', async () => {
    const { ledgerTx, heard } = setup();
    await expect(
      ledgerTx.transaction(async (tx) => {
        ledgerTx.emit(tx, 'loan.repaid', repaid);
        throw new Error('rolled back');
      }),
    ).rejects.toThrow('rolled back');
    expect(heard).toEqual([]);
  });

  it('joins the caller’s transaction instead of opening another', async () => {
    const { ledgerTx, prisma, heard } = setup();
    await ledgerTx.transaction((outer) =>
      ledgerTx.run(outer, async (inner) => {
        expect(inner).toBe(outer);
        ledgerTx.emit(inner, 'loan.repaid', repaid);
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(heard).toEqual(['loan.repaid']);
  });

  it('refuses an event raised in a transaction it did not open', () => {
    const { ledgerTx } = setup();
    expect(() => ledgerTx.emit({} as Tx, 'loan.repaid', repaid)).toThrow(/must be raised inside/);
  });

  it('does not turn a failing listener into a failed operation', async () => {
    const { ledgerTx, events } = setup();
    events.on('loan.repaid', () => {
      throw new Error('mail is down');
    });
    await expect(
      ledgerTx.transaction(async (tx) => {
        ledgerTx.emit(tx, 'loan.repaid', repaid);
        return 'done';
      }),
    ).resolves.toBe('done');
  });

  it('stamps audit entries with the ledger clock', async () => {
    const { ledgerTx, tx } = setup();
    await ledgerTx.audit(tx as unknown as Tx, {
      actorId: 'system',
      action: 'LOAN_DISBURSED',
      entityType: 'LOAN',
      entityId: 'LN-1',
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityId: 'LN-1', createdAt: new Date('2099-01-01T00:00:00Z') }),
    });
  });

  it('404s a lock on a loan that does not exist', async () => {
    const { ledgerTx, tx } = setup();
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(ledgerTx.lockLoan(tx as unknown as Tx, 'LN-missing')).rejects.toThrow(NotFoundException);
  });
});
