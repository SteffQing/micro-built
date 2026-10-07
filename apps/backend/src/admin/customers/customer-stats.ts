import type { Prisma, UserStatus } from '@prisma/client';
import type { PrismaService } from 'src/database/prisma.service';
import { loanBalancesMany } from 'src/ledger/balances';
import { sum, toNumber } from 'src/ledger/money';
import { repaymentRates } from 'src/ledger/repayment-rate';
import type { AccountOfficerStatsDto } from '../common/entities/customers.entities';

/**
 * A group of customers (an account officer's, an organization's) by status, and the ledger figures of their loans that
 * were disbursed.
 */
export async function customerGroupStats(
  prisma: PrismaService,
  where: Prisma.CustomerWhereInput,
): Promise<AccountOfficerStatsDto> {
  const [statuses, customers, loans] = await Promise.all([
    prisma.user.groupBy({
      by: ['status'],
      where: { customer: { is: where } },
      _count: { _all: true },
    }),
    prisma.customer.findMany({ where, select: { userId: true } }),
    prisma.loan.findMany({
      where: { borrower: where, status: { in: ['DISBURSED', 'REPAID'] } },
      select: { id: true },
    }),
  ]);

  const byStatus: Record<UserStatus, number> = { ACTIVE: 0, INACTIVE: 0, FLAGGED: 0 };
  for (const row of statuses) byStatus[row.status] = row._count._all;
  const rates = [
    ...(
      await repaymentRates(
        prisma,
        customers.map((customer) => customer.userId),
      )
    ).values(),
  ];
  const avgRepaymentScore = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;

  const balances = [...(await loanBalancesMany(prisma, loans.map((loan) => loan.id))).values()];
  return {
    customers: {
      total: byStatus.ACTIVE + byStatus.INACTIVE + byStatus.FLAGGED,
      active: byStatus.ACTIVE,
      inactive: byStatus.INACTIVE,
      flagged: byStatus.FLAGGED,
      avgRepaymentScore,
    },
    portfolio: {
      totalLoans: loans.length,
      totalDisbursed: toNumber(sum(balances.map((loan) => loan.booked.principal))),
      totalRepaid: toNumber(sum(balances.map((loan) => loan.repaid))),
      totalPenalty: toNumber(sum(balances.map((loan) => loan.booked.penalty))),
      outstandingBalance: toNumber(sum(balances.map((loan) => loan.outstanding))),
    },
  };
}
