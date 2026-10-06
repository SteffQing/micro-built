import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  type DeductionStatus,
  type LoanCategory,
  type MicroLoan,
  type RepaymentComponent,
} from '@prisma/client';
import { generateId } from 'src/common/utils';
import { PrismaService } from 'src/database/prisma.service';
import { assertLedgerInvariants, loanBalances, type LoanBalances } from './balances';
import { DeductionsService } from './deductions.service';
import { ALREADY_DECIDED, LOAN_NOT_ACTIVE } from './ledger.constants';
import { LedgerClock } from './ledger.clock';
import { interestFor, splitPayment, type Components } from './ledger.math';
import { LedgerTx, type Tx } from './ledger.tx';
import { money, toNumber, ZERO, type Money } from './money';
import { lagosMonthOf, periodBounds } from './period';
import { PeriodsService } from './periods.service';
import { TenureChangesService } from './tenure-changes.service';

export interface RequestTopup {
  loanId: string;
  amount: Prisma.Decimal.Value;
  /** Admin who raised it for the customer; absent when the customer asked. */
  requestedById?: string;
  /** Extra (or fewer) months requested with the top-up, decided and applied with it. */
  monthsDelta?: number;
  /** With monthsDelta > 0: also book interest on the running loan for the added months. */
  reprice?: boolean;
  /** The asset request this top-up pays for. */
  commodityLoanId?: string;
}

/** A loan that was running before the platform (the existing-customer upload). */
export interface ImportLoan {
  borrowerId: string;
  category: LoanCategory;
  /** Cash handed over, or what the asset cost. */
  principal: Prisma.Decimal.Value;
  /** Interest already agreed (repayable − principal); 0 when an asset's price includes it. */
  interest: Prisma.Decimal.Value;
  /** Collected before the platform took the loan over. */
  repaid: Prisma.Decimal.Value;
  /** Months still to deduct from the first month payroll hasn't been sent: the loan's tenure here. */
  monthsLeft: number;
  disbursedAt: Date;
  /** Snapshotted like a new loan's, for top-ups taken later. */
  rates: { interestRate: Prisma.Decimal; managementFeeRate: Prisma.Decimal };
  /** An asset loan's commodity; its request is recorded approved and paid for by the principal. */
  commodityId?: string;
  requestedById?: string | null;
  actorId: string;
  /** For the audit entry, e.g. the original tenure. */
  note?: string;
}

export interface AllocatePayment {
  loanId: string;
  amount: Prisma.Decimal.Value;
  /** The PaymentInflow the money came in on (one repayment per inflow). */
  inflowId: string;
  /** The AWAITING (or PARTIAL) deduction a payroll payment settles; absent for a liquidation. */
  deductionId?: string;
}

export interface Allocation {
  /** Null when nothing could be applied (the loan was already clear). */
  repaymentId: string | null;
  applied: Money;
  /** Paid beyond what was outstanding: to refund. */
  unapplied: Money;
  split: Components;
  outstanding: Money;
  repaid: boolean;
  deductionStatus: DeductionStatus | null;
}

const COMPONENTS: Record<keyof Components, RepaymentComponent> = {
  principal: 'PRINCIPAL',
  interest: 'INTEREST',
  penalty: 'PENALTY',
};

