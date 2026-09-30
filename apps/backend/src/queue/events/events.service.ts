import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CustomerPPIEvents, UserEvents } from './events';
import { MailService } from 'src/notifications/mail.service';
import { PrismaService } from 'src/database/prisma.service';
import {
  CreateIdentityDto,
  CreateLoanDto,
  CreatePaymentMethodDto,
  CreatePayrollDto,
  UpdateIdentityDto,
  UpdateLoanDto,
  UpdatePaymentMethodDto,
  UpdatePayrollDto,
} from 'src/user/common/dto';
import type {
  UserCommodityLoanCreateEvent,
  UserLoanCreateEvent,
} from './event.interface';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(UserEvents.userLoanRequest)
  async userLoanRequest(dto: CreateLoanDto & UserLoanCreateEvent) {
    try {
      const hasActiveLoan = await this.prisma.loan.findFirst({
        where: {
          borrowerId: dto.userId,
          status: 'DISBURSED',
        },
        select: { id: true },
      });

      await this.prisma.loan.create({
        data: {
          category: dto.category,
          borrowerId: dto.userId,
          id: dto.id,
          interestRate: dto.interestPerAnnum,
          managementFeeRate: dto.managementFeeRate,
          principal: dto.amount,
          ...(dto.requestedBy && { requestedById: dto.requestedBy }),
          ...(hasActiveLoan ? { type: 'Topup' } : { type: 'New' }),
        },
      });
    } catch (error) {
      console.error('Error in userLoanRequest', error);
    }
  }

  @OnEvent(UserEvents.userLoanUpdate)
  async userLoanUpdate(dto: UpdateLoanDto & { loanId: string }) {
    try {
      await this.prisma.loan.update({
        where: { id: dto.loanId },
        data: {
          ...(dto.amount && { principal: dto.amount }),
          ...(dto.category && { category: dto.category }),
        },
      });
    } catch (error) {
      console.error('Error in userLoanUpdate', error);
    }
  }

  @OnEvent(UserEvents.userLoanDelete)
  async userLoanDelete(dto: { loanId: string }) {
    try {
      await this.prisma.loan.delete({
        where: { id: dto.loanId },
      });
    } catch (error) {
      console.error('Error in userLoanDelete', error);
    }
  }

  @OnEvent(UserEvents.userCommodityLoanRequest)
  async userCommodityLoanRequest(dto: UserCommodityLoanCreateEvent) {
    try {
      await this.prisma.commodityLoan.create({
        data: {
          name: dto.assetName,
          borrowerId: dto.userId,
          id: dto.id,
          ...(dto.requestedBy && { requestedById: dto.requestedBy }),
        },
      });
    } catch (error) {
      console.error('Error in userLoanUpdate', error);
    }
  }
}

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(CustomerPPIEvents.userCreateIdentity)
  async createUserIdentity(data: { dto: CreateIdentityDto; userId: string }) {
    const { dto, userId } = data;
    await this.prisma.userIdentity.create({ data: { ...dto, userId } });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'FLAGGED',
        flagReason:
          'User uploaded identity documents. Needs review by admin to confirm correctness of information',
      },
    });
  }

  @OnEvent(CustomerPPIEvents.userUpdateIdentity)
  async updateUserIdentity(data: { dto: UpdateIdentityDto; userId: string }) {
    const { dto, userId } = data;
    await this.prisma.userIdentity.update({
      where: { userId },
      data: { ...dto },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'FLAGGED',
        flagReason:
          'User updated identity documents. Needs review by admin to confirm correctness of information',
      },
    });
  }

  @OnEvent(CustomerPPIEvents.userCreatePayment)
  async createUserPaymentMethod(data: {
    dto: CreatePaymentMethodDto;
    userId: string;
  }) {
    const { dto, userId } = data;

    await this.prisma.userPaymentMethod.create({ data: { userId, ...dto } });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'FLAGGED',
        flagReason:
          'User added payment method. Needs review by admin to confirm correctness of information',
      },
    });
  }

  @OnEvent(CustomerPPIEvents.userUpdatePayment)
  async updateUserPaymentMethod(data: {
    dto: UpdatePaymentMethodDto;
    userId: string;
  }) {
    const { dto, userId } = data;
    await this.prisma.userPaymentMethod.update({
      where: { userId },
      data: { ...dto },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'FLAGGED',
        flagReason:
          'User updated payment method. Needs review by admin to confirm correctness of information',
      },
    });
  }

  @OnEvent(CustomerPPIEvents.userCreatePayroll)
  async createUserPayrollInfo(data: { dto: CreatePayrollDto; userId: string }) {
    const { dto, userId } = data;
    await this.prisma.userPayroll.create({
      data: {
        ...dto,
        userId: dto.externalId,
      },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        externalId: dto.externalId,
        status: 'FLAGGED',
        flagReason:
          'User added payroll information. Needs review by admin to confirm correctness of information',
      },
    });
  }

  @OnEvent(CustomerPPIEvents.userUpdatePayroll)
  async updateUserPayrollInfo(data: {
    dto: UpdatePayrollDto;
    userId: string;
    externalId: string;
  }) {
    const { dto, userId, externalId } = data;

    await this.prisma.userPayroll.update({
      where: { userId: externalId },
      data: { ...dto },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'FLAGGED',
        flagReason:
          'User updated payroll information. Needs review by admin to confirm correctness of information',
      },
    });
  }
}
