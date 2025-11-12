import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Auth, Public, UserEvents } from './events';
import { MailService } from 'src/notifications/mail.service';
import { ResetPasswordBodyDto, SignupBodyDto } from 'src/auth/dto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/database/prisma.service';
import { RedisService } from 'src/database/redis.service';
import { generateCode } from 'src/common/utils';
import { CreateLoanDto, UpdateLoanDto } from 'src/user/common/dto';
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
          status: dto.contact ? 'ACTIVE' : 'INACTIVE',
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
        data: { password: hashedPassword },
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
        data: { password: hash },
      });
    } catch (error) {
      console.error('Error in userUpdatePassword', error);
    }
  }
}

@Injectable()
export class UserLoanService {
  constructor(
    private readonly prisma: PrismaService,
    // private readonly config: ConfigService,
  ) {}

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
