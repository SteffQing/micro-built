interface ILoanCalculator {
  calculateMonthlyPayment(
    principal: number, // (amount borrowed + penalty charge) - repaid
    annualRate: number, // in percentage value -> 10% = 0.1
    tenure: number, // tenure + extension
  ): number;
  calculateInterestForMonth(
    principal: number,
    annualRate: number,
    tenure: number,
    currentMonthIndex: number,
  ): number;
  calculateInterestRevenue(
    principal: number,
    annualRate: number,
    tenure: number,
    amountPaid: number,
  ): number;
}

class SimpleInterestLoan implements ILoanCalculator {
  calculateMonthlyPayment(
    principal: number,
    annualRate: number,
    tenure: number,
  ): number {
    const totalInterest = principal * (annualRate * (tenure / 12));
    return (principal + totalInterest) / tenure;
  }

  calculateInterestForMonth(
    principal: number,
    annualRate: number,
    tenure: number,
  ): number {
    // In simple interest, the interest portion of the payment is constant every month
    const totalInterest = principal * (annualRate * (tenure / 12));
    return totalInterest / tenure;
  }

  calculateInterestRevenue(
    principal: number,
    annualRate: number,
    tenure: number,
    amountPaid: number,
  ): number {
    const totalInterest = principal * (annualRate * (tenure / 12));
    const totalPayable = principal + totalInterest;
    const profitRatio = totalPayable > 0 ? totalInterest / totalPayable : 0;
    return amountPaid * profitRatio;
  }
}

class AmortizedLoan implements ILoanCalculator {
  calculateMonthlyPayment(
    principal: number,
    annualRate: number,
    tenure: number,
  ): number {
    const r = annualRate / 12;
    if (r === 0) return principal / tenure;

    return (principal * r) / (1 - Math.pow(1 + r, -tenure));
  }

  calculateInterestForMonth(
    principal: number,
    annualRate: number,
    tenure: number,
    currentMonthIndex: number,
  ): number {
    if (annualRate === 0 || tenure === 0) return 0;

    const r = annualRate / 12;
    const pmt = this.calculateMonthlyPayment(principal, annualRate, tenure);
    const k = currentMonthIndex - 1;

    if (k === 0) return principal * r;

    const compoundFactor = Math.pow(1 + r, k);
    const balanceAtStartOfMonth =
      principal * compoundFactor - (pmt * (compoundFactor - 1)) / r;

    return Math.max(0, balanceAtStartOfMonth * r);
  }

  calculateInterestRevenue(
    principal: number,
    annualRate: number,
    tenure: number,
    amountPaid: number,
  ): number {
    const monthlyPayment = this.calculateMonthlyPayment(
      principal,
      annualRate,
      tenure,
    );
    const totalPayment = monthlyPayment * tenure;
    const totalInterest = totalPayment - principal;

    const profitRatio = totalPayment > 0 ? totalInterest / totalPayment : 0;
    return amountPaid * profitRatio;
  }
}

abstract class Interest {
  protected roundTo2(amount: number) {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  abstract getMonthlyPayment(
    principal: number,
    rate: number,
    tenure: number,
  ): number;

  // principal is directly the principal
  // rate is the monthly interest chargedv - 10% written as 0.1
  // tenure is number of months
  abstract getTotalPayment(
    principal: number,
    rate: number,
    tenure: number,
  ): number;

  abstract getLoanRevenue(
    currentPayment: number,
    totalRepaid: number,
    principal: number,
    rate: number,
    tenure: number,
    penalty?: number,
    extension?: number,
  ): number;
}

class FlatInterest extends Interest {
  getTotalPayment(principal: number, rate: number, tenure: number): number {
    const totalInterestRate = rate * tenure;
    const interest = principal * totalInterestRate;

    return principal + interest;
  }

  private _getMonthlyPayment(
    principal: number,
    rate: number,
    tenure: number,
    extension = 0,
  ): number {
    const totalPayment = this.getTotalPayment(principal, rate, tenure);
    return totalPayment / (tenure + extension);
  }

  getMonthlyPayment(
    principal: number,
    rate: number,
    tenure: number,
    extension = 0,
  ): number {
    return this.roundTo2(
      this._getMonthlyPayment(principal, rate, tenure, extension),
    );
  }

  getLoanRevenue(
    currentPayment: number,
    totalRepaid: number,
    principal: number,
    rate: number,
    tenure: number,
    penalty = 0,
    extension = 0,
  ): number {
    const totalPayment = this.getTotalPayment(principal, rate, tenure);
    const monthlyPayment = this._getMonthlyPayment(
      principal,
      rate,
      tenure,
      extension,
    );

    const penaltyAmount = totalPayment;
  }
}

const logic = new FlatInterest();
export { logic };
