import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AdminService } from './events.admin';
import { PrismaService } from 'src/database/prisma.service';
import { ConfigService } from 'src/config/config.service';
import { MailService } from 'src/notifications/mail.service';
import { LoanService } from 'src/user/loan/loan.service';
import { CashLoanService } from 'src/admin/loan/loan.service';

const dec = (n: number | string) => new Prisma.Decimal(n);
const ZERO = new Prisma.Decimal(0);

describe('AdminService.adminResolveRepayment', () => {
  let service: AdminService;
  let prisma: {
    loan: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
    repayment: { findUniqueOrThrow: jest.Mock; update: jest.Mock; create: jest.Mock };
  };
  let config: { topupValue: jest.Mock; depleteValue: jest.Mock };

  const baseLoan = {
    principal: dec(500_000),
    repayable: dec(860_000),
    penalty: ZERO,
    penaltyRepaid: ZERO,
    repaid: ZERO,
    interestRate: dec(0.06),
    tenure: 12,
    extension: 0,
  };

  const baseRepayment = {
    amount: dec(900_000),
    period: 'APRIL 2026',
    penaltyCharge: ZERO,
    userId: 'user-1',
  };

  beforeEach(async () => {
    prisma = {
      loan: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
      repayment: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    config = {
      topupValue: jest.fn().mockResolvedValue(undefined),
      depleteValue: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: MailService, useValue: {} },
        { provide: LoanService, useValue: {} },
        { provide: CashLoanService, useValue: {} },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  const callResolve = () =>
    service.adminResolveRepayment({
      id: 'rep-1',
      loanId: 'loan-1',
      note: 'manual resolution',
      userId: 'user-1',
    } as any);

  describe('Bug A — uses repayable, not principal, as the owed base', () => {
    it('caps repaymentToApply at repayable (860k), not principal (500k)', async () => {
      // Admin sends 900k for a loan with 860k total repayable, nothing paid yet
      prisma.loan.findUniqueOrThrow.mockResolvedValue(baseLoan);
      prisma.repayment.findUniqueOrThrow.mockResolvedValue(baseRepayment);
      prisma.repayment.update.mockResolvedValue({});
      prisma.repayment.create.mockResolvedValue({});
      prisma.loan.update.mockResolvedValue({});

      await callResolve();

      // repaymentToApply = min(900k, 860k) = 860k — not 500k
      const repUpdate = prisma.repayment.update.mock.calls[0][0];
      expect(repUpdate.data.repaidAmount.toNumber()).toBe(860_000);

      // Overflow of 40k should be created (900k - 860k)
      expect(prisma.repayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'MANUAL_RESOLUTION',
            amount: expect.any(Prisma.Decimal),
          }),
        }),
      );
      const overflowAmount =
        prisma.repayment.create.mock.calls[0][0].data.amount.toNumber();
      expect(overflowAmount).toBe(40_000);
    });
  });

  describe('Bug B — subtracts penaltyRepaid when computing amount owed', () => {
    it('reduces amountOwed by previously repaid penalty', async () => {
      // 5k penalty, all already repaid; 800k repaid — owes 60k more
      const loan = {
        ...baseLoan,
        penalty: dec(5_000),
        penaltyRepaid: dec(5_000),
        repaid: dec(800_000),
      };
      const repayment = { ...baseRepayment, amount: dec(100_000) };

      prisma.loan.findUniqueOrThrow.mockResolvedValue(loan);
      prisma.repayment.findUniqueOrThrow.mockResolvedValue(repayment);
      prisma.repayment.update.mockResolvedValue({});
      prisma.repayment.create.mockResolvedValue({});
      prisma.loan.update.mockResolvedValue({});

      await callResolve();

      // amountOwed = (860k + 5k) - (800k + 5k) = 60k
      // repaymentToApply = min(100k, 60k) = 60k
      const repUpdate = prisma.repayment.update.mock.calls[0][0];
      expect(repUpdate.data.repaidAmount.toNumber()).toBe(60_000);

      // overflow of 40k (100k - 60k)
      expect(prisma.repayment.create).toHaveBeenCalled();
      const overflow =
        prisma.repayment.create.mock.calls[0][0].data.amount.toNumber();
      expect(overflow).toBe(40_000);
    });
  });

  describe('Bug C — updates penaltyRepaid and uses correct REPAID check', () => {
    it('increments penaltyRepaid on the loan when penalty portion is applied', async () => {
      // 3583 outstanding penalty, 788334 repaid — payment covers penalty + some principal
      const loan = {
        ...baseLoan,
        penalty: dec(3_583),
        penaltyRepaid: ZERO,
        repaid: dec(788_334),
        extension: 1,
      };
      const repayment = { ...baseRepayment, amount: dec(75_000) };

      prisma.loan.findUniqueOrThrow.mockResolvedValue(loan);
      prisma.repayment.findUniqueOrThrow.mockResolvedValue(repayment);
      prisma.repayment.update.mockResolvedValue({});
      prisma.loan.update.mockResolvedValue({});

      await callResolve();

      const loanUpdate = prisma.loan.update.mock.calls[0][0];
      expect(loanUpdate.data.penaltyRepaid).toBeDefined();
      // penaltyRepaid increment should be the penalty portion (3583)
      const penaltyIncrement = loanUpdate.data.penaltyRepaid.increment.toNumber();
      expect(penaltyIncrement).toBeCloseTo(3_583, 0);
      // repaid should be updated (non-penalty portion)
      expect(loanUpdate.data.repaid.gt(dec(788_334))).toBe(true);
    });

    it('marks loan REPAID when totalRepaid reaches totalPayable on final payment', async () => {
      // loan is one payment away from being fully repaid
      const loan = {
        ...baseLoan,
        repaid: dec(788_334),  // 11 payments done
      };
      // final payment of exactly 71,666 (remaining balance)
      const repayment = { ...baseRepayment, amount: dec(71_666) };

      prisma.loan.findUniqueOrThrow.mockResolvedValue(loan);
      prisma.repayment.findUniqueOrThrow.mockResolvedValue(repayment);
      prisma.repayment.update.mockResolvedValue({});
      prisma.loan.update.mockResolvedValue({});

      await callResolve();

      const loanUpdate = prisma.loan.update.mock.calls[0][0];
      expect(loanUpdate.data.status).toBe('REPAID');
    });

    it('does NOT mark loan REPAID when payment only partially covers remaining balance', async () => {
      const loan = { ...baseLoan, repaid: dec(500_000) }; // still 360k short
      const repayment = { ...baseRepayment, amount: dec(50_000) };

      prisma.loan.findUniqueOrThrow.mockResolvedValue(loan);
      prisma.repayment.findUniqueOrThrow.mockResolvedValue(repayment);
      prisma.repayment.update.mockResolvedValue({});
      prisma.loan.update.mockResolvedValue({});

      await callResolve();

      const loanUpdate = prisma.loan.update.mock.calls[0][0];
      expect(loanUpdate.data.status).toBeUndefined();
    });
  });
});
