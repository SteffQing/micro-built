import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  CreateIdentityDto,
  CreatePaymentMethodDto,
  CreatePayrollDto,
  UpdateIdentityDto,
  UpdatePaymentMethodDto,
  UpdatePayrollDto,
} from './common/dto';
import nameMatches from './common/utils/name-verification';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CustomerPPIEvents } from 'src/queue/events/events';

@Injectable()
export class PPIService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly event: EventEmitter2,
  ) {}

  async submitVerification(userId: string, dto: CreateIdentityDto) {
    const existing = await this.prisma.userIdentity.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new BadRequestException(
        'You have already submitted your identity verification.',
      );
    }

    this.event.emit(CustomerPPIEvents.userCreateIdentity, { dto, userId });

    return 'Your identity documents have been successfully created! Please wait as we manually review this information';
  }

  async updateVerification(userId: string, dto: UpdateIdentityDto) {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { userId },
    });

    if (!identity) {
      throw new NotFoundException(
        'Identity record not found. Please submit your verification first.',
      );
    }

    this.event.emit(CustomerPPIEvents.userUpdateIdentity, { dto, userId });
    return 'Your identity documents have been successfully updated! Please wait as we manually review this new information';
  }

  async addPaymentMethod(userId: string, dto: CreatePaymentMethodDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { paymentMethod: { select: { userId: true } }, name: true },
    });

    if (user.paymentMethod?.userId) {
      throw new ConflictException(
        'A payment method already exists for this user.',
      );
    }

    const isMatched = nameMatches(dto.accountName, user.name);

    if (!isMatched) {
      throw new UnprocessableEntityException(
        'Provided account name does not sufficiently match the account name.',
      );
    }

    this.event.emit(CustomerPPIEvents.userCreatePayment, { dto, userId });
    return 'Payment method has been successfully created and added!';
  }

  async updatePaymentMethod(userId: string, dto: UpdatePaymentMethodDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { paymentMethod: { select: { userId: true } }, name: true },
    });

    if (dto.accountName) {
      const isMatched = nameMatches(dto.accountName, user.name);

      if (!isMatched) {
        throw new UnprocessableEntityException(
          'Provided account name does not sufficiently match the account name.',
        );
      }
    }

    if (!user.paymentMethod?.userId) {
      throw new NotFoundException(
        'No existing payment method found to update.',
      );
    }

    this.event.emit(CustomerPPIEvents.userUpdatePayment, { dto, userId });

    return 'Payment method has been successfully updated.';
  }

  async createPayroll(userId: string, dto: CreatePayrollDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { externalId: true },
    });

    if (user?.externalId) {
      throw new ConflictException(
        'Payroll info already exists. Update instead',
      );
    }

    this.event.emit(CustomerPPIEvents.userCreatePayroll, { dto, userId });

    return 'User payroll data created';
  }

  async updatePayroll(userId: string, dto: UpdatePayrollDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { externalId: true },
    });

    if (!user || !user.externalId) {
      throw new NotFoundException('Payroll information not found');
    }

    this.event.emit(CustomerPPIEvents.userUpdatePayroll, {
      dto,
      userId,
      externalId: user.externalId,
    });

    return 'User payroll data updated';
  }
}
