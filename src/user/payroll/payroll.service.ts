import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePayrollDto, UpdatePayrollDto } from '../common/dto';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async getPayroll(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        payroll: {
          select: {
            employer: true,
            netPay: true,
            grade: true,
            forceNumber: true,
            step: true,
            command: true,
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

  async createPayroll(dto: CreatePayrollDto) {
    const user = await this.prisma.user.findUnique({
      where: { externalId: dto.externalId },
      select: { externalId: true },
    });

    if (!user || !user.externalId) {
      throw new NotFoundException('User or IPPIS ID not found');
    }

    await this.prisma.userPayroll.create({
      data: {
        ...dto,
        userId: dto.externalId,
      },
      select: { userId: true },
    });

    return {
      message: 'User payroll data created',
      data: null,
    };
  }

  async updatePayroll(userId: string, dto: UpdatePayrollDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { externalId: true },
    });

    if (!user || !user.externalId) {
      throw new NotFoundException('User or IPPIS ID not found');
    }

    const payroll = await this.prisma.userPayroll.findUnique({
      where: { userId: user.externalId },
      select: { userId: true },
    });
    if (!payroll) {
      throw new NotFoundException('User payroll data not found');
    }

    await this.prisma.userPayroll.update({
      where: { userId: user.externalId },
      data: { ...dto },
      select: { userId: true },
    });

    return {
      message: 'User payroll data updated',
      data: null,
    };
  }
}
