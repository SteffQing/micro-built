import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuthAccountsService } from 'src/auth/auth-accounts.service';
import { captureJobError } from 'src/common/observability';
import { generateId } from 'src/common/utils';
import { SYSTEM_ACTOR_ID } from 'src/ledger/ledger.constants';
import { LedgerTx, type Tx } from 'src/ledger/ledger.tx';
import { CustomerNotifierService } from 'src/notifications/customer-notifier.service';
import { MailService } from 'src/notifications/mail.service';
import { PrismaService } from '../database/prisma.service';
import type { InviteAdminDto } from './common/dto/superadmin.dto';
import type { AdminListDto } from './common/entities/superadmin.entities';

export const EMAIL_TAKEN = 'That email already has an account';
export const LAST_SUPER_ADMIN =
  'There must always be one active super admin: invite another before removing this one';

/** The first password, emailed once with the invite; the admin changes it after signing in. */
const newPassword = () => randomBytes(12).toString('base64url');

export interface InviteResult {
  name: string;
  reactivated: boolean;
  /** False when the invite email failed: the account exists, they can reset their password. */
  emailSent: boolean;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly accounts: AuthAccountsService,
    private readonly mail: MailService,
    private readonly notifier: CustomerNotifierService,
  ) {}

  /** Every admin except the SYSTEM account, removed (INACTIVE) ones included. */
  async getAllAdmins(): Promise<AdminListDto[]> {
    const admins = await this.prisma.admin.findMany({
      where: { role: { not: 'SYSTEM' } },
      orderBy: { user: { createdAt: 'desc' } },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            image: true,
            name: true,
            email: true,
            status: true,
            twoFactorEnabled: true,
            _count: { select: { passkeys: true } },
          },
        },
      },
    });
    return admins.map(({ role, user }) => ({
      id: user.id,
      avatar: user.image,
      name: user.name,
      role,
      email: user.email,
      status: user.status,
      twoFactorEnabled: user.twoFactorEnabled === true,
      passkeys: user._count.passkeys,
    }));
  }

  /**
   * A new admin account (password sign-in, emailed once), or a removed (INACTIVE) admin with that
   * email brought back with the new role and a new password. Any other account with the email is a
   * 409. The email goes out after commit; a failed send doesn't undo the invite.
   */
  async inviteAdmin(dto: InviteAdminDto, actorId: string): Promise<InviteResult> {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    const password = newPassword();

    let invited: { id: string; reactivated: boolean };
    try {
      invited = await this.ledgerTx.transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { email },
          select: { id: true, type: true, status: true, admin: { select: { role: true } } },
        });
        if (existing) {
          const removedAdmin =
            existing.type === 'ADMIN' &&
            existing.status === 'INACTIVE' &&
            existing.admin &&
            existing.admin.role !== 'SYSTEM';
          if (!removedAdmin) throw new ConflictException(EMAIL_TAKEN);
          await this.reactivate(tx, existing.id, name, dto.role, password);
          await this.ledgerTx.audit(tx, {
            actorId,
            action: 'ADMIN_INVITED',
            entityType: 'USER',
            entityId: existing.id,
            note: `Re-activated as ${dto.role}`,
          });
          return { id: existing.id, reactivated: true };
        }

        const id = generateId.adminId();
        await this.accounts.createWithPassword(tx, {
          id,
          type: 'ADMIN',
          name,
          email,
          status: 'ACTIVE',
          emailVerified: true,
          password,
        });
        await tx.admin.create({ data: { userId: id, role: dto.role } });
        await this.ledgerTx.audit(tx, {
          actorId,
          action: 'ADMIN_INVITED',
          entityType: 'USER',
          entityId: id,
          note: `Invited as ${dto.role}`,
        });
        return { id, reactivated: false };
      });
    } catch (error) {
      // Two invites for one email at once: the second hits the unique index.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(EMAIL_TAKEN);
      }
      throw error;
    }

    const emailSent = await this.sendInvite(email, name, password, invited.id, dto.role);
    return { name, reactivated: invited.reactivated, emailSent };
  }

  /**
   * The user goes INACTIVE and is signed out everywhere; the Admin row stays for audit history.
   * Refuses the caller themselves, the SYSTEM account, and the last active super admin.
   */
  async removeAdmin(id: string, actorId: string): Promise<{ name: string }> {
    if (id === actorId) throw new BadRequestException('You cannot remove your own admin account');
    if (id === SYSTEM_ACTOR_ID) throw new BadRequestException('The system account cannot be removed');

    const name = await this.ledgerTx.transaction(async (tx) => {
      const admin = await tx.admin.findUnique({
        where: { userId: id },
        select: { role: true, user: { select: { name: true, status: true } } },
      });
      if (!admin) throw new NotFoundException('No admin found with this id');
      if (admin.role === 'SYSTEM') throw new BadRequestException('The system account cannot be removed');
      if (admin.user.status === 'INACTIVE') throw new ConflictException('This admin has already been removed');

      if (admin.role === 'SUPER_ADMIN') {
        // Locks every active super admin, so two super admins removing each other can't both pass.
        const active = await tx.$queryRaw<{ id: string }[]>`
          SELECT u."id" FROM "user" u JOIN "Admin" a ON a."userId" = u."id"
          WHERE a."role" = 'SUPER_ADMIN' AND u."status" = 'ACTIVE'
          FOR UPDATE OF u`;
        if (!active.some((row) => row.id !== id)) throw new ConflictException(LAST_SUPER_ADMIN);
      }

      const { count } = await tx.user.updateMany({
        where: { id, status: { not: 'INACTIVE' } },
        data: { status: 'INACTIVE' },
      });
      if (count === 0) throw new ConflictException('This admin has already been removed');
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'ADMIN_REMOVED',
        entityType: 'USER',
        entityId: id,
        note: `Removed (was ${admin.role})`,
      });
      return admin.user.name;
    });

    try {
      await this.accounts.revokeSessions(id);
    } catch (error) {
      // The AccessGuard refuses INACTIVE users anyway; their old sessions just linger until expiry.
      this.logger.error(`Revoking sessions of removed admin ${id} failed`, error instanceof Error ? error.stack : error);
      captureJobError(error, { job: 'remove-admin-revoke-sessions' });
    }
    return { name };
  }

  /**
   * Gives an active admin another role. Not your own (another super admin does it), never the SYSTEM account, and
   * never the last active super admin's. A super admin without 2FA or a passkey is asked to set one up on their next
   * request; nobody is signed out.
   */
  async changeRole(id: string, role: AdminRole, actorId: string): Promise<{ name: string; from: AdminRole }> {
    if (id === actorId) throw new BadRequestException('You cannot change your own role: ask another super admin');
    if (id === SYSTEM_ACTOR_ID) throw new BadRequestException('The system account cannot be changed');

    const result = await this.ledgerTx.transaction(async (tx) => {
      const admin = await tx.admin.findUnique({
        where: { userId: id },
        select: { role: true, user: { select: { name: true, status: true } } },
      });
      if (!admin) throw new NotFoundException('No admin found with this id');
      if (admin.role === 'SYSTEM') throw new BadRequestException('The system account cannot be changed');
      if (admin.user.status === 'INACTIVE') throw new ConflictException('This admin has been removed: invite them again');
      if (admin.role === role) throw new ConflictException(`${admin.user.name} is already ${roleName(role)}`);

      if (admin.role === 'SUPER_ADMIN') {
        // As removing: lock every active super admin so two demotions can't both pass.
        const active = await tx.$queryRaw<{ id: string }[]>`
          SELECT u."id" FROM "user" u JOIN "Admin" a ON a."userId" = u."id"
          WHERE a."role" = 'SUPER_ADMIN' AND u."status" = 'ACTIVE'
          FOR UPDATE OF u`;
        if (!active.some((row) => row.id !== id)) throw new ConflictException(LAST_SUPER_ADMIN);
      }

      await tx.admin.update({ where: { userId: id }, data: { role } });
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'ADMIN_ROLE_CHANGED',
        entityType: 'USER',
        entityId: id,
        note: `${roleName(admin.role)} to ${roleName(role)}`,
        meta: { from: admin.role, to: role },
      });
      return { name: admin.user.name, from: admin.role };
    });

    void this.notifier.notify(id, {
      title: 'Your role has changed',
      message:
        `You are now ${roleName(role)} (you were ${roleName(result.from)}).` +
        (role === 'SUPER_ADMIN'
          ? ' Super admins need two-factor authentication or a passkey: set one up in Settings.'
          : ''),
      ctaUrl: '/settings',
    });
    return result;
  }

  /**
   * For a user locked out of their account (lost phone, authenticator or security key): their 2FA and passkeys are
   * removed and they are signed out everywhere. Customers and admins alike; never your own (another super admin does
   * it) or the SYSTEM account's. Audited with the reason; the user is told on every channel they have.
   */
  async resetSignIn(
    id: string,
    reason: string,
    actorId: string,
  ): Promise<{ name: string; twoFactor: boolean; passkeys: number }> {
    if (id === actorId) throw new BadRequestException('You cannot reset your own sign-in: ask another super admin');
    if (id === SYSTEM_ACTOR_ID) throw new BadRequestException('The system account cannot be reset');

    const result = await this.ledgerTx.transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        select: { name: true, admin: { select: { role: true } } },
      });
      if (!user) throw new NotFoundException('No user found with this id');
      if (user.admin?.role === 'SYSTEM') throw new BadRequestException('The system account cannot be reset');
      const cleared = await this.accounts.clearSignInFactors(tx, id);
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'SIGN_IN_RESET',
        entityType: 'USER',
        entityId: id,
        note: reason,
        meta: { twoFactorRemoved: cleared.twoFactor, passkeysRemoved: cleared.passkeys },
      });
      return { name: user.name, superAdmin: user.admin?.role === 'SUPER_ADMIN', ...cleared };
    });

    try {
      await this.accounts.revokeSessions(id);
    } catch (error) {
      this.logger.error(
        `Revoking sessions after a sign-in reset of ${id} failed`,
        error instanceof Error ? error.stack : error,
      );
      captureJobError(error, { job: 'reset-sign-in-revoke-sessions' });
    }
    void this.notifier.notify(id, {
      title: 'Your sign-in was reset',
      message:
        'A MicroBuilt super admin reset your sign-in: two-factor authentication and passkeys were removed and you ' +
        'were signed out on every device. ' +
        (result.superAdmin
          ? 'Sign in with your password, then set up two-factor authentication or a passkey again. '
          : 'Sign in again, then set them up again in Settings if you used them. ') +
        "If you didn't ask for this, contact MicroBuilt straight away.",
      ctaUrl: '/login',
    });
    return { name: result.name, twoFactor: result.twoFactor, passkeys: result.passkeys };
  }

  /**
   * Brings a removed admin back as a fresh account: new role and password, 2FA cleared so the
   * guard makes them set it up again (they may no longer have the old authenticator).
   */
  private async reactivate(tx: Tx, userId: string, name: string, role: AdminRole, password: string) {
    const { count } = await tx.user.updateMany({
      where: { id: userId, status: 'INACTIVE' },
      data: { status: 'ACTIVE', name, emailVerified: true, twoFactorEnabled: false },
    });
    if (count === 0) throw new ConflictException(EMAIL_TAKEN);
    await tx.admin.update({ where: { userId }, data: { role } });
    await this.accounts.clearSignInFactors(tx, userId);
    await this.accounts.setPassword(tx, userId, password);
  }

  private async sendInvite(email: string, name: string, password: string, id: string, role: AdminRole) {
    try {
      await this.mail.sendAdminInvite(email, name, password, id, role);
      return true;
    } catch (error) {
      this.logger.error(`Admin invite email to ${id} failed`, error instanceof Error ? error.stack : error);
      captureJobError(error, { job: 'admin-invite-email' });
      return false;
    }
  }
}

const ROLE_NAMES: Record<AdminRole, string> = {
  SUPER_ADMIN: 'a super admin',
  ADMIN: 'an admin',
  MARKETER: 'a marketer',
  SYSTEM: 'the system account',
};

function roleName(role: AdminRole): string {
  return ROLE_NAMES[role];
}
