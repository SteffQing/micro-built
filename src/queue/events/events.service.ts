import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Auth, CustomerPPIEvents, UserEvents } from './events';
import { MailService } from 'src/notifications/mail.service';
import { ResetPasswordBodyDto, SignupBodyDto } from 'src/auth/dto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/database/prisma.service';
import { RedisService } from 'src/database/redis.service';
import { generateCode } from 'src/common/utils';
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
export class AuthService {
  constructor(
    private mail: MailService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @OnEvent(Auth.userSignUp)
  async userSignUp(dto: SignupBodyDto & { userId: string }) {
    try {
      const hash = await bcrypt.hash(dto.password, 10);

      await this.prisma.user.create({
        data: {
          id: dto.userId,
          email: dto.email,
          contact: dto.contact,
          password: hash,
          name: dto.name,
          status: dto.contact ? 'FLAGGED' : 'INACTIVE',
          flagReason: 'New sign up via app! Requires documents to proceed',
        },
      });

      const code = generateCode.sixDigitCode();

      if (dto.email) {
        await this.mail.sendUserSignupVerificationEmail(dto.email, code);
        await this.redis.setEx(`verify:${dto.email}`, code, 600);
      } else {
        // Assuming you want to support contact-based (e.g., SMS) verification too
        // await this.smsService.sendSignupVerificationSMS(contact!, code);
        // await this.redisService.setEx(`verify:${contact}`, code, 600);
      }
    } catch (error) {
      console.error('Error in userSignUp', error);
    }
  }

  @OnEvent(Auth.userResendCode)
  async userResendCode(dto: { email: string; name: string }) {
    try {
      const oldCode = await this.redis.get(`verify:${dto.email}`);
      const newCode = generateCode.sixDigitCode();

      const code = oldCode ?? newCode;
      await this.mail.sendUserSignupVerificationEmail(
        dto.email,
        code,
        dto.name,
      );
      await this.redis.setEx(`verify:${dto.email}`, code, 600);
    } catch (error) {
      console.error('Error in userResendCode', error);
    }
  }

  @OnEvent(Auth.userResetPassword)
  async userResetPassword(dto: ResetPasswordBodyDto & { email: string }) {
    try {
      const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
      await this.prisma.user.update({
        where: { email: dto.email },
        data: {
          password: hashedPassword,
          flagReason:
            'User reset password! Requires admin to check in to confirm this action',
        },
      });

      await this.redis.del(`reset:${dto.token}`);
    } catch (error) {
      console.error('Error in userResetPassword', error);
    }
  }

  @OnEvent(Auth.userForgotPassword)
  async userForgotPassword(dto: { email: string; name: string }) {
    try {
      const { hashedToken, resetToken } = generateCode.resetToken();

      await this.mail.sendPasswordResetEmail(dto.email, resetToken, dto.name);
      await this.redis.setEx(`reset:${hashedToken}`, dto.email, 60 * 60);
    } catch (error) {
      console.error('Error in userForgotPassword', error);
    }
  }

  @OnEvent(Auth.userUpdatePassword)
  async userUpdatePassword(dto: { password: string; userId: string }) {
    try {
      const hash = await bcrypt.hash(dto.password, 10);
      await this.prisma.user.update({
        where: { id: dto.userId },
        data: {
          password: hash,
          flagReason:
            'User update password! Requires admin to check in to confirm this action',
        },
      });
    } catch (error) {
      console.error('Error in userUpdatePassword', error);
    }
  }
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(UserEvents.userLoanRequest)
  async userLoanRequest(dto: CreateLoanDto & UserLoanCreateEvent) {
    try {
      await this.prisma.loan.create({
        data: {
          category: dto.category,
          borrowerId: dto.userId,
          id: dto.id,
          interestRate: dto.interestPerAnnum,
          managementFeeRate: dto.managementFeeRate,
          principal: dto.amount,
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
