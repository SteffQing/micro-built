import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuditAction, AuditEntityType, Prisma } from '@prisma/client';
import { captureJobError } from 'src/common/observability';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerClock } from './ledger.clock';
import type { LedgerEventName, LedgerEventPayloads } from './ledger.events';

export type Tx = Prisma.TransactionClient;

export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  note?: string;
  /** Structured detail for the audit page (e.g. a change's before and after). */
  meta?: Prisma.InputJsonValue;
}

interface QueuedEvent {
  name: LedgerEventName;
  payload: unknown;
}

@Injectable()
export class LedgerTx {
  private readonly logger = new Logger(LedgerTx.name);
  private readonly queues = new WeakMap<Tx, QueuedEvent[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly clock: LedgerClock,
  ) {}

  /** Runs `work` in the caller's transaction, or in a new one when there is none. */
  run<T>(tx: Tx | undefined, work: (tx: Tx) => Promise<T>): Promise<T> {
    return tx ? work(tx) : this.transaction(work);
  }

  /**
   * A transaction whose ledger events are emitted once it has committed. Code that composes
   * ledger calls (payroll processing, approvals) opens its transaction here rather than with
   * prisma.$transaction, or events raised inside it have nowhere to wait and throw.
   */
  async transaction<T>(work: (tx: Tx) => Promise<T>, options: { timeout?: number } = {}): Promise<T> {
    const queue: QueuedEvent[] = [];
    const result = await this.prisma.$transaction(
      async (tx) => {
        this.queues.set(tx, queue);
        return work(tx);
      },
      { maxWait: 10_000, timeout: options.timeout ?? 30_000 },
    );
    for (const { name, payload } of queue) {
      try {
        this.events.emit(name, payload);
      } catch (error) {
        // The money has already moved; a failing listener must not turn that into an error.
        this.logger.error(`Listener for ${name} failed`, error instanceof Error ? error.stack : String(error));
        captureJobError(error, { job: name });
      }
    }
    return result;
  }

  emit<K extends LedgerEventName>(tx: Tx, name: K, payload: LedgerEventPayloads[K]): void {
    const queue = this.queues.get(tx);
    if (!queue) throw new Error(`Ledger event "${name}" must be raised inside LedgerTx.transaction()`);
    queue.push({ name, payload });
  }

  /** Serialises money changes on a loan: another writer waits until this transaction ends. */
  async lockLoan(tx: Tx, loanId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Loan" WHERE "id" = ${loanId} FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException('Loan not found');
  }

  /** Stamped by the ledger clock, like every other ledger time, so ordering by time holds. */
  async audit(tx: Tx, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({ data: { ...entry, createdAt: this.clock.now() } });
  }
}
