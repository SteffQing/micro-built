export function calculateAmortizedPayment(principal: number, annualRate: number, months: number): number {
  const monthlyRate = annualRate / 12;

  if (monthlyRate === 0) {
    return principal / months;
  }

  const monthlyPayment = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

  return monthlyPayment;
}

export function calculateTotalExpectedPayment(principal: number, interestRate: number, months: number): number {
  const monthlyPayment = calculateAmortizedPayment(principal, interestRate / 100, months);

  return monthlyPayment * months;
}

export function calculateTotalInterest(principal: number, interestRate: number, months: number): number {
  const totalPayment = calculateTotalExpectedPayment(principal, interestRate / 100, months);

  return totalPayment - principal;
}
