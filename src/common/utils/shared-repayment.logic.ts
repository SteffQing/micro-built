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

  // Payroll periods follow the business timezone (Africa/Lagos, UTC+1).
  // Construct the instant explicitly so UTC-hosted workers and Lagos-hosted
  // API servers resolve the same period to the same database value.
  return new Date(Date.UTC(year, monthIndex, 1) - 60 * 60 * 1000);
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
