import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ChangeRequestKind } from '@prisma/client';
import { missingToCreate, ChangeRequestsService } from 'src/change-requests/change-requests.service';
import type { ChangeRequestDto } from 'src/change-requests/change-requests.dto';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerTx } from 'src/ledger/ledger.tx';
import type { UpdateIdentityDto } from 'src/user/common/dto/identity.dto';
import type { UpdatePaymentMethodDto } from 'src/user/common/dto/payment-method.dto';
import type { OnboardPayrollDto } from '../common/dto/customer.dto';
import { CUSTOMER_NOT_FOUND } from './customer.service';

type Fields = Record<string, unknown>;

const LABEL: Partial<Record<ChangeRequestKind, string>> = {
  IDENTITY: 'identity details',
  PAYMENT_METHOD: 'bank details',
  PAYROLL: 'payroll details',
};

const FIELD_NAMES: Record<string, string> = {
  dateOfBirth: 'date of birth',
  maritalStatus: 'marital status',
  residencyAddress: 'address',
  stateResidency: 'state of residence',
  landmarkOrBusStop: 'landmark or bus stop',
  nextOfKinName: 'next of kin',
  nextOfKinContact: 'next of kin phone',
  nextOfKinAddress: 'next of kin address',
  nextOfKinRelationship: 'next of kin relationship',
  bankName: 'bank',
  accountNumber: 'account number',
  accountName: 'account name',
  bvn: 'BVN',
  externalId: 'IPPIS number',
};

export interface Proposed {
  data: ChangeRequestDto | null;
  message: string;
}

/**
 * An admin's changes to a customer's identity, bank or payroll details. Nothing is written: each becomes a change
 * request (proposed by the admin) that only a super admin can approve. With no record on
 * file the proposal must give every field, since approving creates it.
 */
@Injectable()
export class CustomerDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly changeRequests: ChangeRequestsService,
  ) {}

  async proposeIdentity(customerId: string, dto: UpdateIdentityDto, actorId: string): Promise<Proposed> {
    await this.customerName(customerId);
    const identity = await this.prisma.customerIdentity.findUnique({ where: { userId: customerId } });
    const current: Fields = identity
      ? {
          dateOfBirth: identity.dateOfBirth.toISOString().slice(0, 10),
          gender: identity.gender,
          maritalStatus: identity.maritalStatus,
          residencyAddress: identity.residencyAddress,
          stateResidency: identity.stateResidency,
          landmarkOrBusStop: identity.landmarkOrBusStop,
          nextOfKinName: identity.nextOfKinName,
          nextOfKinContact: identity.nextOfKinContact,
          nextOfKinAddress: identity.nextOfKinAddress,
          nextOfKinRelationship: identity.nextOfKinRelationship,
        }
      : {};
    return this.propose(customerId, 'IDENTITY', { ...dto }, current, !identity, actorId);
  }

  async proposePaymentMethod(customerId: string, dto: UpdatePaymentMethodDto, actorId: string): Promise<Proposed> {
    await this.customerName(customerId);
    const current = await this.prisma.customerPaymentMethod.findUnique({
      where: { userId: customerId },
      select: { bankName: true, accountNumber: true, accountName: true, bvn: true },
    });
    const or = [
      ...(dto.accountNumber ? [{ accountNumber: dto.accountNumber }] : []),
      ...(dto.bvn ? [{ bvn: dto.bvn }] : []),
    ];
    if (or.length) {
      const taken = await this.prisma.customerPaymentMethod.findFirst({
        where: { userId: { not: customerId }, OR: or },
        select: { accountNumber: true },
      });
      if (taken) {
        throw new ConflictException(
          taken.accountNumber === dto.accountNumber
            ? 'This account number belongs to another customer'
            : 'This BVN belongs to another customer',
        );
      }
    }
    return this.propose(customerId, 'PAYMENT_METHOD', { ...dto }, { ...(current ?? {}) }, !current, actorId);
  }

  /** Only while the customer has no payroll: afterwards it changes through payroll uploads. */
  async proposePayroll(customerId: string, dto: OnboardPayrollDto, actorId: string): Promise<Proposed> {
    const customer = await this.prisma.customer.findUnique({ where: { userId: customerId }, select: { externalId: true } });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);
    if (customer.externalId) throw new ConflictException('Payroll data is already on file; it changes only through payroll');
    const taken = await this.prisma.customer.findFirst({ where: { externalId: dto.externalId }, select: { userId: true } });
    if (taken) throw new ConflictException(`IPPIS ${dto.externalId} belongs to another customer`);
    return this.propose(customerId, 'PAYROLL', { ...dto }, {}, true, actorId);
  }

  private async propose(
    customerId: string,
    kind: ChangeRequestKind,
    proposed: Fields,
    current: Fields,
    creating: boolean,
    actorId: string,
  ): Promise<Proposed> {
    if (creating) {
      const missing = missingToCreate(kind, proposed);
      if (missing.length) {
        throw new BadRequestException(
          `The customer has no ${LABEL[kind]} yet, so give all of them. Missing: ${missing.map((k) => FIELD_NAMES[k] ?? k).join(', ')}`,
        );
      }
    }
    const name = await this.customerName(customerId);
    const request = await this.ledgerTx.transaction(async (tx) => {
      const created = await this.changeRequests.submit(tx, customerId, kind, proposed, current, actorId);
      if (created) {
        await this.ledgerTx.audit(tx, {
          actorId,
          action: 'CHANGE_REQUEST_PROPOSED',
          entityType: 'CHANGE_REQUEST',
          entityId: created.id,
          note: `${LABEL[kind]} of ${name} (${customerId})`,
        });
      }
      return created;
    });
    if (!request) return { data: null, message: `Nothing to change: these are already ${name}'s ${LABEL[kind]}` };
    return {
      data: await this.changeRequests.get(request.id, null),
      message: `The change to ${name}'s ${LABEL[kind]} is waiting for a super admin's approval`,
    };
  }

  private async customerName(customerId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
      select: { user: { select: { name: true } } },
    });
    if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);
    return customer.user.name;
  }
}
