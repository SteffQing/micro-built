import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AdminEvents } from './events';
import { MailService } from 'src/notifications/mail.service';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/database/prisma.service';
import { RedisService } from 'src/database/redis.service';
import { generateCode, generateId } from 'src/common/utils';
import type {
  AdminInviteEvent,
  AdminResolveRepaymentEvent,
} from './event.interface';
import {
  InviteAdminDto,
  ManualRepaymentResolutionDto,
} from 'src/admin/common/dto';
import {
  calculateAmortizedPayment,
  parsePeriodToDate,
  updateLoansAndConfigs,
} from 'src/common/utils/shared-repayment.logic';
import { Prisma } from '@prisma/client';
import { ConfigService } from 'src/config/config.service';

@Injectable()
export class AdminService {
  constructor(
    private mail: MailService,
    private prisma: PrismaService,
    private config: ConfigService,
    private redis: RedisService,
  ) {}

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
    const loan = await this.prisma.loan.findUniqueOrThrow({
      where: { id: dto.loanId! },
    });

    const principal = Number(loan.principal.add(loan.penalty));
    const months = loan.tenure + loan.extension;
    const rate = loan.interestRate.toNumber();

    const pmt = calculateAmortizedPayment(principal, rate, months);
    const totalPayable = pmt * months;

    const amountOwed = totalPayable - loan.repaid.toNumber();
    const repaymentToApply = Prisma.Decimal.min(
      dto.repayment.amount,
      amountOwed,
    );

    const updateRepayment = () =>
      this.prisma.repayment.update({
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

    if (dto.repayment.amount.lte(amountOwed)) {
      await updateRepayment();
    } else {
      await updateRepayment();
      const balance = dto.repayment.amount.sub(amountOwed);
      await this.prisma.repayment.create({
        data: {
          id: generateId.repaymentId(),
          period: dto.repayment.period,
          periodInDT: parsePeriodToDate(dto.repayment.period),
          status: 'MANUAL_RESOLUTION',
          failureNote: 'An overflow of repayment balance for the given user',
          userId: dto.repayment.userId,
          amount: balance,
        },
      });
    }

    const interestRevenue = repaymentToApply.mul(months).sub(principal);

    const updates = {
      interestRevenue,
      totalPayable: new Prisma.Decimal(totalPayable),
      repaidAmount: repaymentToApply,
      penalty: dto.repayment.penalty,
    };

    await updateLoansAndConfigs(this.prisma, this.config, loan, updates);
  }
}
