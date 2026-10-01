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
  ) {}

  /** Every admin except the SYSTEM account, removed (INACTIVE) ones included. */
  async getAllAdmins(): Promise<AdminListDto[]> {
    const admins = await this.prisma.admin.findMany({
      where: { role: { not: 'SYSTEM' } },
      orderBy: { user: { createdAt: 'desc' } },
      select: {
        role: true,
        user: {
          select: { id: true, image: true, name: true, email: true, status: true },
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
    await tx.twoFactor.deleteMany({ where: { userId } });
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
