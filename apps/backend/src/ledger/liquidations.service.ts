import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PaymentInflow } from '@prisma/client';
import { loanBalances } from './balances';
import { LedgerClock } from './ledger.clock';
import { ALREADY_DECIDED } from './ledger.constants';
import { LedgerService, type Allocation } from './ledger.service';
import { LedgerTx, type Tx } from './ledger.tx';
import { money, naira, toNumber } from './money';
import { PeriodsService } from './periods.service';

export interface RequestLiquidation {
  /** Set when the proof was stored under the inflow's id before the row existed. */
  id?: string;
  customerId: string;
  amount: Prisma.Decimal.Value;
  /** Path of the uploaded proof in the private proofs bucket (required on every liquidation). */
  proofPath: string;
}

export type LiquidationDecision = { approve: true } | { approve: false; note?: string };

// A customer (or an admin for them) pays some or all of the loan outside payroll. It waits as
// an AWAITING inflow with proof until a super admin decides; approval applies it at once by the
// ratio method, with the amount checked again against what is owed then (V2.MD §0.4-4).
@Injectable()
export class LiquidationsService {
  constructor(
    private readonly ledgerTx: LedgerTx,
    private readonly ledger: LedgerService,
    private readonly periods: PeriodsService,
    private readonly clock: LedgerClock,
  ) {}

  async request(input: RequestLiquidation, tx?: Tx): Promise<PaymentInflow> {
    const amount = money(input.amount);
    if (amount.lte(0)) throw new BadRequestException('Enter the amount paid');
    if (!input.proofPath) throw new BadRequestException('Attach proof of payment');

    return this.ledgerTx.run(tx, async (tx) => {
      const loanId = await this.activeLoanId(input.customerId, tx);
      const { outstanding } = await loanBalances(tx, loanId);
      if (amount.gt(outstanding)) {
        throw new ConflictException(`That is more than the ${naira(outstanding)} still owed`);
      }
      const period = await this.periods.current(tx);
      return tx.paymentInflow.create({
        data: {
          id: input.id,
          source: 'LIQUIDATION',
          state: 'AWAITING',
          periodId: period.id,
          amount,
          customerId: input.customerId,
          proofPath: input.proofPath,
          createdAt: this.clock.now(),
        },
      });
    });
  }

  async decide(
    inflowId: string,
    decision: LiquidationDecision,
    actorId: string,
    tx?: Tx,
  ): Promise<{ inflow: PaymentInflow; allocation: Allocation | null }> {
    return this.ledgerTx.run(tx, async (tx) => {
      const inflow = await tx.paymentInflow.findUnique({ where: { id: inflowId } });
      if (!inflow || inflow.source !== 'LIQUIDATION' || !inflow.customerId) {
        throw new NotFoundException('Liquidation request not found');
      }
      // Approving needs a live loan to pay into; a rejection can come after the loan was cleared.
      const loanId = decision.approve
        ? await this.activeLoanId(inflow.customerId, tx)
        : await this.latestLoanId(inflow.customerId, tx);
      const { count } = await tx.paymentInflow.updateMany({
        where: { id: inflowId, state: 'AWAITING' },
        data: { state: decision.approve ? 'SETTLED' : 'REJECTED' },
      });
      if (count === 0) throw new ConflictException(ALREADY_DECIDED);

      let allocation: Allocation | null = null;
      if (decision.approve) {
        await this.ledgerTx.lockLoan(tx, loanId);
        const { outstanding } = await loanBalances(tx, loanId);
        if (inflow.amount.gt(outstanding)) {
          throw new ConflictException(
            `The loan now has only ${naira(outstanding)} outstanding; reject this request and ask for a new one`,
          );
        }
        allocation = await this.ledger.allocatePayment({ loanId, amount: inflow.amount, inflowId }, tx);
      }

      const note = decision.approve ? undefined : decision.note;
      await this.ledgerTx.audit(tx, {
        actorId,
        action: decision.approve ? 'PAYMENT_INFLOW_APPROVED' : 'PAYMENT_INFLOW_REJECTED',
        entityType: 'PAYMENT_INFLOW',
        entityId: inflowId,
        note,
      });
      this.ledgerTx.emit(tx, 'liquidation.decided', {
        loanId,
        borrowerId: inflow.customerId,
        inflowId,
        amount: toNumber(inflow.amount),
        approved: decision.approve,
        note,
      });
      return { inflow: await tx.paymentInflow.findUniqueOrThrow({ where: { id: inflowId } }), allocation };
    });
  }

  private async activeLoanId(customerId: string, tx: Tx): Promise<string> {
    const loan = await tx.loan.findFirst({
      where: { borrowerId: customerId, status: 'DISBURSED' },
      select: { id: true },
    });
    if (!loan) throw new ConflictException('This customer has no active loan');
    return loan.id;
  }

  private async latestLoanId(customerId: string, tx: Tx): Promise<string> {
    const loan = await tx.loan.findFirst({
      where: { borrowerId: customerId, status: { in: ['DISBURSED', 'REPAID'] } },
      orderBy: { disbursementDate: 'desc' },
      select: { id: true },
    });
    if (!loan) throw new ConflictException('This customer has no disbursed loan');
    return loan.id;
  }
}
