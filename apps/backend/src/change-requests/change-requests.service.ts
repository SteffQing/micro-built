import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isPlaceholderEmail, placeholderEmail } from '@microbuilt/shared';
import { Prisma, type AdminRole, type ChangeRequest, type ChangeRequestKind } from '@prisma/client';
import { captureJobError } from 'src/common/observability';
import type { AccessRole } from 'src/common/types';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerTx, type Tx } from 'src/ledger/ledger.tx';
import { ADMIN_LINKS, AdminNotifierService, NOTIFICATION_SUBJECT } from 'src/notifications/admin-notifier.service';
import { InappService } from 'src/notifications/inapp.service';
import type { ChangeRequestDto, ChangeRequestsQueryDto, OwnChangeRequestsQueryDto } from './change-requests.dto';

export const ALREADY_DECIDED = 'Already decided by another admin';
export const NOT_FOUND = 'Change request not found';
export const NO_CHANGES = 'Nothing to change: these are already your details';
const CANT_DECIDE_OWN = 'You can’t decide a change to your own details';
const SUPER_ADMIN_ONLY = 'Only a super admin can decide a change to an admin’s details';
export const PROPOSED_SUPER_ADMIN_ONLY = 'Only a super admin can decide a change an admin proposed';
export const OTHER_ORIGIN_PENDING =
  'A change to these details is already waiting for review. It has to be decided or withdrawn first.';

/** Values in `proposed`/`previous`. */
type Fields = Record<string, unknown>;

/** The profile fields better-auth writes that wait for approval (a photo changes at once). */
export interface ProfileFields {
  name?: string;
  email?: string;
  phoneNumber?: string;
}

const KIND_LABEL: Record<ChangeRequestKind, string> = {
  IDENTITY: 'identity details',
  PAYMENT_METHOD: 'payment method',
  PROFILE: 'profile',
  PAYROLL: 'payroll details',
};

/** What a customer must give when there is no record yet: approving creates it from `proposed` alone. */
const REQUIRED_TO_CREATE: Partial<Record<ChangeRequestKind, string[]>> = {
  IDENTITY: [
    'dateOfBirth',
    'gender',
    'maritalStatus',
    'residencyAddress',
    'stateResidency',
    'landmarkOrBusStop',
    'nextOfKinName',
    'nextOfKinContact',
    'nextOfKinAddress',
    'nextOfKinRelationship',
  ],
  PAYMENT_METHOD: ['bankName', 'accountNumber', 'accountName', 'bvn'],
  PAYROLL: ['externalId', 'organization', 'command'],
};

/** Names a missing-fields 400 uses. */
export function missingToCreate(kind: ChangeRequestKind, fields: Fields): string[] {
  return (REQUIRED_TO_CREATE[kind] ?? []).filter((key) => fields[key] === undefined || fields[key] === null || fields[key] === '');
}

const REQUEST_INCLUDE = {
  user: { select: { id: true, name: true, type: true, admin: { select: { role: true } } } },
  decidedBy: { select: { userId: true, user: { select: { name: true } } } },
  requestedBy: { select: { userId: true, user: { select: { name: true } } } },
} satisfies Prisma.ChangeRequestInclude;
type RequestRow = Prisma.ChangeRequestGetPayload<{ include: typeof REQUEST_INCLUDE }>;

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Changes to someone's details that wait for an admin (ChangeRequest): a customer's identity or
// payment method, and anyone's name, email or phone except a super admin's (photos change at once). The live record keeps its values
// until a request is approved; approving writes `proposed` to it in one transaction, re-checking
// what may have changed since (an account number or email taken by someone else meanwhile).
@Injectable()
export class ChangeRequestsService {
  private readonly logger = new Logger(ChangeRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly inapp: InappService,
    private readonly adminNotifier: AdminNotifierService,
  ) {}

