export function getTotalPayment(principal: number, rate: number, tenure: number): number {
  const interestRate = rate / 100;
  const totalInterestRate = interestRate * tenure;
  const interest = principal * totalInterestRate;

  return principal + interest;
}

function _getMonthlyPayment(principal: number, rate: number, tenure: number, extension = 0): number {
  const totalPayment = getTotalPayment(principal, rate, tenure);
  return totalPayment / (tenure + extension);
}

export function getMonthlyPayment(principal: number, rate: number, tenure: number, extension = 0): number {
  return _getMonthlyPayment(principal, rate, tenure, extension);
}

export function roundTo2(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
