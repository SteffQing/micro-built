import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RecentActivityDto,
  UpdatePasswordDto,
  UpdateUserDto,
} from './common/dto';
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
        name: true,
        email: true,
        contact: true,
        role: true,
        status: true,
        avatar: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return { ...user, id: userId };
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(updateUserDto.name && { name: updateUserDto.name }),
        ...(updateUserDto.contact && { contact: updateUserDto.contact }),
      },
      select: {
        name: true,
        email: true,
        contact: true,
        role: true,
        status: true,
      },
    });

    return { ...updatedUser, id: userId };
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
        repayable: true,
        status: true,
        extension: true,
        disbursementDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const repaymentPromise = this.prisma.repayment.findMany({
      where: { userId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        repaid: true,
        createdAt: true,
        loanId: true,
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
}
