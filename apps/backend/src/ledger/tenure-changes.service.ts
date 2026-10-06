import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type TenureChange, type TenureChangeReason, type TenureChangeStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { assertLedgerInvariants, loanBalances } from './balances';
import { DeductionsService } from './deductions.service';
import { ALREADY_DECIDED, LOAN_NOT_ACTIVE, SYSTEM_ACTOR_ID } from './ledger.constants';
import { repriceInterest } from './ledger.math';
import { LedgerTx, type Tx } from './ledger.tx';
import { money, ZERO, type Money } from './money';

export interface ProposeTenureChange {
  loanId: string;
  /** Signed: a change can also shorten a loan. */
  monthsDelta: number;
  reason: TenureChangeReason;
  /** The admin proposing it; null or absent when the system proposes it. */
  requestedById?: string | null;
  /** The top-up it was requested with; such a change is decided and applied with that top-up. */
  microLoanId?: string;
  /** Approve it in the same call (an admin creating and deciding at once). */
  apply?: boolean;
  /** Lengthening only: also book interest for the added months when it is applied. */
  reprice?: boolean;
}

export interface TenureChangeFilters {
  status?: TenureChangeStatus;
  loanId?: string;
  borrowerId?: string;
  skip?: number;
  take?: number;
}

const PENDING_EXISTS = 'This loan already has a pending tenure change';
const REPRICE_LENGTHEN_ONLY =
  'Only a change that lengthens the loan can recalculate its interest (shortening has no interest credit)';
const DECIDED_WITH_TOPUP = 'This change is decided with its top-up';
const TOPUP_MONTHS_NOT_NEGATIVE = "A top-up's tenure change can only add months (0 for none)";
/** A tenure must leave at least one month to deduct after the months already sent to payroll. */
function assertLeavesMonths(tenure: number, frozenCount: number): void {
  if (tenure - frozenCount < 1) {
    throw new ConflictException(
      `A tenure of ${tenure} months leaves nothing to repay: ${frozenCount} deductions have already gone to payroll`,
    );
  }
}

const signed = (months: number) => `${months > 0 ? '+' : ''}${months} month${Math.abs(months) === 1 ? '' : 's'}`;

