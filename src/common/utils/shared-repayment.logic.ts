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
