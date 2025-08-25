import { Loan, Prisma } from '@prisma/client';
import { differenceInMonths } from 'date-fns';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';

export async function updateLoanAndConfigs(
  prisma: PrismaService,
  config: ConfigService,
  loan: Pick<Loan, 'amountRepaid' | 'amountRepayable' | 'penaltyAmount' | 'id'>,
  repaidAmount: Prisma.Decimal,
) {
  const amountRepaid = loan.amountRepaid.add(repaidAmount);
  const updatedLoan = await prisma.loan.update({
    where: { id: loan.id },
    data: {
      amountRepaid,
      ...(amountRepaid.gte(loan.amountRepayable) && { status: 'REPAID' }),
    },
    select: { amount: true, status: true, amountRepayable: true },
  });

  await config.topupValue('TOTAL_REPAID', repaidAmount.toNumber());
  if (updatedLoan.status === 'REPAID') {
    const totalRevenue = loan.amountRepayable.sub(updatedLoan.amount);
    const interestRevenue = totalRevenue.sub(loan.penaltyAmount);
    await Promise.all([
      config.topupValue('INTEREST_RATE_REVENUE', interestRevenue.toNumber()),
      config.topupValue('PENALTY_FEE_REVENUE', loan.penaltyAmount.toNumber()),
    ]);
  }

  return updatedLoan.amountRepayable;
}

export function calculateRepaymentValues(
  repaymentBalance: Prisma.Decimal,
  penaltyRate: number,
  periodInDT: Date,
  loan: Pick<
    Loan,
    | 'amountRepayable'
    | 'disbursementDate'
    | 'loanTenure'
    | 'extension'
    | 'amountRepaid'
  >,
) {
  const totalTenure = loan.loanTenure + loan.extension;
  const monthlyRepayment = loan.amountRepayable.div(totalTenure);
  const monthsSinceDisbursement = differenceInMonths(
    periodInDT,
    loan.disbursementDate!,
  );
  const periodsDue = Math.min(monthsSinceDisbursement + 1, totalTenure);

  const amountExpected = monthlyRepayment.mul(periodsDue);
  const amountDue = amountExpected.sub(loan.amountRepaid);
  //   if (amountDue.lte(0)) continue;

  let penaltyCharge = Prisma.Decimal(0);

  const amountOwed = amountDue.sub(monthlyRepayment);
  if (amountOwed.gt(0)) {
    penaltyCharge = amountOwed.mul(penaltyRate);
  }

  const totalPayable = amountDue.add(penaltyCharge);
  const repaymentAmount = Prisma.Decimal.min(repaymentBalance, totalPayable);

  return { repaymentAmount, amountDue, penaltyCharge };
}
