import { BadRequestException, Injectable } from '@nestjs/common';
import { comparePeriods, type Period } from '@microbuilt/shared';
import { PrismaService } from 'src/database/prisma.service';
import { managementFee } from './ledger.math';
import { money, ZERO } from './money';
import { periodBounds } from './period';
import { buildStatement, type Statement, type StatementAudience, type StatementEntry } from './statement';

export type StatementSubject = { loanId: string } | { customerId: string };

@Injectable()
export class StatementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One loan, or every disbursed loan of a customer, over the payroll months `from`..`to`
   * (Lagos). Interest is booked for the whole tenure when a loan (or top-up) is disbursed, so it
   * appears as one debit then.
   */
  async lines(subject: StatementSubject, range: { from: Period; to: Period }, audience: StatementAudience): Promise<Statement> {
    if (comparePeriods(range.from, range.to) > 0) throw new BadRequestException('`from` must not be after `to`');
    const loans = await this.prisma.loan.findMany({
      where:
        'loanId' in subject
          ? { id: subject.loanId }
          : { borrowerId: subject.customerId, status: { in: ['DISBURSED', 'REPAID'] } },
      select: { id: true, managementFeeRate: true },
    });
    const loanIds = loans.map((loan) => loan.id);
    const feeRate = new Map(loans.map((loan) => [loan.id, loan.managementFeeRate]));

    const [microLoans, repayments] = await Promise.all([
      this.prisma.microLoan.findMany({
        where: { loanId: { in: loanIds }, status: 'DISBURSED' },
        select: { id: true, loanId: true, amount: true, purpose: true, disbursedAt: true, createdAt: true },
      }),
      this.prisma.repayment.findMany({
        where: { loanId: { in: loanIds } },
        select: {
          id: true,
          loanId: true,
          amount: true,
          createdAt: true,
          breakdown: { select: { component: true, amount: true } },
          paymentInflow: { select: { source: true, period: { select: { year: true, month: true } } } },
        },
      }),
    ]);

    // Interest booked with a top-up is dated with it; the flag only changes the wording.
    const topupTimes = new Set(
      microLoans.filter((m) => m.purpose === 'TOPUP').map((m) => `${m.loanId}@${(m.disbursedAt ?? m.createdAt).getTime()}`),
    );
    const entries: StatementEntry[] = microLoans.map((m) => {
      const at = m.disbursedAt ?? m.createdAt;
      const amount = money(m.amount);
      if (m.purpose === 'NEW_LOAN' || m.purpose === 'TOPUP') {
        return {
          at,
          loanId: m.loanId,
          reference: m.id,
          type: 'DISBURSEMENT',
          amount,
          topup: m.purpose === 'TOPUP',
          managementFee: managementFee(amount, feeRate.get(m.loanId) ?? ZERO),
        };
      }
      return {
        at,
        loanId: m.loanId,
        reference: m.id,
        type: m.purpose,
        amount,
        topup: m.purpose === 'INTEREST' && topupTimes.has(`${m.loanId}@${at.getTime()}`),
      };
    });
    for (const r of repayments) {
      const part = (component: string) =>
        money(r.breakdown.find((b) => b.component === component)?.amount ?? 0);
      entries.push({
        at: r.createdAt,
        loanId: r.loanId,
        reference: r.id,
        type: 'REPAYMENT',
        amount: money(r.amount),
        source: r.paymentInflow.source,
        period: r.paymentInflow.period,
        split: { principal: part('PRINCIPAL'), interest: part('INTEREST'), penalty: part('PENALTY') },
      });
    }

    return buildStatement(
      entries,
      { start: periodBounds(range.from).start, end: periodBounds(range.to).end },
      audience,
    );
  }
}
