import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePasswordDto } from './common/dto';
import * as bcrypt from 'bcrypt';
import { summarizeActivity } from './common/utils/activity';
import { ActivitySummary } from './common/interface';
import { SupabaseService } from 'src/supabase/supabase.service';

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
        identity: {
          select: {
            firstName: true,
            lastName: true,
            contact: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    const { identity, ..._user } = user;
    const name = identity
      ? `${identity.firstName} ${identity.lastName}`
      : user.name;

    return { ..._user, id: userId, name, contact: identity?.contact || null };
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
      throw new UnauthorizedException(
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
        verified: true,
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
        amount: true,
        status: true,
        extension: true,
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
}