@Injectable()
export class TenureChangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly deductions: DeductionsService,
  ) {}

  async propose(input: ProposeTenureChange, tx?: Tx): Promise<TenureChange> {
    const { loanId, monthsDelta, reason, microLoanId } = input;
    const requestedById = input.requestedById ?? null;
    if (!Number.isInteger(monthsDelta) || monthsDelta === 0) {
      throw new BadRequestException('monthsDelta must be a whole, non-zero number of months');
    }
    if (input.apply && (!requestedById || microLoanId)) {
      throw new BadRequestException('Only an admin can apply a change at once, and not one tied to a top-up');
    }
    const reprice = input.reprice === true;
    if (reprice && monthsDelta < 0) throw new BadRequestException(REPRICE_LENGTHEN_ONLY);

    return this.ledgerTx.run(tx, async (tx) => {
      await this.ledgerTx.lockLoan(tx, loanId);
      const balances = await loanBalances(tx, loanId);
      if (balances.status !== 'DISBURSED') throw new ConflictException(LOAN_NOT_ACTIVE);
      assertLeavesMonths(balances.tenure + monthsDelta, balances.frozenCount);
      if (await tx.tenureChange.findFirst({ where: { loanId, status: 'PENDING' }, select: { id: true } })) {
        throw new ConflictException(PENDING_EXISTS);
      }

      let change: TenureChange;
      try {
        change = await tx.tenureChange.create({
          data: { loanId, previousTenure: balances.tenure, monthsDelta, reason, requestedById, microLoanId, reprice },
        });
      } catch (error) {
        // The partial unique index (one PENDING per loan) caught a concurrent proposal.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(PENDING_EXISTS);
        }
        throw error;
      }

      await this.ledgerTx.audit(tx, {
        actorId: requestedById ?? SYSTEM_ACTOR_ID,
        action: 'TENURE_CHANGE_PROPOSED',
        entityType: 'TENURE_CHANGE',
        entityId: change.id,
        note: `${signed(monthsDelta)} (${reason})${reprice ? ', interest recalculated' : ''}`,
      });
      this.ledgerTx.emit(tx, 'tenure-change.proposed', {
        changeId: change.id,
        loanId,
        borrowerId: balances.borrowerId,
        monthsDelta,
        reason,
        bySystem: requestedById === null,
      });

      return input.apply && requestedById ? this.approve(change.id, requestedById, tx) : change;
    });
  }

  /**
   * Sets, changes or drops (monthsDelta 0 or null) the tenure change that goes with a top-up, and whether it
   * reprices: at approval (the requested change, PENDING) or at disbursement (the approved one, APPROVED), before
   * it is applied. An absent field keeps what is there. A top-up has one change row (microLoanId is unique), so a
   * dropped one is brought back rather than duplicated. Caller holds the loan lock.
   */
  async adjustForTopup(
    loanId: string,
    microLoanId: string,
    adjust: { monthsDelta?: number | null; reprice?: boolean },
    actorId: string,
    tx: Tx,
    stage: 'PENDING' | 'APPROVED' = 'PENDING',
  ): Promise<void> {
    const row = await tx.tenureChange.findUnique({ where: { microLoanId } });
    const existing = row?.status === stage ? row : null;
    const monthsDelta = adjust.monthsDelta === undefined ? (existing?.monthsDelta ?? 0) : (adjust.monthsDelta ?? 0);
    if (!Number.isInteger(monthsDelta)) {
      throw new BadRequestException('monthsDelta must be a whole number of months');
    }
    if (monthsDelta < 0) throw new BadRequestException(TOPUP_MONTHS_NOT_NEGATIVE);
    if (adjust.reprice && monthsDelta <= 0) throw new BadRequestException(REPRICE_LENGTHEN_ONLY);
    const reprice = monthsDelta > 0 && (adjust.reprice ?? existing?.reprice ?? false);
    const when = stage === 'PENDING' ? 'approved' : 'disbursed';

    if (monthsDelta === 0) {
      if (!existing) return;
      await tx.tenureChange.update({ where: { id: existing.id }, data: { status: 'REJECTED' } });
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'TENURE_CHANGE_REJECTED',
        entityType: 'TENURE_CHANGE',
        entityId: existing.id,
        note: `Dropped when its top-up was ${when}`,
      });
      return;
    }

    const balances = await loanBalances(tx, loanId);
    assertLeavesMonths(balances.tenure + monthsDelta, balances.frozenCount);
    if (existing && existing.monthsDelta === monthsDelta && existing.reprice === reprice) return;

    let id: string;
    if (row) {
      await tx.tenureChange.update({ where: { id: row.id }, data: { monthsDelta, reprice, status: stage } });
      id = row.id;
    } else {
      try {
        const created = await tx.tenureChange.create({
          data: {
            loanId,
            previousTenure: balances.tenure,
            monthsDelta,
            reason: 'TOPUP',
            status: stage,
            requestedById: actorId,
            microLoanId,
            reprice,
          },
        });
        id = created.id;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(PENDING_EXISTS);
        }
        throw error;
      }
    }
    await this.ledgerTx.audit(tx, {
      actorId,
      action: 'TENURE_CHANGE_PROPOSED',
      entityType: 'TENURE_CHANGE',
      entityId: id,
      note: `Set when its top-up was ${when}: ${signed(monthsDelta)}${reprice ? ', interest recalculated' : ''}`,
    });
  }

  /** Compare-and-swap on PENDING: of two admins deciding at once, the second gets 409. */
  async approve(id: string, actorId: string, tx?: Tx): Promise<TenureChange> {
    return this.ledgerTx.run(tx, async (tx) => {
      const change = await this.decidable(id, tx);
      await this.ledgerTx.lockLoan(tx, change.loanId);
      const { count } = await tx.tenureChange.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED' },
      });
      if (count === 0) throw new ConflictException(ALREADY_DECIDED);

      const { tenure, borrowerId, interestAdded } = await this.applyToLoan(change, tx);
      if (interestAdded.gt(0)) await assertLedgerInvariants(tx, change.loanId);
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'TENURE_CHANGE_APPROVED',
        entityType: 'TENURE_CHANGE',
        entityId: id,
        note:
          `${signed(change.monthsDelta)}: tenure ${tenure - change.monthsDelta} → ${tenure}` +
          (interestAdded.gt(0) ? `, interest +${interestAdded.toFixed(2)}` : ''),
      });
      this.ledgerTx.emit(tx, 'tenure-change.approved', {
        changeId: id,
        loanId: change.loanId,
        borrowerId,
        monthsDelta: change.monthsDelta,
        tenure,
      });
      return tx.tenureChange.findUniqueOrThrow({ where: { id } });
    });
  }

  async reject(id: string, actorId: string, note?: string, tx?: Tx): Promise<TenureChange> {
    return this.ledgerTx.run(tx, async (tx) => {
      const change = await this.decidable(id, tx);
      const { count } = await tx.tenureChange.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      if (count === 0) throw new ConflictException(ALREADY_DECIDED);

      const loan = await tx.loan.findUniqueOrThrow({ where: { id: change.loanId }, select: { borrowerId: true } });
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'TENURE_CHANGE_REJECTED',
        entityType: 'TENURE_CHANGE',
        entityId: id,
        note,
      });
      this.ledgerTx.emit(tx, 'tenure-change.rejected', {
        changeId: id,
        loanId: change.loanId,
        borrowerId: loan.borrowerId,
        monthsDelta: change.monthsDelta,
        note,
      });
      return tx.tenureChange.findUniqueOrThrow({ where: { id } });
    });
  }

  /**
   * Moves the loan's tenure by the change and re-spreads its OPEN deduction; a repriced change first books
   * interest for the added months (repriceInterest) as an INTEREST microloan. Also used by the top-up
   * disbursement for the change requested with it. Caller holds the loan lock, and checks the ledger invariants
   * once its whole operation is written: mid-way through a top-up disbursement the top-up is already DISBURSED
   * but not yet in `owed`.
   */
  async applyToLoan(
    change: Pick<TenureChange, 'id' | 'loanId' | 'monthsDelta'> & { reprice?: boolean },
    tx: Tx,
  ): Promise<{ tenure: number; borrowerId: string; interestAdded: Money }> {
    const balances = await loanBalances(tx, change.loanId);
    if (balances.status !== 'DISBURSED') throw new ConflictException(LOAN_NOT_ACTIVE);
    const tenure = balances.tenure + change.monthsDelta;
    assertLeavesMonths(tenure, balances.frozenCount);

    let interestAdded = ZERO;
    if (change.reprice) {
      interestAdded = repriceInterest(
        balances.booked,
        balances.collected,
        balances.committed,
        balances.interestRate,
        change.monthsDelta,
      );
      if (interestAdded.gt(0)) {
        await tx.microLoan.create({
          data: {
            loanId: change.loanId,
            amount: interestAdded,
            purpose: 'INTEREST',
            status: 'DISBURSED',
            disbursedAt: new Date(),
          },
        });
        await tx.loan.update({ where: { id: change.loanId }, data: { owed: { increment: interestAdded } } });
      }
    }

    await tx.tenureChange.update({
      where: { id: change.id },
      data: { previousTenure: balances.tenure, ...(change.reprice ? { interestAdded: money(interestAdded) } : {}) },
    });
    await tx.loan.update({ where: { id: change.loanId }, data: { tenure } });
    await this.deductions.refreshOpen(change.loanId, tx);
    return { tenure, borrowerId: balances.borrowerId, interestAdded };
  }

  async list(filters: TenureChangeFilters = {}) {
    const where: Prisma.TenureChangeWhereInput = {
      status: filters.status,
      loanId: filters.loanId,
      loan: filters.borrowerId ? { borrowerId: filters.borrowerId } : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.tenureChange.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: filters.take ?? 20,
        include: {
          loan: {
            select: {
              id: true,
              tenure: true,
              borrower: { select: { userId: true, user: { select: { name: true } } } },
            },
          },
          requestedBy: { select: { userId: true, user: { select: { name: true } } } },
        },
      }),
      this.prisma.tenureChange.count({ where }),
    ]);
    return { rows, total };
  }

  private async decidable(id: string, tx: Tx): Promise<TenureChange> {
    const change = await tx.tenureChange.findUnique({ where: { id } });
    if (!change) throw new NotFoundException('Tenure change not found');
    if (change.microLoanId) throw new ConflictException(DECIDED_WITH_TOPUP);
    return change;
  }
}
