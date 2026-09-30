import { Prisma } from '@prisma/client';
import { FlatInterest } from './repayment.logic';

const DECIMAL_ZERO = new Prisma.Decimal(0);

type LoanPick = {
  principal: Prisma.Decimal;
  penalty: Prisma.Decimal;
  penaltyRepaid: Prisma.Decimal;
  interestRate: Prisma.Decimal;
  tenure: number;
  extension: number;
  repaid: Prisma.Decimal;
  repayable: Prisma.Decimal;
};

describe('FlatInterest.getLoanRevenue', () => {
  let flatInterest: FlatInterest;

  beforeEach(() => {
    flatInterest = new FlatInterest();
  });

  describe('When payment is less than or equal to penalty owed', () => {
    it('should allocate entire payment to penalty', () => {
      const loan: LoanPick = {
        principal: new Prisma.Decimal(1000),
        penalty: new Prisma.Decimal(100),
        penaltyRepaid: DECIMAL_ZERO,
        interestRate: new Prisma.Decimal(0.1),
        tenure: 12,
        extension: 0,
        repaid: DECIMAL_ZERO,
        repayable: new Prisma.Decimal(1100), // 1000 principal + 100 interest
      };

      const currentPayment = new Prisma.Decimal(50);
      const result = flatInterest.getLoanRevenue(currentPayment, loan);

      expect(result.penalty).toEqual(currentPayment);
      expect(result.interest).toEqual(DECIMAL_ZERO);
      expect(result.principalPaid).toEqual(DECIMAL_ZERO);
    });

    it('should handle exact penalty payment', () => {
      const loan: LoanPick = {
        principal: new Prisma.Decimal(1000),
        penalty: new Prisma.Decimal(100),
        penaltyRepaid: DECIMAL_ZERO,
        interestRate: new Prisma.Decimal(0.1),
        tenure: 12,
        extension: 0,
        repaid: DECIMAL_ZERO,
        repayable: new Prisma.Decimal(1100),
      };

      const currentPayment = new Prisma.Decimal(100);
      const result = flatInterest.getLoanRevenue(currentPayment, loan);

      expect(result.penalty).toEqual(currentPayment);
      expect(result.interest).toEqual(DECIMAL_ZERO);
      expect(result.principalPaid).toEqual(DECIMAL_ZERO);
    });

    it('should handle partial penalty already paid', () => {
      const loan: LoanPick = {
        principal: new Prisma.Decimal(1000),
        penalty: new Prisma.Decimal(100),
        penaltyRepaid: new Prisma.Decimal(30),
        interestRate: new Prisma.Decimal(0.1),
        tenure: 12,
        extension: 0,
        repaid: DECIMAL_ZERO,
        repayable: new Prisma.Decimal(1100),
      };

      const currentPayment = new Prisma.Decimal(50);
      const result = flatInterest.getLoanRevenue(currentPayment, loan);

      const penaltyOwed = new Prisma.Decimal(70); // 100 - 30
      expect(result.penalty).toEqual(currentPayment);
      expect(result.interest).toEqual(DECIMAL_ZERO);
      expect(result.principalPaid).toEqual(DECIMAL_ZERO);
    });
  });

  describe('When payment exceeds penalty owed', () => {
    it('should allocate penalty first, then distribute remainder proportionally', () => {
      const loan: LoanPick = {
        principal: new Prisma.Decimal(1000),
        penalty: new Prisma.Decimal(100),
        penaltyRepaid: DECIMAL_ZERO,
        interestRate: new Prisma.Decimal(0.1),
        tenure: 12,
        extension: 0,
        repaid: DECIMAL_ZERO,
        repayable: new Prisma.Decimal(1100), // 1000 principal + 100 interest
      };

      const currentPayment = new Prisma.Decimal(200);
      const result = flatInterest.getLoanRevenue(currentPayment, loan);

      // Penalty: 100 (full penalty)
      // Balance: 200 - 100 = 100
      // Total interest: 1100 - 1000 = 100
      // Interest ratio: 100 / 1100 = 0.090909...
      // Interest: 100 * 0.090909... = 9.09
      // Principal: 100 - 9.09 = 90.91

      expect(result.penalty).toEqual(new Prisma.Decimal(100));
      expect(result.interest.toNumber()).toBeCloseTo(9.09, 2);
      expect(result.principalPaid.toNumber()).toBeCloseTo(90.91, 2);
    });

    it('should handle partial penalty already paid with remainder', () => {
      const loan: LoanPick = {
        principal: new Prisma.Decimal(1000),
        penalty: new Prisma.Decimal(100),
        penaltyRepaid: new Prisma.Decimal(30),
        interestRate: new Prisma.Decimal(0.1),
        tenure: 12,
        extension: 0,
        repaid: DECIMAL_ZERO,
        repayable: new Prisma.Decimal(1100),
      };

      const currentPayment = new Prisma.Decimal(150);
      const result = flatInterest.getLoanRevenue(currentPayment, loan);

      // Penalty owed: 100 - 30 = 70
      // Balance: 150 - 70 = 80
      // Interest ratio: 100 / 1100 = 0.090909...
      // Interest: 80 * 0.090909... = 7.27
      // Principal: 80 - 7.27 = 72.73

      expect(result.penalty).toEqual(new Prisma.Decimal(70));
      expect(result.interest.toNumber()).toBeCloseTo(7.27, 2);
      expect(result.principalPaid.toNumber()).toBeCloseTo(72.73, 2);
    });

    it('should handle zero interest loan', () => {
      const loan: LoanPick = {
        principal: new Prisma.Decimal(1000),
        penalty: new Prisma.Decimal(50),
        penaltyRepaid: DECIMAL_ZERO,
        interestRate: DECIMAL_ZERO,
        tenure: 12,
        extension: 0,
        repaid: DECIMAL_ZERO,
        repayable: new Prisma.Decimal(1000), // No interest
      };

      const currentPayment = new Prisma.Decimal(200);
      const result = flatInterest.getLoanRevenue(currentPayment, loan);

      // Penalty: 50
      // Balance: 200 - 50 = 150
      // Total interest: 1000 - 1000 = 0
      // Interest ratio: 0 / 1000 = 0
      // Interest: 150 * 0 = 0
      // Principal: 150 - 0 = 150

      expect(result.penalty).toEqual(new Prisma.Decimal(50));
      expect(result.interest).toEqual(DECIMAL_ZERO);
      expect(result.principalPaid).toEqual(new Prisma.Decimal(150));
    });

    it('should handle high interest loan', () => {
      const loan: LoanPick = {
        principal: new Prisma.Decimal(1000),
        penalty: new Prisma.Decimal(50),
        penaltyRepaid: DECIMAL_ZERO,
        interestRate: new Prisma.Decimal(0.2),
        tenure: 12,
        extension: 0,
        repaid: DECIMAL_ZERO,
        repayable: new Prisma.Decimal(1200), // 1000 principal + 200 interest
      };

      const currentPayment = new Prisma.Decimal(300);
      const result = flatInterest.getLoanRevenue(currentPayment, loan);

      // Penalty: 50
      // Balance: 300 - 50 = 250
      // Total interest: 1200 - 1000 = 200
      // Interest ratio: 200 / 1200 = 0.166666...
      // Interest: 250 * 0.166666... = 41.67
      // Principal: 250 - 41.67 = 208.33

      expect(result.penalty).toEqual(new Prisma.Decimal(50));
      expect(result.interest.toNumber()).toBeCloseTo(41.67, 2);
      expect(result.principalPaid.toNumber()).toBeCloseTo(208.33, 2);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero payment', () => {
      const loan: LoanPick = {
        principal: new Prisma.Decimal(1000),
        penalty: new Prisma.Decimal(100),
        penaltyRepaid: DECIMAL_ZERO,
        interestRate: new Prisma.Decimal(0.1),
        tenure: 12,
        extension: 0,
        repaid: DECIMAL_ZERO,
        repayable: new Prisma.Decimal(1100),
      };

      const currentPayment = DECIMAL_ZERO;
      const result = flatInterest.getLoanRevenue(currentPayment, loan);

      expect(result.penalty).toEqual(DECIMAL_ZERO);
      expect(result.interest).toEqual(DECIMAL_ZERO);
      expect(result.principalPaid).toEqual(DECIMAL_ZERO);
    });

    it('should handle fully paid penalty', () => {
      const loan: LoanPick = {
        principal: new Prisma.Decimal(1000),
        penalty: new Prisma.Decimal(100),
        penaltyRepaid: new Prisma.Decimal(100),
        interestRate: new Prisma.Decimal(0.1),
        tenure: 12,
        extension: 0,
        repaid: DECIMAL_ZERO,
        repayable: new Prisma.Decimal(1100),
      };

      const currentPayment = new Prisma.Decimal(200);
      const result = flatInterest.getLoanRevenue(currentPayment, loan);

      // Penalty owed: 100 - 100 = 0
      // Balance: 200 - 0 = 200
      // Interest ratio: 100 / 1100 = 0.090909...
      // Interest: 200 * 0.090909... = 18.18
      // Principal: 200 - 18.18 = 181.82

      expect(result.penalty).toEqual(DECIMAL_ZERO);
      expect(result.interest.toNumber()).toBeCloseTo(18.18, 2);
      expect(result.principalPaid.toNumber()).toBeCloseTo(181.82, 2);
    });

    it('should handle very small payment less than penalty', () => {
      const loan: LoanPick = {
        principal: new Prisma.Decimal(1000),
        penalty: new Prisma.Decimal(100),
        penaltyRepaid: DECIMAL_ZERO,
        interestRate: new Prisma.Decimal(0.1),
        tenure: 12,
        extension: 0,
        repaid: DECIMAL_ZERO,
        repayable: new Prisma.Decimal(1100),
      };

      const currentPayment = new Prisma.Decimal(0.01);
      const result = flatInterest.getLoanRevenue(currentPayment, loan);

      expect(result.penalty).toEqual(currentPayment);
      expect(result.interest).toEqual(DECIMAL_ZERO);
      expect(result.principalPaid).toEqual(DECIMAL_ZERO);
    });
  });
});
