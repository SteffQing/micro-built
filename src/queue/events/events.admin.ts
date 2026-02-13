import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AdminEvents } from './events';
import { MailService } from 'src/notifications/mail.service';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/database/prisma.service';
import { generateCode, generateId } from 'src/common/utils';
import type {
  AdminInviteEvent,
  AdminLoanTopup,
  AdminResolveRepaymentEvent,
} from './event.interface';
import {
  AcceptCommodityLoanDto,
  CustomerCashLoan,
  InviteAdminDto,
  ManualRepaymentResolutionDto,
  OnboardCustomer,
} from 'src/admin/common/dto';
import { parsePeriodToDate } from 'src/common/utils/shared-repayment.logic';
import { LoanCategory, Prisma, UserRole } from '@prisma/client';
import { ConfigService } from 'src/config/config.service';
import { LoanService } from 'src/user/loan/loan.service';
import { CashLoanService } from 'src/admin/loan/loan.service';
import { logic } from 'src/common/logic/repayment.logic';

@Injectable()
export class AdminService {
  constructor(
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly user: LoanService,
    private readonly admin: CashLoanService,
  ) {}

  private async cashLoan(
    uid: string,
    dto: CustomerCashLoan,
    category: LoanCategory,
    adminId: string,
  ) {
    const cashDto = { amount: dto.amount, category };
    const { data } = await this.user.requestCashLoan(uid, cashDto, adminId);

    const loanId = data.id;
    const tenure = Number(dto.tenure);
    await this.admin.approveLoan(loanId, { tenure });
  }

