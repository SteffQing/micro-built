import { Loan, Prisma } from '@prisma/client';

const DECIMAL_ZERO = new Prisma.Decimal(0);

type LoanPick = Pick<
  Loan,
  | 'principal'
  | 'penalty'
  | 'penaltyRepaid'
  | 'interestRate'
  | 'tenure'
  | 'extension'
  | 'repaid'
  | 'repayable'
>;

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
    currentPayment: Prisma.Decimal,
    loan: LoanPick,
  ): {
    penalty: Prisma.Decimal;
    interest: Prisma.Decimal;
    principalPaid: Prisma.Decimal; // this is the balance after fee is removed
  };
}

class FlatInterest extends Interest {
  getTotalPayment(principal: number, rate: number, tenure: number): number {
    const totalInterestRate = rate * tenure;
    const interest = principal * totalInterestRate;

    return principal + interest;
  }

  getMonthlyPayment(
    principal: number,
    rate: number,
    tenure: number,
    extension = 0,
  ): number {
    const totalPayment = this.getTotalPayment(principal, rate, tenure);
    return totalPayment / (tenure + extension);
  }

  getMonthlyPayment_(
    principal: number,
    rate: number,
    tenure: number,
    extension = 0,
  ): number {
    return this.roundTo2(
      this.getMonthlyPayment(principal, rate, tenure, extension),
    );
  }

  getLoanRevenue(currentPayment: Prisma.Decimal, loan: LoanPick) {
    const penaltyOwed = loan.penalty.sub(loan.penaltyRepaid);
    if (penaltyOwed.gt(currentPayment)) {
      return {
        penalty: currentPayment,
        interest: DECIMAL_ZERO,
        principalPaid: DECIMAL_ZERO,
      };
    }

    const balance = currentPayment.sub(penaltyOwed);
    if (loan.repayable.lte(0)) {
      return { penalty: penaltyOwed, interest: DECIMAL_ZERO, principalPaid: balance };
    }
    const totalInterest = loan.repayable.sub(loan.principal);
    const interestRatio = totalInterest.div(loan.repayable);

    const interest = balance.mul(interestRatio);

    return {
      penalty: penaltyOwed,
      interest,
      principalPaid: balance.sub(interest),
    };
  }
}

const logic = new FlatInterest();
function roundTo2(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
export { FlatInterest, logic, roundTo2 };
