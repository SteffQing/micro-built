import { ActiveLoan, Loan, Prisma } from '@prisma/client';
import { differenceInMonths } from 'date-fns';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';

export async function updateLoansAndConfigs(
  prisma: PrismaService,
  config: ConfigService,
  repaidAmount: Prisma.Decimal,
  penalty: Prisma.Decimal,
  loan: Pick<Loan, 'amountRepaid' | 'id' | 'amountRepayable'>,
) {
  const amountRepaid = loan.amountRepaid.add(repaidAmount);
  const { interestRate, amountRepayable } = await prisma.loan.update({
    where: { id: loan.id },
    data: {
      amountRepaid,
      ...(amountRepaid.gte(loan.amountRepayable) && { status: 'REPAID' }),
    },
    select: { interestRate: true, amountRepayable: true },
  });

  const interestRevenue = repaidAmount.mul(interestRate);
  await Promise.all([
    config.topupValue('INTEREST_RATE_REVENUE', interestRevenue.toNumber()),
    config.topupValue('PENALTY_FEE_REVENUE', penalty.toNumber()),
    config.topupValue('TOTAL_REPAID', repaidAmount.toNumber()),
  ]);

  return amountRepayable;
}

export function calculateActiveLoanRepayment(
  repaymentBalance: Prisma.Decimal,
  penaltyRate: number,
  periodInDT: Date,
  loan: Omit<
    ActiveLoan,
    | 'user'
    | 'createdAt'
    | 'updatedAt'
    | 'isNew'
    | 'repayments'
    | 'penaltyAmount'
  >,
) {
  const monthlyRepayment = loan.amountRepayable.div(loan.tenure);
  const monthsSinceDisbursement = differenceInMonths(
    periodInDT,
    loan.disbursementDate,
  );
  const monthsDue = Math.min(monthsSinceDisbursement + 1, loan.tenure);

  const amountExpected = monthlyRepayment.mul(monthsDue);
  const amountDue = amountExpected.sub(loan.amountRepaid);

  let penaltyCharge = Prisma.Decimal(0);

  const amountOwed = amountDue.sub(monthlyRepayment);
  if (amountOwed.gt(0)) {
    penaltyCharge = amountOwed.mul(penaltyRate);
  }

  const totalPayable = amountDue.add(penaltyCharge);
  const repaymentAmount = Prisma.Decimal.min(repaymentBalance, totalPayable);

  return { repaymentAmount, amountDue, penaltyCharge, totalPayable };
}