  @OnEvent(AdminEvents.adminInvite)
  async adminInvite(dto: InviteAdminDto & AdminInviteEvent) {
    const { existing, adminId } = dto;
    try {
      if (existing) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { id: adminId, role: dto.role, status: 'ACTIVE' },
        });
      } else {
        const password = generateCode.generatePassword();
        const hash = await bcrypt.hash(password, 10);

        await this.prisma.user.create({
          data: {
            id: adminId,
            email: dto.email,
            password: hash,
            status: 'ACTIVE',
            role: dto.role,
            name: dto.name,
          },
        });

        await this.mail.sendAdminInvite(
          dto.email,
          dto.name,
          password,
          adminId,
          dto.role,
        );
      }
    } catch (error) {
      console.error('Error in adminInvite', error);
    }
  }

  @OnEvent(AdminEvents.adminResolveRepayment)
  async adminResolveRepayment(
    dto: ManualRepaymentResolutionDto & AdminResolveRepaymentEvent,
  ) {
    const [loan, repayment] = await Promise.all([
      this.prisma.loan.findUniqueOrThrow({
        where: { id: dto.loanId! },
        select: {
          principal: true,
          penalty: true,
          penaltyRepaid: true,
          interestRate: true,
          repaid: true,
          tenure: true,
          extension: true,
          repayable: true,
        },
      }),
      this.prisma.repayment.findUniqueOrThrow({
        where: { id: dto.id },
        select: {
          amount: true,
          period: true,
          penaltyCharge: true,
          userId: true,
        },
      }),
    ]);

    const repaymentAmount = repayment.amount; // the overflow
    const principal = loan.principal.add(loan.penalty);

    const amountOwedRaw = principal.sub(loan.repaid);
    const amountOwed = Prisma.Decimal.max(amountOwedRaw, 0);
    const repaymentToApply = Prisma.Decimal.min(repaymentAmount, amountOwed);

    await this.prisma.repayment.update({
      where: { id: dto.id },
      data: {
        failureNote: null,
        loanId: dto.loanId,
        status: 'FULFILLED',
        repaidAmount: repaymentToApply,
        expectedAmount: repaymentToApply,
        resolutionNote: dto.note,
      },
      select: { id: true },
    });

    if (repaymentAmount.gt(amountOwed)) {
      const balance = repaymentAmount.sub(amountOwed);
      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          period: repayment.period,
          periodInDT: parsePeriodToDate(repayment.period),
          status: 'MANUAL_RESOLUTION',
          failureNote: 'An overflow of repayment balance for the given user',
          userId: repayment.userId,
          amount: balance,
        },
      });
    }

    const revenue = logic.getLoanRevenue(repaymentToApply, loan);

    const loanRepaid = loan.repaid.add(repaymentToApply);
    await this.prisma.loan.update({
      where: { id: dto.loanId! },
      data: {
        repaid: loanRepaid,
        ...(loanRepaid.gte(principal) && { status: 'REPAID' }),
      },
    });

    await Promise.all([
      this.config.topupValue('TOTAL_REPAID', repaymentToApply.toNumber()),
      this.config.depleteValue(
        'BALANCE_OUTSTANDING',
        repaymentToApply.toNumber(),
      ),
      this.config.topupValue(
        'INTEREST_RATE_REVENUE',
        revenue.interest.toNumber(),
      ),
      this.config.topupValue('PENALTY_FEE_REVENUE', revenue.penalty.toNumber()),
    ]);
  }

  @OnEvent(AdminEvents.onboardCustomer)
  async onboardCustomer(data: {
    dto: OnboardCustomer;
    userId: string;
    adminId: string;
    adminRole: UserRole;
  }) {
    const { dto, userId, adminId, adminRole } = data;

    const password = generateCode.generatePassword();
    const hashedPassword = await bcrypt.hash(password, 10);
    const { externalId, ...payroll } = dto.payroll;
    const isMarketer = adminRole === 'MARKETER';

    await this.prisma.user.create({
      data: {
        id: userId,
        password: hashedPassword,
        externalId,
        status: isMarketer ? 'FLAGGED' : 'ACTIVE',
        ...(isMarketer
          ? {
              flagReason:
                'User onboarded by marketer. Needs admin review to be activated',
            }
          : {}),
        ...dto.user,
        identity: { create: { ...dto.identity } },
        paymentMethod: { create: { ...dto.paymentMethod } },
        accountOfficerId: adminId,
      },
    });
    await this.prisma.userPayroll.create({
      data: {
        ...payroll,
        userId: externalId,
      },
    });

    if (dto.user.email) {
      await this.mail.sendOnboardedCustomerInvite(
        dto.user.email,
        dto.user.name,
        password,
        dto.user.contact,
      );
    }

    if (!dto.loan) return;

    const { category, cashLoan, commodityLoan } = dto.loan;

    if (category === 'ASSET_PURCHASE') {
      await this.user.requestAssetLoan(
        userId,
        commodityLoan!.assetName,
        adminId,
      );
    } else await this.cashLoan(userId, cashLoan!, category, adminId);
  }

  @OnEvent(AdminEvents.approveCommodityLoan)
  async approveCommodityLoan(data: {
    cLoanId: string;
    dto: AcceptCommodityLoanDto;
    borrowerId: string;
  }) {
    const { cLoanId, dto, borrowerId } = data;
    const { privateDetails, publicDetails } = dto;

    const mRate = dto.managementFeeRate / 100;
    const iRate = dto.interestRate / 100;

    const loanId = generateId.loanId();
    await this.prisma.commodityLoan.update({
      where: { id: cLoanId },
      data: {
        privateDetails,
        publicDetails,
        inReview: false,
        loan: {
          create: {
            id: loanId,
            principal: dto.amount,
            category: 'ASSET_PURCHASE',
            managementFeeRate: mRate,
            interestRate: iRate,
            borrowerId: borrowerId,
            tenure: dto.tenure,
          },
        },
      },
    });

    await this.admin.approveLoan(loanId, dto);
  }

  @OnEvent(AdminEvents.disburseLoan)
  async disburseLoan(data: { loanId: string }) {
    const { principal, managementFeeRate, interestRate, tenure } =
      await this.prisma.loan.findUniqueOrThrow({
        where: { id: data.loanId },
        select: {
          principal: true,
          managementFeeRate: true,
          tenure: true,
          interestRate: true,
        },
      });

    const feeAmount = principal.mul(managementFeeRate); // managementFeeRate is a percentage (e.g., 0.03 - 3%)
    const disbursedAmount = principal.sub(feeAmount);
    const disbursementDate = new Date();

    const totalPayment = logic.getTotalPayment(
      principal.toNumber(),
      interestRate.toNumber(),
      tenure,
    );

    await this.prisma.loan.update({
      where: { id: data.loanId },
      data: {
        status: 'DISBURSED',
        disbursementDate,
        repayable: totalPayment,
      },
    });

    await Promise.all([
      this.config.topupValue('MANAGEMENT_FEE_REVENUE', feeAmount.toNumber()),
      this.config.topupValue('TOTAL_DISBURSED', disbursedAmount.toNumber()),
      this.config.topupValue('BALANCE_OUTSTANDING', totalPayment),
      this.config.topupValue('TOTAL_BORROWED', totalPayment),
    ]);

    // manage cases of notifying customer of this action
  }

  @OnEvent(AdminEvents.loanTopup)
  async loanTopup(data: AdminLoanTopup) {
    const { userId, adminId, dto } = data;
    const { category, cashLoan, commodityLoan } = dto;

    if (category === 'ASSET_PURCHASE') {
      await this.user.requestAssetLoan(
        userId,
        commodityLoan!.assetName,
        adminId,
      );
    } else await this.cashLoan(userId, cashLoan!, category, adminId);
  }
}
