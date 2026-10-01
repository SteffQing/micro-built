import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import type { Tx } from 'src/ledger/ledger.tx';
import type { CreateIdentityDto, UpdateIdentityDto } from './common/dto/identity.dto';
import type { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './common/dto/payment-method.dto';
import type { CreatePayrollDto, UpdatePayrollDto } from './common/dto/payroll.dto';
import nameMatches from './common/utils/name-verification';

// A customer's personal details (identity, payroll, payment method). Every write also puts the
// account back under review: status FLAGGED with the reason v1's listeners recorded, in the
// same transaction as the write.

export const FLAG_REASONS = {
  identityCreated:
    'User uploaded identity documents. Needs review by admin to confirm correctness of information',
  identityUpdated:
    'User updated identity documents. Needs review by admin to confirm correctness of information',
  paymentMethodCreated:
    'User added payment method. Needs review by admin to confirm correctness of information',
  paymentMethodUpdated:
    'User updated payment method. Needs review by admin to confirm correctness of information',
  payrollCreated:
    'User added payroll information. Needs review by admin to confirm correctness of information',
  payrollUpdated:
    'User updated payroll information. Needs review by admin to confirm correctness of information',
} as const;

export const NOT_A_CUSTOMER = 'Only customer accounts can add these details';
export const IPPIS_TAKEN = 'This IPPIS number is already registered to another customer';
export const ACCOUNT_NUMBER_TAKEN = 'This account number is already linked to another customer';
export const BVN_TAKEN = 'This BVN is already linked to another customer';
const NAME_MISMATCH = 'Provided account name does not sufficiently match the account name.';

/** Field (or constraint) name → the 409 message for a unique violation on it. */
type UniqueMessages = Record<string, string>;
const PAYMENT_UNIQUE: UniqueMessages = { accountNumber: ACCOUNT_NUMBER_TAKEN, bvn: BVN_TAKEN };

@Injectable()
export class PPIService {
  constructor(private readonly prisma: PrismaService) {}

  async submitVerification(userId: string, dto: CreateIdentityDto) {
    const exists = 'You have already submitted your identity verification.';
    await this.write({ userId: exists }, async (tx) => {
      const customer = await this.customer(tx, userId);
      const identity = await tx.customerIdentity.findUnique({ where: { userId }, select: { userId: true } });
      if (identity) throw new BadRequestException(exists);

      await tx.customerIdentity.create({
        data: { ...dto, userId: customer.userId, dateOfBirth: new Date(dto.dateOfBirth) },
      });
      await this.flag(tx, userId, FLAG_REASONS.identityCreated);
    });
    return 'Your identity documents have been successfully created! Please wait as we manually review this information';
  }

  async updateVerification(userId: string, dto: UpdateIdentityDto) {
    await this.write({}, async (tx) => {
      await this.customer(tx, userId);
      const identity = await tx.customerIdentity.findUnique({ where: { userId }, select: { userId: true } });
      if (!identity) {
        throw new NotFoundException('Identity record not found. Please submit your verification first.');
      }

      const { dateOfBirth, ...rest } = dto;
      await tx.customerIdentity.update({
        where: { userId },
        data: { ...rest, ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }) },
      });
      await this.flag(tx, userId, FLAG_REASONS.identityUpdated);
    });
    return 'Your identity documents have been successfully updated! Please wait as we manually review this new information';
  }

  async addPaymentMethod(userId: string, dto: CreatePaymentMethodDto) {
    const exists = 'A payment method already exists for this user.';
    await this.write({ userId: exists, ...PAYMENT_UNIQUE }, async (tx) => {
      const { name } = await this.customer(tx, userId);
      const current = await tx.customerPaymentMethod.findUnique({ where: { userId }, select: { userId: true } });
      if (current) throw new ConflictException(exists);
      if (!nameMatches(dto.accountName, name)) throw new UnprocessableEntityException(NAME_MISMATCH);
      await this.assertPaymentDetailsFree(tx, userId, dto);

      await tx.customerPaymentMethod.create({ data: { ...dto, userId } });
      await this.flag(tx, userId, FLAG_REASONS.paymentMethodCreated);
    });
    return 'Payment method has been successfully created and added!';
  }

  async updatePaymentMethod(userId: string, dto: UpdatePaymentMethodDto) {
    await this.write(PAYMENT_UNIQUE, async (tx) => {
      const { name } = await this.customer(tx, userId);
      const current = await tx.customerPaymentMethod.findUnique({ where: { userId }, select: { userId: true } });
      if (!current) throw new NotFoundException('No existing payment method found to update.');
      if (dto.accountName && !nameMatches(dto.accountName, name)) {
        throw new UnprocessableEntityException(NAME_MISMATCH);
      }
      await this.assertPaymentDetailsFree(tx, userId, dto);

      await tx.customerPaymentMethod.update({ where: { userId }, data: { ...dto } });
      await this.flag(tx, userId, FLAG_REASONS.paymentMethodUpdated);
    });
    return 'Payment method has been successfully updated.';
  }

  /** Creating payroll details sets Customer.externalId (the IPPIS number payroll rows match on). */
  async createPayroll(userId: string, dto: CreatePayrollDto) {
    const exists = 'Payroll info already exists. Update instead';
    const { externalId, ...payroll } = dto;
    await this.write({ externalId: IPPIS_TAKEN }, async (tx) => {
      const customer = await this.customer(tx, userId);
      if (customer.payroll) throw new ConflictException(exists);
      if (customer.externalId && customer.externalId !== externalId) {
        throw new ConflictException(
          `Your IPPIS number is already on file as ${customer.externalId}. Contact support to change it.`,
        );
      }
      const taken = await tx.customer.findFirst({
        where: { externalId, userId: { not: userId } },
        select: { userId: true },
      });
      if (taken) throw new ConflictException(IPPIS_TAKEN);

      // externalId first: CustomerPayroll's key references it.
      await this.flag(tx, userId, FLAG_REASONS.payrollCreated, { externalId });
      await tx.customerPayroll.create({ data: { ...payroll, externalId } });
    });
    return 'User payroll data created';
  }

  async updatePayroll(userId: string, dto: UpdatePayrollDto) {
    await this.write({}, async (tx) => {
      const customer = await this.customer(tx, userId);
      if (!customer.payroll) throw new NotFoundException('Payroll information not found');

      await tx.customerPayroll.update({ where: { externalId: customer.payroll.externalId }, data: { ...dto } });
      await this.flag(tx, userId, FLAG_REASONS.payrollUpdated);
    });
    return 'User payroll data updated';
  }

  /** Runs the write in one transaction; a unique violation (two requests racing) becomes a 409. */
  private async write(unique: UniqueMessages, work: (tx: Tx) => Promise<void>): Promise<void> {
    try {
      await this.prisma.$transaction(work);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = JSON.stringify(error.meta?.target ?? '');
        const field = Object.keys(unique).find((key) => target.includes(key));
        throw new ConflictException(field ? unique[field] : 'These details are already in use');
      }
      throw error;
    }
  }

  /** The caller's Customer row (403 for admins, who have none). */
  private async customer(tx: Tx, userId: string) {
    const customer = await tx.customer.findUnique({
      where: { userId },
      select: {
        userId: true,
        externalId: true,
        user: { select: { name: true } },
        payroll: { select: { externalId: true } },
      },
    });
    if (!customer) throw new ForbiddenException(NOT_A_CUSTOMER);
    return { ...customer, name: customer.user.name };
  }

  private async assertPaymentDetailsFree(tx: Tx, userId: string, dto: UpdatePaymentMethodDto) {
    const or: Prisma.CustomerPaymentMethodWhereInput[] = [];
    if (dto.accountNumber) or.push({ accountNumber: dto.accountNumber });
    if (dto.bvn) or.push({ bvn: dto.bvn });
    if (or.length === 0) return;

    const taken = await tx.customerPaymentMethod.findFirst({
      where: { userId: { not: userId }, OR: or },
      select: { accountNumber: true, bvn: true },
    });
    if (!taken) return;
    if (dto.accountNumber && taken.accountNumber === dto.accountNumber) {
      throw new ConflictException(ACCOUNT_NUMBER_TAKEN);
    }
    throw new ConflictException(BVN_TAKEN);
  }

  /** Back under review: User.status FLAGGED and Customer.flagReason (plus any other Customer change). */
  private async flag(tx: Tx, userId: string, flagReason: string, customer: Prisma.CustomerUpdateInput = {}) {
    await tx.user.update({ where: { id: userId }, data: { status: 'FLAGGED' } });
    await tx.customer.update({ where: { userId }, data: { ...customer, flagReason } });
  }
}