// Every method here moves money on one loan, inside a transaction holding the loan's row lock,
// and checks the §0.2 invariants before it returns: owed and repaid only grow, owed equals the
// disbursed microloans, repaid equals the repayments and their breakdowns.
@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly deductions: DeductionsService,
    private readonly tenureChanges: TenureChangesService,
    private readonly periods: PeriodsService,
    private readonly clock: LedgerClock,
  ) {}

  balances(loanId: string, tx?: Tx): Promise<LoanBalances> {
    return loanBalances(tx ?? this.prisma, loanId);
  }

  /**
   * APPROVED → DISBURSED: books the principal and the interest for the whole tenure, opens the
   * first deduction and links the asset request of an asset loan.
   */
  async disburseLoan(loanId: string, actorId: string, tx?: Tx) {
    return this.ledgerTx.run(tx, async (tx) => {
      await this.ledgerTx.lockLoan(tx, loanId);
      const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId } });
      if (loan.status !== 'APPROVED') throw new ConflictException('Only an approved loan can be disbursed');
      if (loan.principal.lte(0) || loan.tenure < 1) {
        throw new ConflictException('Set the loan amount and tenure before disbursing it');
      }

      const at = this.clock.now();
      const principal = money(loan.principal);
      const interest = interestFor(principal, loan.interestRate, loan.tenure);
      const newLoan = await tx.microLoan.create({
        data: { loanId, amount: principal, purpose: 'NEW_LOAN', status: 'DISBURSED', disbursedAt: at },
      });
      if (interest.gt(0)) {
        await tx.microLoan.create({
          data: { loanId, amount: interest, purpose: 'INTEREST', status: 'DISBURSED', disbursedAt: at },
        });
      }
      await tx.loan.update({
        where: { id: loanId },
        data: { status: 'DISBURSED', disbursementDate: at, owed: { increment: principal.plus(interest) } },
      });

      const commodity = await tx.commodityLoan.findFirst({
        where: { loanId, status: 'APPROVED', microLoanId: null },
        select: { id: true },
      });
      if (commodity) {
        await tx.commodityLoan.update({ where: { id: commodity.id }, data: { microLoanId: newLoan.id } });
      }

      const deduction = await this.deductions.openFirst(loanId, tx);
      await this.ledgerTx.audit(tx, { actorId, action: 'LOAN_DISBURSED', entityType: 'LOAN', entityId: loanId });
      await assertLedgerInvariants(tx, loanId);

      const owed = money(principal.plus(interest));
      this.ledgerTx.emit(tx, 'loan.disbursed', {
        loanId,
        borrowerId: loan.borrowerId,
        principal: toNumber(principal),
        interest: toNumber(interest),
        owed: toNumber(owed),
        monthly: toNumber(deduction.expected),
      });
      return { loanId, principal, interest, owed, monthly: deduction.expected, deductionId: deduction.id };
    });
  }

  /**
   * Brings a loan that was already running onto the ledger, as it stands: principal and the
   * agreed interest booked on its real disbursement date, what was collected so far applied as
   * one opening payment (an IMPORT inflow), and the first deduction opened in START DATE's month, spreading
   * the rest over `monthsLeft`. Announces nothing: the customer already has this loan.
   */
  async importLoan(input: ImportLoan, tx?: Tx) {
    const principal = money(input.principal);
    const interest = money(input.interest);
    const repaid = money(input.repaid);
    const owed = money(principal.plus(interest));
    if (principal.lte(0)) throw new BadRequestException('An imported loan needs a principal');
    if (interest.lt(0) || repaid.lt(0)) throw new BadRequestException('Interest and repaid amounts cannot be negative');
    // A cleared loan isn't running: importing it would only announce "fully repaid" to the customer.
    if (repaid.gte(owed)) throw new BadRequestException(`Repaid (${repaid}) already covers the loan (${owed})`);
    if (!Number.isInteger(input.monthsLeft) || input.monthsLeft < 1) {
      throw new BadRequestException('An imported loan needs at least one month left');
    }

    return this.ledgerTx.run(tx, async (tx) => {
      const loanId = generateId.loanId();
      try {
        await tx.loan.create({
          data: {
            id: loanId,
            borrowerId: input.borrowerId,
            category: input.category,
            status: 'DISBURSED',
            interestRate: input.rates.interestRate,
            managementFeeRate: input.rates.managementFeeRate,
            tenure: input.monthsLeft,
            principal,
            owed,
            disbursementDate: input.disbursedAt,
            requestedById: input.requestedById ?? null,
            createdAt: input.disbursedAt,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('This customer already has a loan in progress');
        }
        throw error;
      }
      await this.ledgerTx.lockLoan(tx, loanId);

      const newLoan = await tx.microLoan.create({
        data: { loanId, amount: principal, purpose: 'NEW_LOAN', status: 'DISBURSED', disbursedAt: input.disbursedAt },
      });
      if (interest.gt(0)) {
        await tx.microLoan.create({
          data: { loanId, amount: interest, purpose: 'INTEREST', status: 'DISBURSED', disbursedAt: input.disbursedAt },
        });
      }
      if (input.commodityId) {
        await tx.commodityLoan.create({
          data: {
            loanId,
            commodityId: input.commodityId,
            status: 'APPROVED',
            microLoanId: newLoan.id,
            createdAt: input.disbursedAt,
          },
        });
      }

      let cleared = false;
      if (repaid.gt(0)) {
        const period = await this.periods.current(tx);
        // Not a payroll deduction: what was paid before the loan came over, booked in the current period.
        const inflow = await tx.paymentInflow.create({
          data: {
            source: 'IMPORT',
            state: 'SETTLED',
            periodId: period.id,
            amount: repaid,
            customerId: input.borrowerId,
            createdAt: this.clock.now(),
          },
        });
        cleared = (await this.allocatePayment({ loanId, amount: repaid, inflowId: inflow.id }, tx)).repaid;
      }
      // The sheet's schedule starts at START DATE: its month is the first deduction, unless that month's variation has
      // gone out (then the next unsent one). Never before last month, so an old start can't open long-past months.
      const deduction = cleared ? null : await this.deductions.openFirst(loanId, tx, this.firstImportMonth(input.disbursedAt));

      await this.ledgerTx.audit(tx, {
        actorId: input.actorId,
        action: 'LOAN_DISBURSED',
        entityType: 'LOAN',
        entityId: loanId,
        note: input.note ?? 'Imported running loan',
      });
      await assertLedgerInvariants(tx, loanId);
      return {
        loanId,
        owed,
        repaid,
        outstanding: money(owed.minus(repaid)),
        monthly: deduction?.expected ?? ZERO,
      };
    });
  }

  /** A top-up request on a live loan: a PENDING TOPUP microloan (nothing is owed until disbursed). */
  async requestTopup(input: RequestTopup, tx?: Tx): Promise<MicroLoan> {
    const amount = money(input.amount);
    if (amount.lte(0)) throw new BadRequestException('Enter a top-up amount');

    return this.ledgerTx.run(tx, async (tx) => {
      await this.ledgerTx.lockLoan(tx, input.loanId);
      const loan = await tx.loan.findUniqueOrThrow({ where: { id: input.loanId }, select: { status: true } });
      if (loan.status !== 'DISBURSED') throw new ConflictException(LOAN_NOT_ACTIVE);
      const open = await tx.microLoan.findFirst({
        where: { loanId: input.loanId, purpose: 'TOPUP', status: { in: ['PENDING', 'APPROVED'] } },
        select: { id: true },
      });
      if (open) throw new ConflictException('This loan already has a top-up waiting for a decision');

      const topup = await tx.microLoan.create({
        data: { loanId: input.loanId, amount, purpose: 'TOPUP', status: 'PENDING', disbursedAt: null },
      });
      if (input.monthsDelta) {
        await this.tenureChanges.propose(
          {
            loanId: input.loanId,
            monthsDelta: input.monthsDelta,
            reason: 'TOPUP',
            requestedById: input.requestedById,
            microLoanId: topup.id,
            reprice: input.reprice,
          },
          tx,
        );
      }
      if (input.commodityLoanId) {
        const { count } = await tx.commodityLoan.updateMany({
          where: { id: input.commodityLoanId, loanId: input.loanId, microLoanId: null },
          data: { microLoanId: topup.id },
        });
        if (count === 0) throw new ConflictException('That asset request is not open on this loan');
      }
      return topup;
    });
  }

  /**
   * PENDING → APPROVED, with the tenure change requested alongside it (applied on disbursement). `adjust` lets the
   * approver set, change or drop that change and whether it reprices (TenureChangesService.adjustForTopup).
   */
  async approveTopup(
    microLoanId: string,
    actorId: string,
    tx?: Tx,
    adjust?: { monthsDelta?: number | null; reprice?: boolean },
  ): Promise<MicroLoan> {
    return this.ledgerTx.run(tx, async (tx) => {
      const topup = await this.findTopup(microLoanId, tx);
      if (adjust && (adjust.monthsDelta !== undefined || adjust.reprice !== undefined)) {
        await this.ledgerTx.lockLoan(tx, topup.loanId);
        await this.tenureChanges.adjustForTopup(topup.loanId, microLoanId, adjust, actorId, tx);
      }
      const { count } = await tx.microLoan.updateMany({
        where: { id: microLoanId, purpose: 'TOPUP', status: 'PENDING' },
        data: { status: 'APPROVED' },
      });
      if (count === 0) throw new ConflictException(ALREADY_DECIDED);
      await tx.tenureChange.updateMany({ where: { microLoanId, status: 'PENDING' }, data: { status: 'APPROVED' } });

      const loan = await tx.loan.findUniqueOrThrow({ where: { id: topup.loanId }, select: { borrowerId: true } });
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'TOPUP_APPROVED',
        entityType: 'MICRO_LOAN',
        entityId: microLoanId,
      });
      this.ledgerTx.emit(tx, 'topup.decided', {
        loanId: topup.loanId,
        borrowerId: loan.borrowerId,
        microLoanId,
        amount: toNumber(topup.amount),
        approved: true,
      });
      return tx.microLoan.findUniqueOrThrow({ where: { id: microLoanId } });
    });
  }

  /** A pending or approved (not yet disbursed) top-up is turned down, with its tenure change. */
  async rejectTopup(microLoanId: string, actorId: string, note?: string, tx?: Tx): Promise<MicroLoan> {
    return this.ledgerTx.run(tx, async (tx) => {
      const topup = await this.findTopup(microLoanId, tx);
      const { count } = await tx.microLoan.updateMany({
        where: { id: microLoanId, purpose: 'TOPUP', status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'REJECTED' },
      });
      if (count === 0) throw new ConflictException(ALREADY_DECIDED);
      await tx.tenureChange.updateMany({
        where: { microLoanId, status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'REJECTED' },
      });

      const loan = await tx.loan.findUniqueOrThrow({ where: { id: topup.loanId }, select: { borrowerId: true } });
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'TOPUP_REJECTED',
        entityType: 'MICRO_LOAN',
        entityId: microLoanId,
        note,
      });
      this.ledgerTx.emit(tx, 'topup.decided', {
        loanId: topup.loanId,
        borrowerId: loan.borrowerId,
        microLoanId,
        amount: toNumber(topup.amount),
        approved: false,
        note,
      });
      return tx.microLoan.findUniqueOrThrow({ where: { id: microLoanId } });
    });
  }

  /**
   * APPROVED → DISBURSED: applies the tenure change approved with it first, then books interest
   * for the months left (amount × rate × remainingMonths) and re-spreads the monthly deduction.
   */
  async disburseTopup(microLoanId: string, actorId: string, tx?: Tx) {
    return this.ledgerTx.run(tx, async (tx) => {
      const topup = await this.findTopup(microLoanId, tx);
      const loanId = topup.loanId;
      await this.ledgerTx.lockLoan(tx, loanId);
      const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId } });
      if (loan.status !== 'DISBURSED') throw new ConflictException(LOAN_NOT_ACTIVE);

      const at = this.clock.now();
      const { count } = await tx.microLoan.updateMany({
        where: { id: microLoanId, purpose: 'TOPUP', status: 'APPROVED' },
        data: { status: 'DISBURSED', disbursedAt: at },
      });
      if (count === 0) throw new ConflictException('Only an approved top-up can be disbursed');

      const change = await tx.tenureChange.findFirst({ where: { microLoanId, status: 'APPROVED' } });
      if (change) await this.tenureChanges.applyToLoan(change, tx);

      const { remainingMonths } = await loanBalances(tx, loanId);
      const amount = money(topup.amount);
      const interest = interestFor(amount, loan.interestRate, remainingMonths);
      if (interest.gt(0)) {
        await tx.microLoan.create({
          data: { loanId, amount: interest, purpose: 'INTEREST', status: 'DISBURSED', disbursedAt: at },
        });
      }
      await tx.loan.update({
        where: { id: loanId },
        data: { principal: { increment: amount }, owed: { increment: amount.plus(interest) } },
      });
      const monthly = (await this.deductions.refreshOpen(loanId, tx)) ?? ZERO;

      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'TOPUP_DISBURSED',
        entityType: 'MICRO_LOAN',
        entityId: microLoanId,
      });
      await assertLedgerInvariants(tx, loanId);
      this.ledgerTx.emit(tx, 'topup.disbursed', {
        loanId,
        borrowerId: loan.borrowerId,
        microLoanId,
        amount: toNumber(amount),
        interest: toNumber(interest),
        monthly: toNumber(monthly),
      });
      return { loanId, amount, interest, monthly, remainingMonths };
    });
  }

  /** A charge added to what is owed (a missed or short deduction at period close). */
  async addPenalty(loanId: string, amount: Prisma.Decimal.Value, actorId: string, note?: string, tx?: Tx) {
    const penalty = money(amount);
    if (penalty.lte(0)) throw new BadRequestException('A penalty must be more than zero');

    return this.ledgerTx.run(tx, async (tx) => {
      await this.ledgerTx.lockLoan(tx, loanId);
      const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId }, select: { status: true, borrowerId: true } });
      if (loan.status !== 'DISBURSED') throw new ConflictException(LOAN_NOT_ACTIVE);

      const microLoan = await tx.microLoan.create({
        data: { loanId, amount: penalty, purpose: 'PENALTY', status: 'DISBURSED', disbursedAt: this.clock.now() },
      });
      await tx.loan.update({ where: { id: loanId }, data: { owed: { increment: penalty } } });
      await this.deductions.refreshOpen(loanId, tx);

      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'PENALTY_APPLIED',
        entityType: 'MICRO_LOAN',
        entityId: microLoan.id,
        note,
      });
      await assertLedgerInvariants(tx, loanId);
      this.ledgerTx.emit(tx, 'penalty.applied', {
        loanId,
        borrowerId: loan.borrowerId,
        microLoanId: microLoan.id,
        amount: toNumber(penalty),
        note,
      });
      return microLoan;
    });
  }

  /**
   * Applies money received to a loan by the ratio method (V2.MD §0.5), capped at what is
   * outstanding. With a deduction, settles it (FULFILLED or PARTIAL) before the OPEN deduction
   * is re-spread, so the next month isn't worked out against a payment still counted as due.
   */
  async allocatePayment(input: AllocatePayment, tx?: Tx): Promise<Allocation> {
    const received = money(input.amount);
    if (received.lte(0)) throw new BadRequestException('A payment must be more than zero');
    const { loanId, deductionId } = input;

    return this.ledgerTx.run(tx, async (tx) => {
      await this.ledgerTx.lockLoan(tx, loanId);
      const before = await loanBalances(tx, loanId);
      if (before.status !== 'DISBURSED') throw new ConflictException(LOAN_NOT_ACTIVE);

      const deduction = deductionId ? await tx.deduction.findUnique({ where: { id: deductionId } }) : null;
      if (deductionId) {
        if (!deduction || deduction.loanId !== loanId) throw new NotFoundException('Deduction not found on this loan');
        if (deduction.status !== 'AWAITING' && deduction.status !== 'PARTIAL') {
          throw new ConflictException(`This deduction is already ${deduction.status.toLowerCase()}`);
        }
      }

      const applied = money(Prisma.Decimal.min(received, before.outstanding));
      const unapplied = money(received.minus(applied));
      if (applied.isZero()) {
        return {
          repaymentId: null,
          applied,
          unapplied,
          split: { principal: ZERO, interest: ZERO, penalty: ZERO },
          outstanding: before.outstanding,
          repaid: false,
          deductionStatus: deduction?.status ?? null,
        };
      }

      const split = splitPayment(applied, before.booked, before.collected);
      let repaymentId: string;
      try {
        const repayment = await tx.repayment.create({
          data: {
            loanId,
            paymentInflowId: input.inflowId,
            deductionId: deductionId ?? null,
            amount: applied,
            createdAt: this.clock.now(),
            breakdown: {
              create: (Object.keys(COMPONENTS) as (keyof Components)[])
                .filter((part) => split[part].gt(0))
                .map((part) => ({ component: COMPONENTS[part], amount: split[part] })),
            },
          },
          select: { id: true },
        });
        repaymentId = repayment.id;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('This payment has already been applied');
        }
        throw error;
      }
      await tx.loan.update({ where: { id: loanId }, data: { repaid: { increment: applied } } });

      let deductionStatus: DeductionStatus | null = null;
      if (deduction) {
        const paid = await tx.repayment.aggregate({ where: { deductionId: deduction.id }, _sum: { amount: true } });
        deductionStatus = money(paid._sum.amount ?? 0).gte(deduction.expected) ? 'FULFILLED' : 'PARTIAL';
        await tx.deduction.update({
          where: { id: deduction.id },
          data: { status: deductionStatus, settledAt: deduction.settledAt ?? this.clock.now() },
        });
      }

      await this.deductions.refreshOpen(loanId, tx);
      const repaid = await this.markRepaidIfCleared(loanId, tx);
      await assertLedgerInvariants(tx, loanId);
      return {
        repaymentId,
        applied,
        unapplied,
        split,
        outstanding: money(before.outstanding.minus(applied)),
        repaid,
        deductionStatus,
      };
    });
  }

  /**
   * A DISBURSED loan with nothing outstanding becomes REPAID; its OPEN deduction drops to 0
   * (the STOP row payroll receives) and no further months are opened for it.
   */
  async markRepaidIfCleared(loanId: string, tx?: Tx): Promise<boolean> {
    return this.ledgerTx.run(tx, async (tx) => {
      const balances = await loanBalances(tx, loanId);
      if (balances.status !== 'DISBURSED' || balances.outstanding.gt(0)) return false;
      await tx.loan.update({ where: { id: loanId }, data: { status: 'REPAID' } });
      await tx.deduction.updateMany({ where: { loanId, status: 'OPEN' }, data: { expected: ZERO } });
      this.ledgerTx.emit(tx, 'loan.repaid', { loanId, borrowerId: balances.borrowerId });
      return true;
    });
  }

  async assertInvariants(loanId: string, tx?: Tx): Promise<void> {
    await assertLedgerInvariants(tx ?? this.prisma, loanId);
  }

  private async findTopup(microLoanId: string, tx: Tx): Promise<MicroLoan> {
    const topup = await tx.microLoan.findUnique({ where: { id: microLoanId } });
    if (!topup || topup.purpose !== 'TOPUP') throw new NotFoundException('Top-up not found');
    return topup;
  }

  /** START DATE, or the 1st of last month (Lagos) when START DATE is earlier. */
  private firstImportMonth(startDate: Date): Date {
    const { start: thisMonth } = periodBounds(lagosMonthOf(this.clock.now()));
    const lastMonth = periodBounds(lagosMonthOf(new Date(thisMonth.getTime() - 1))).start;
    return startDate < lastMonth ? lastMonth : startDate;
  }
}