  /**
   * Records a change for review. `proposed` fields equal to `current` are dropped; a pending
   * request of the same kind takes the rest on top of its own. Returns null when nothing is left
   * to change (a pending request whose fields all went back to the live values is cancelled).
   */
  async submit(
    db: Tx,
    userId: string,
    kind: ChangeRequestKind,
    proposed: Fields,
    current: Fields,
    requestedById: string | null = null,
  ): Promise<ChangeRequest | null> {
    const pending = await db.changeRequest.findFirst({ where: { userId, kind, status: 'PENDING' } });
    // A customer's own request and an admin's proposal never fold into each other: they're decided differently.
    if (pending && (pending.requestedById ?? null) !== requestedById) throw new ConflictException(OTHER_ORIGIN_PENDING);
    const before = (pending?.proposed ?? {}) as Fields;
    const previous = { ...((pending?.previous ?? {}) as Fields) };
    const merged: Fields = { ...before };
    for (const [key, value] of Object.entries(proposed)) {
      if (value === undefined) continue;
      if (!(key in previous)) previous[key] = current[key] ?? null;
      if (same(value, previous[key])) delete merged[key];
      else merged[key] = value;
    }
    for (const key of Object.keys(previous)) if (!(key in merged)) delete previous[key];

    let request: ChangeRequest | null;
    if (pending && Object.keys(merged).length === 0) {
      await db.changeRequest.update({ where: { id: pending.id }, data: { status: 'CANCELLED' } });
      request = null;
    } else if (pending) {
      request = await db.changeRequest.update({
        where: { id: pending.id },
        data: { proposed: merged as Prisma.InputJsonObject, previous: previous as Prisma.InputJsonObject },
      });
    } else if (Object.keys(merged).length === 0) {
      request = null;
    } else {
      try {
        request = await db.changeRequest.create({
          data: {
            userId,
            kind,
            proposed: merged as Prisma.InputJsonObject,
            previous: previous as Prisma.InputJsonObject,
            requestedById,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('A change to these details is already waiting for review. Try again.');
        }
        throw error;
      }
    }
    if (request && !pending) this.notifyAdmins(userId, kind, request.id, requestedById);
    return request;
  }

  /**
   * better-auth is about to write `fields` to the signed-in user's own row. Null when it may go
   * ahead (a super admin); otherwise the change is put up for review and the result is what to
   * write instead: the current values, so the row is left as it is.
   */
  async holdProfileChange(userId: string, fields: ProfileFields): Promise<Record<string, unknown> | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        emailVerified: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        admin: { select: { role: true } },
      },
    });
    if (!user || user.admin?.role === 'SUPER_ADMIN') return null;

    const proposed: Fields = {};
    const keep: Record<string, unknown> = {};
    if (fields.name !== undefined) {
      proposed.name = fields.name;
      keep.name = user.name;
    }
    if (fields.email !== undefined) {
      proposed.email = fields.email.toLowerCase();
      keep.email = user.email;
      keep.emailVerified = user.emailVerified;
    }
    if (fields.phoneNumber !== undefined) {
      proposed.phoneNumber = fields.phoneNumber;
      keep.phoneNumber = user.phoneNumber;
      keep.phoneNumberVerified = user.phoneNumberVerified;
    }

    await this.prisma.$transaction((tx) =>
      this.submit(tx, userId, 'PROFILE', proposed, {
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
      }),
    );
    return keep;
  }

  async listOwn(userId: string, query: OwnChangeRequestsQueryDto) {
    return this.page({ userId, status: query.status }, query, null);
  }

  /** Admins see customers' requests; super admins also see other admins'. */
  async list(query: ChangeRequestsQueryDto, viewer: { userId: string; role: AccessRole }) {
    const where: Prisma.ChangeRequestWhereInput = { status: query.status, kind: query.kind, userId: query.userId };
    if (viewer.role !== 'SUPER_ADMIN') where.user = { type: 'CUSTOMER' };
    return this.page(where, query, viewer);
  }

  async cancel(id: string, userId: string): Promise<ChangeRequestDto> {
    const request = await this.prisma.changeRequest.findFirst({ where: { id, userId } });
    if (!request) throw new NotFoundException(NOT_FOUND);
    const { count } = await this.prisma.changeRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    if (count === 0) throw new ConflictException('This request has already been decided');
    this.clearPrompt(id);
    if (request.requestedById) this.tellProposer(request.requestedById, request.userId, request.kind);
    return this.get(id, null);
  }

  async approve(id: string, decider: { userId: string; role: AccessRole }): Promise<ChangeRequestDto> {
    const request = await this.decidable(id, decider);
    const proposed = request.proposed as Fields;

    await this.ledgerTx.transaction(async (tx) => {
      await this.decide(tx, request.id, decider.userId, 'APPROVED');
      if (request.kind === 'IDENTITY') await this.applyIdentity(tx, request.userId, proposed);
      if (request.kind === 'PAYMENT_METHOD') await this.applyPaymentMethod(tx, request.userId, proposed);
      if (request.kind === 'PROFILE') await this.applyProfile(tx, request.userId, proposed);
      if (request.kind === 'PAYROLL') await this.applyPayroll(tx, request.userId, proposed);
      await this.ledgerTx.audit(tx, {
        actorId: decider.userId,
        action: 'CHANGE_REQUEST_APPROVED',
        entityType: 'CHANGE_REQUEST',
        entityId: request.id,
        note: `${KIND_LABEL[request.kind]} of ${request.user.name} (${request.userId})`,
      });
    });
    await this.tellUser(request, 'approved');
    this.clearPrompt(id);
    return this.get(id, decider);
  }

  async reject(id: string, decider: { userId: string; role: AccessRole }, note?: string): Promise<ChangeRequestDto> {
    const request = await this.decidable(id, decider);
    await this.ledgerTx.transaction(async (tx) => {
      await this.decide(tx, request.id, decider.userId, 'REJECTED', note);
      await this.ledgerTx.audit(tx, {
        actorId: decider.userId,
        action: 'CHANGE_REQUEST_REJECTED',
        entityType: 'CHANGE_REQUEST',
        entityId: request.id,
        note: note ?? `${KIND_LABEL[request.kind]} of ${request.user.name} (${request.userId})`,
      });
    });
    await this.tellUser(request, 'rejected', note);
    this.clearPrompt(id);
    return this.get(id, decider);
  }

  // ─── Deciding ───────────────────────────────────────────────────────────

  private async decidable(id: string, decider: { userId: string; role: AccessRole }) {
    const request = await this.prisma.changeRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
    if (!request) throw new NotFoundException(NOT_FOUND);
    if (request.status !== 'PENDING') throw new ConflictException(ALREADY_DECIDED);
    const reason = this.cannotDecide(request, decider);
    if (reason) throw new ForbiddenException(reason);
    return request;
  }

  private cannotDecide(request: RequestRow, decider: { userId: string; role: AccessRole }): string | null {
    if (decider.role !== 'ADMIN' && decider.role !== 'SUPER_ADMIN') return 'You can’t decide change requests';
    if (request.userId === decider.userId) return CANT_DECIDE_OWN;
    if (request.requestedById && decider.role !== 'SUPER_ADMIN') return PROPOSED_SUPER_ADMIN_ONLY;
    if (request.user.type === 'ADMIN' && decider.role !== 'SUPER_ADMIN') return SUPER_ADMIN_ONLY;
    return null;
  }

  /** Compare-and-swap on the status: the second of two admins deciding at once gets a 409. */
  private async decide(tx: Tx, id: string, deciderId: string, status: 'APPROVED' | 'REJECTED', note?: string) {
    const { count } = await tx.changeRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, decidedById: deciderId, decidedAt: new Date(), note: note ?? null },
    });
    if (count === 0) throw new ConflictException(ALREADY_DECIDED);
  }

  private async applyIdentity(tx: Tx, userId: string, proposed: Fields) {
    const identity = await tx.customerIdentity.findUnique({ where: { userId }, select: { userId: true } });
    const { dateOfBirth, ...rest } = proposed;
    if (!identity) {
      if (missingToCreate('IDENTITY', proposed).length) {
        throw new ConflictException('This customer has no identity details yet, and this change doesn’t give all of them');
      }
      await tx.customerIdentity.create({
        data: { ...(rest as Omit<Prisma.CustomerIdentityUncheckedCreateInput, 'userId' | 'dateOfBirth'>), userId, dateOfBirth: new Date(dateOfBirth as string) },
      });
      return;
    }
    await tx.customerIdentity.update({
      where: { userId },
      data: {
        ...(rest as Prisma.CustomerIdentityUpdateInput),
        ...(typeof dateOfBirth === 'string' && { dateOfBirth: new Date(dateOfBirth) }),
      },
    });
  }

  private async applyPaymentMethod(tx: Tx, userId: string, proposed: Fields) {
    const current = await tx.customerPaymentMethod.findUnique({ where: { userId }, select: { userId: true } });
    if (!current && missingToCreate('PAYMENT_METHOD', proposed).length) {
      throw new ConflictException('This customer has no bank account yet, and this change doesn’t give all of it');
    }
    const or: Prisma.CustomerPaymentMethodWhereInput[] = [];
    if (typeof proposed.accountNumber === 'string') or.push({ accountNumber: proposed.accountNumber });
    if (typeof proposed.bvn === 'string') or.push({ bvn: proposed.bvn });
    if (or.length > 0) {
      const taken = await tx.customerPaymentMethod.findFirst({
        where: { userId: { not: userId }, OR: or },
        select: { accountNumber: true },
      });
      if (taken) {
        throw new ConflictException(
          taken.accountNumber === proposed.accountNumber
            ? 'This account number has since been linked to another customer'
            : 'This BVN has since been linked to another customer',
        );
      }
    }
    if (!current) {
      await tx.customerPaymentMethod.create({
        data: { ...(proposed as Omit<Prisma.CustomerPaymentMethodUncheckedCreateInput, 'userId'>), userId },
      });
      return;
    }
    await tx.customerPaymentMethod.update({ where: { userId }, data: proposed as Prisma.CustomerPaymentMethodUpdateInput });
  }

  /** A first payroll record: links the IPPIS number to the customer. Afterwards payroll changes only via uploads. */
  private async applyPayroll(tx: Tx, userId: string, proposed: Fields) {
    const customer = await tx.customer.findUnique({ where: { userId }, select: { externalId: true } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.externalId) throw new ConflictException('Payroll data is already on file; it changes only through payroll');
    const { externalId, ...payroll } = proposed as { externalId: string } & Fields;
    const taken = await tx.customer.findFirst({ where: { externalId }, select: { userId: true } });
    if (taken) throw new ConflictException(`IPPIS ${externalId} has since been linked to another customer`);
    await tx.customer.update({ where: { userId }, data: { externalId } });
    await tx.customerPayroll.create({
      data: { externalId, ...(payroll as Omit<Prisma.CustomerPayrollUncheckedCreateInput, 'externalId'>) },
    });
  }

  private async applyProfile(tx: Tx, userId: string, proposed: Fields) {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new NotFoundException('User not found');
    const data: Prisma.UserUpdateInput = {};
    if (typeof proposed.name === 'string') data.name = proposed.name;
    if (typeof proposed.email === 'string') {
      const taken = await tx.user.findFirst({
        where: { id: { not: userId }, email: { equals: proposed.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (taken) throw new ConflictException('This email has since been taken by another account');
      // Proven with a code sent to it before the request was made.
      data.email = proposed.email;
      data.emailVerified = true;
    }
    if (typeof proposed.phoneNumber === 'string') {
      const taken = await tx.user.findFirst({
        where: { id: { not: userId }, phoneNumber: proposed.phoneNumber },
        select: { id: true },
      });
      if (taken) throw new ConflictException('This phone number has since been taken by another account');
      data.phoneNumber = proposed.phoneNumber;
      data.phoneNumberVerified = true;
      // A phone-only account follows its number, so the old one is free for someone else.
      if (data.email === undefined && isPlaceholderEmail(user.email)) {
        data.email = placeholderEmail(proposed.phoneNumber);
      }
    }
    await tx.user.update({ where: { id: userId }, data });
  }

  // ─── Reading ────────────────────────────────────────────────────────────

  private async page(
    where: Prisma.ChangeRequestWhereInput,
    query: { page?: number; limit?: number },
    viewer: { userId: string; role: AccessRole } | null,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [rows, total] = await Promise.all([
      this.prisma.changeRequest.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: REQUEST_INCLUDE,
      }),
      this.prisma.changeRequest.count({ where }),
    ]);
    const items = rows.map((row) => this.present(row, viewer));
    return { items, meta: { total, page, limit } };
  }

  async get(id: string, viewer: { userId: string; role: AccessRole } | null): Promise<ChangeRequestDto> {
    const row = await this.prisma.changeRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return this.present(row, viewer);
  }

  present(row: RequestRow, viewer: { userId: string; role: AccessRole } | null): ChangeRequestDto {
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      user: { id: row.user.id, name: row.user.name, role: row.user.admin?.role ?? 'CUSTOMER' },
      proposed: hideBvn(row.proposed as Fields, viewer),
      previous: hideBvn(row.previous as Fields, viewer),
      decidedBy: row.decidedBy ? { id: row.decidedBy.userId, name: row.decidedBy.user.name } : null,
      requestedBy: row.requestedBy ? { id: row.requestedBy.userId, name: row.requestedBy.user.name } : null,
      decidedAt: row.decidedAt,
      note: row.note,
      canDecide: viewer !== null && row.status === 'PENDING' && this.cannotDecide(row, viewer) === null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ─── Side effects ───────────────────────────────────────────────────────

  /** Decided or withdrawn: the admins' "waiting for approval" prompt is done. */
  private clearPrompt(requestId: string) {
    void this.adminNotifier
      .clear(NOTIFICATION_SUBJECT.changeRequest(requestId))
      .catch((error) => this.reportBackground(error, 'change-request.clear-prompt'));
  }

  /**
   * A new request: the admins who can decide it are prompted. An admin's proposal goes to super admins only, and the
   * customer is told a change to their details is waiting.
   */
  private notifyAdmins(userId: string, kind: ChangeRequestKind, requestId: string, requestedById: string | null) {
    void (async () => {
      const [user, proposer] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, type: true } }),
        requestedById ? this.prisma.user.findUnique({ where: { id: requestedById }, select: { name: true } }) : null,
      ]);
      if (!user) return;
      const roles: AdminRole[] = user.type === 'ADMIN' || requestedById ? ['SUPER_ADMIN'] : ['ADMIN', 'SUPER_ADMIN'];
      await this.adminNotifier.notifyAdmins(roles, {
        title: 'Change waiting for approval',
        message: proposer
          ? `${proposer.name} proposed a change to ${user.name}'s ${KIND_LABEL[kind]}.`
          : `${user.name} asked to change their ${KIND_LABEL[kind]}.`,
        ctaUrl: ADMIN_LINKS.changeRequest(requestId),
        subject: NOTIFICATION_SUBJECT.changeRequest(requestId),
      });
      if (requestedById) {
        await this.inapp.messageUser({
          userId,
          title: `A change to your ${KIND_LABEL[kind]} is waiting for approval`,
          message: `MicroBuilt proposed a change to your ${KIND_LABEL[kind]}. It applies once a super admin approves it; you'll be told either way.`,
        });
      }
    })().catch((error) => this.reportBackground(error, 'change-request.notify-admins'));
  }

  /** The customer withdrew a change an admin proposed for them: that admin hears about it. */
  private tellProposer(proposerId: string, userId: string, kind: ChangeRequestKind) {
    void (async () => {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      await this.inapp.messageUser({
        userId: proposerId,
        title: 'Proposed change withdrawn',
        message: `${user?.name ?? 'The customer'} withdrew the change you proposed to their ${KIND_LABEL[kind]}.`,
        callToActionUrl: `/customers/${userId}`,
      });
    })().catch((error) => this.reportBackground(error, 'change-request.notify-proposer'));
  }

  private async tellUser(request: RequestRow, outcome: 'approved' | 'rejected', note?: string) {
    const what = request.requestedById
      ? `The change to your ${KIND_LABEL[request.kind]}`
      : `Your ${KIND_LABEL[request.kind]} change`;
    await this.inapp
      .messageUser({
        userId: request.userId,
        title: `${what} was ${outcome}`,
        message:
          outcome === 'approved'
            ? `${what} has been approved and is now on your account.`
            : `${what} was not approved.${note ? ` Reason: ${note}` : ''} Your details are unchanged.`,
      })
      .catch((error) => this.reportBackground(error, 'change-request.notify-user'));
  }

  private reportBackground(error: unknown, job: string) {
    this.logger.error(`${job} failed`, error instanceof Error ? error.stack : String(error));
    captureJobError(error, { job });
  }
}

/** What everyone but a super admin sees for a BVN: that it is there (and changing), never the digits. */
export const HIDDEN_BVN = '•••••••••••';

function hideBvn(fields: Fields, viewer: { role: AccessRole } | null): Fields {
  if (viewer?.role === 'SUPER_ADMIN' || typeof fields?.bvn !== 'string') return fields;
  return { ...fields, bvn: HIDDEN_BVN };
}
