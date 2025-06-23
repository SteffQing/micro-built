import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from '../common/dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PaymentMethodService {
  constructor(private readonly prisma: PrismaService) {}
  async addPaymentMethod(userId: string, dto: CreatePaymentMethodDto) {
    const existingPaymentMethod =
      await this.prisma.userPaymentMethod.findUnique({
        where: { userId },
      });

    if (existingPaymentMethod) {
      throw new BadRequestException(
        'Payment method already exists for this user',
      );
    }
    // need to validate the account number
    await this.prisma.userPaymentMethod.create({
      data: {
        userId,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
      },
      select: {
        bankName: true,
        accountNumber: true,
        accountName: true,
      },
    });
    return 'Payment method has been successfully created and added!';
  }

  async updatePaymentMethod(userId: string, dto: UpdatePaymentMethodDto) {
    const existingPaymentMethod =
      await this.prisma.userPaymentMethod.findUnique({
        where: { userId },
      });

    if (!existingPaymentMethod) {
      throw new NotFoundException('Payment method not found for this user');
    }
    await this.prisma.userPaymentMethod.update({
      where: { userId },
      data: { ...dto },
      select: {
        bankName: true,
        accountNumber: true,
        accountName: true,
      },
    });

    return 'Payment method has been successfully updated';
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
      throw new NotFoundException('Payment method not found for this user');
    }

    return paymentMethod;
  }
}
