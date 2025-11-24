import { Loan, Prisma } from '@prisma/client';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';

interface LoanAndConfigUpdate {
  repaidAmount: Prisma.Decimal;
  totalPayable: Prisma.Decimal;
  penalty: Prisma.Decimal;
  interestRevenue: Prisma.Decimal;
}

export async function updateLoansAndConfigs(
  prisma: PrismaService,
  config: ConfigService,
  loan: Pick<Loan, 'repaid' | 'id'>,
  update: LoanAndConfigUpdate,
) {
  const { repaidAmount, totalPayable, penalty, interestRevenue } = update;

  const amountRepaid = loan.repaid.add(repaidAmount);
  await prisma.loan.update({
    where: { id: loan.id },
    data: {
      repaid: amountRepaid,
      penalty: { increment: penalty },
      ...(amountRepaid.gte(totalPayable) && { status: 'REPAID' }),
      ...(penalty.gt(new Prisma.Decimal(0)) && { extension: { increment: 1 } }),
    },
  });

  await Promise.all([
    config.topupValue('INTEREST_RATE_REVENUE', interestRevenue.toNumber()),
    config.topupValue('PENALTY_FEE_REVENUE', penalty.toNumber()),
    config.topupValue('TOTAL_REPAID', repaidAmount.toNumber()),
  ]);
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

export function calculateAmortizedPayment(
  principal: number, // (amount borrowed + penalty charge) - repaid
  annualRate: number, // in percentage value -> 10% = 0.1
  months: number, // tenure + extension
) {
  const monthlyRate = annualRate / 12; // monthly interest rate

  if (monthlyRate === 0) {
    return principal / months;
  }

  const monthlyPayment =
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

  return monthlyPayment;
}
