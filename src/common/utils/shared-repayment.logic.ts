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

export function calculateInterestForMonth(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  currentMonthIndex: number,
): number {
  if (annualRate === 0 || tenureMonths === 0) return 0;

  const r = annualRate / 12;
  const pmt = calculateAmortizedPayment(principal, annualRate, tenureMonths);

  // Calculate the Balance remaining BEFORE this payment (at end of prev month)
  // Formula: B_k = P(1+r)^k - PMT * ((1+r)^k - 1) / r
  // where k is the number of payments ALREADY made (currentMonthIndex - 1)
  const k = currentMonthIndex - 1;

  // Optimization: If 1st month, balance is simply Principal
  if (k === 0) {
    return principal * r;
  }

  const compoundFactor = Math.pow(1 + r, k);
  const balanceAtStartOfMonth =
    principal * compoundFactor - (pmt * (compoundFactor - 1)) / r;

  const interestForMonth = balanceAtStartOfMonth * r;

  return Math.max(0, interestForMonth);
}

export function calculateInterestRevenue(
  principal: number,
  annualRate: number,
  tenure: number,
  amountPaid: number,
) {
  // Here, only principal is the actual principal. tenure still adds up extension
  const monthlyPayment = calculateAmortizedPayment(
    principal,
    annualRate,
    tenure,
  );
  const totalPayment = monthlyPayment * tenure;
  const totalInterest = totalPayment - principal;

  const profitRatio = totalPayment > 0 ? totalInterest / totalPayment : 0;
  const interestRevenue = amountPaid * profitRatio;

  return interestRevenue;
}
