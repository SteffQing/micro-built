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
  const { interestRate } = await prisma.loan.update({
    where: { id: loan.id },
    data: {
      amountRepaid,
      ...(amountRepaid.gte(loan.amountRepayable) && { status: 'REPAID' }),
    },
    select: { interestRate: true },
  });

  const interestRevenue = repaidAmount.mul(interestRate);
  await Promise.all([
    config.topupValue('INTEREST_RATE_REVENUE', interestRevenue.toNumber()),
    config.topupValue('PENALTY_FEE_REVENUE', penalty.toNumber()),
    config.topupValue('TOTAL_REPAID', repaidAmount.toNumber()),
  ]);
}

export function calculateThisMonthPayment(
  penaltyRate: number,
  periodInDT: Date,
  loan: Pick<
    ActiveLoan,
    'amountRepayable' | 'disbursementDate' | 'tenure' | 'amountRepaid'
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

  return { totalPayable, amountDue, penaltyCharge };
}

export function calculateActiveLoanRepayment(
  repaymentBalance: Prisma.Decimal,
  penaltyRate: number,
  periodInDT: Date,
  loan: Omit<
    ActiveLoan,
    'user' | 'createdAt' | 'updatedAt' | 'repayments' | 'penaltyAmount'
  >,
) {
  const { totalPayable, penaltyCharge, amountDue } = calculateThisMonthPayment(
    penaltyRate,
    periodInDT,
    loan,
  );

  const repaymentAmount = Prisma.Decimal.min(repaymentBalance, totalPayable);

  return { repaymentAmount, amountDue, penaltyCharge, totalPayable };
}

export function parsePeriodToDate(period: string): Date {
  if (/^\d+$/.test(period.toString())) {
    const serial = parseInt(period.toString(), 10);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel's day 0
    return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
  }
  const [monthStr, yearStr] = period.trim().split(' ');

  const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
  const year = parseInt(yearStr, 10);

  if (isNaN(monthIndex) || isNaN(year)) {
    throw new Error(`Invalid period format: ${period}`);
  }

  return new Date(year, monthIndex, 28, 0, 0, 0, 0);
}

export function parseDateToPeriod(givenDate?: Date) {
  const today = new Date();
  const date = givenDate ?? today;
  const period = date
    .toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    .toUpperCase();

  return period;
}
