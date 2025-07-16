import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from '../common/dto';
import { PrismaService } from 'src/prisma/prisma.service';
import nameMatches from '../common/utils/name-verification';

@Injectable()
export class PaymentMethodService {
  constructor(private readonly prisma: PrismaService) {}

  async addPaymentMethod(userId: string, dto: CreatePaymentMethodDto) {
    const [existingPaymentMethod, /*userIdentity */] = await Promise.all([
      this.prisma.userPaymentMethod.findUnique({
        where: { userId },
        select: { userId: true },
      }),
      // this.prisma.userIdentity.findUnique({
      //   where: { userId },
      //   select: { verified: true, firstName: true, lastName: true },
      // }),
    ]);

    // if (!userIdentity) {
    //   throw new BadRequestException(
    //     'You must complete identity verification before adding a payment method.',
    //   );
    // }

    // if (!userIdentity.verified) {
    //   throw new BadRequestException(
    //     'Identity verification is pending. Please wait for review before adding a payment method.',
    //   );
    // }

    if (existingPaymentMethod) {
      throw new ConflictException(
        'A payment method already exists for this user.',
      );
    }

    // const name = `${userIdentity.firstName} ${userIdentity.lastName}`;
    // const isMatched = nameMatches(dto.accountName, name);

    // if (!isMatched) {
    //   throw new UnprocessableEntityException(
    //     'Provided account name does not sufficiently match the verified identity name.',
    //   );
    // }

    await this.prisma.userPaymentMethod.create({ data: { userId, ...dto } });

    return 'Payment method has been successfully created and added!';
  }

  async updatePaymentMethod(userId: string, dto: UpdatePaymentMethodDto) {
    const [existingPaymentMethod, /* userIdentity */] = await Promise.all([
      this.prisma.userPaymentMethod.findUnique({
        where: { userId },
        select: { userId: true },
      }),
      // this.prisma.userIdentity.findUnique({
      //   where: { userId },
      //   select: { verified: true, firstName: true, lastName: true },
      // }),
    ]);
  

    // if (!userIdentity) {
    //   throw new BadRequestException(
    //     'You must complete identity verification before updating your payment method.',
    //   );
    // }

    // if (!userIdentity.verified) {
    //   throw new BadRequestException(
    //     'Identity verification is still pending. You cannot update your payment method until it is verified.',
    //   );
    // }

    if (!existingPaymentMethod) {
      throw new NotFoundException(
        'No existing payment method found to update.',
      );
    }

    // if (dto.accountName) {
    //   const fullName = `${userIdentity.firstName} ${userIdentity.lastName}`;
    //   const nameIsValid = nameMatches(dto.accountName, fullName);
    //   if (!nameIsValid) {
    //     throw new UnprocessableEntityException(
    //       'Updated account name does not match verified identity.',
    //     );
    //   }
    // }

    await this.prisma.userPaymentMethod.update({
      where: { userId },
      data: { ...dto },
    });

    return 'Payment method has been successfully updated.';
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
}
