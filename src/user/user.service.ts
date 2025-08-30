import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdatePasswordDto } from './common/dto';
import * as bcrypt from 'bcrypt';
import { summarizeActivity } from './common/utils/activity';
import { ActivitySummary } from './common/interface';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        role: true,
        status: true,
        avatar: true,
        name: true,
        contact: true,
        id: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');

    const isOldPasswordValid = await bcrypt.compare(
      dto.oldPassword,
      user.password,
    );

    if (!isOldPasswordValid) {
      throw new BadRequestException(
        'Old password does not match existing password',
      );
    }

    const hash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
  }

  async uploadAvatar(file: Express.Multer.File, userId: string) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const url = await this.supabase.uploadUserAvatar(file, userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: url },
    });

    return {
      data: { url },
      message: `Avatar has been successfully updated!`,
    };
  }

  async getRecentActivities(userId: string) {
    const userPromise = this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    const identityPromise = this.prisma.userIdentity.findUnique({
      where: { userId },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    const paymentMethodPromise = this.prisma.userPaymentMethod.findUnique({
      where: { userId },
      select: {
        createdAt: true,
        updatedAt: true,
        bankName: true,
      },
    });

    const loanPromise = this.prisma.loan.findMany({
      where: { borrowerId: userId },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        amountBorrowed: true,
        status: true,
        disbursementDate: true,
        createdAt: true,
        updatedAt: true,
        amountRepayable: true,
      },
    });

    const repaymentPromise = this.prisma.repayment.findMany({
      where: { userId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        loanId: true,
        repaidAmount: true,
      },
    });

    const [user, identity, paymentMethod, loans, repayments] =
      await Promise.all([
        userPromise,
        identityPromise,
        paymentMethodPromise,
        loanPromise,
        repaymentPromise,
      ]);

    const activities = [
      user && summarizeActivity('User', user),
      identity && summarizeActivity('UserIdentity', identity),
      paymentMethod && summarizeActivity('UserPaymentMethod', paymentMethod),
      ...loans.map((loan) => summarizeActivity('Loan', loan)),
      ...repayments.map((rep) => summarizeActivity('Repayment', rep)),
    ].filter(Boolean) as ActivitySummary[];

    return activities.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async getPayroll(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        payroll: {
          select: {
            netPay: true,
            grade: true,
            step: true,
            command: true,
            userId: true,
            employeeGross: true,
          },
        },
      },
    });
    if (!user?.payroll)
      return {
        message: 'User payroll data not found',
        data: null,
      };

    return {
      message: 'User payroll data found',
      data: user.payroll,
    };
  }

  async getPaymentMethod(userId: string) {
    const paymentMethod = await this.prisma.userPaymentMethod.findUnique({
      where: { userId },
      select: {
        bankName: true,
        accountNumber: true,
        accountName: true,
      },
    });

    if (!paymentMethod) {
      return null;
    }

    return paymentMethod;
  }

  async getIdentityInfo(userId: string) {
    const userIdentity = await this.prisma.userIdentity.findUnique({
      where: { userId },
      select: {
        documents: true,
        dateOfBirth: true,
        nextOfKinContact: true,
        nextOfKinName: true,
        nextOfKinAddress: true,
        nextOfKinRelationship: true,
        residencyAddress: true,
        stateResidency: true,
        gender: true,
        landmarkOrBusStop: true,
        maritalStatus: true,
      },
    });
    return userIdentity;
  }
}
