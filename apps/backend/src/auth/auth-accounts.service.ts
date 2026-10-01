import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { normalizeNgPhone, placeholderEmail, visibleEmail } from '@microbuilt/shared';
import type { Prisma, User, UserStatus, UserType } from '@prisma/client';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { generateRandomString, hashPassword } from 'better-auth/crypto';
import type { AuthUser } from 'src/common/types';
import { PrismaService } from 'src/database/prisma.service';
import type { Auth } from './auth.config';

export interface CreateWithPassword {
  /** AD-… for admins, MB-… for customers (src/common/utils/generate-id.ts). */
  id: string;
  type: UserType;
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  /** An admin collected the number in person; otherwise the owner verifies it by SMS. */
  phoneNumberVerified?: boolean;
  status: UserStatus;
  emailVerified: boolean;
  password: string;
}

// Accounts the platform creates for people (admin invites, onboarding, bulk import) rather than
// self sign-ups, which better-auth creates itself.
@Injectable()
export class AuthAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService<Auth>,
  ) {}

  /** A user with a password sign-in (better-auth's credential account), inside the caller's transaction. */
  async createWithPassword(tx: Prisma.TransactionClient, input: CreateWithPassword): Promise<User> {
    const phoneNumber = input.phoneNumber ? normalizeNgPhone(input.phoneNumber) : null;
    if (input.phoneNumber && !phoneNumber) throw new BadRequestException('Enter a valid Nigerian phone number');
    const email = input.email?.trim().toLowerCase() || (phoneNumber ? placeholderEmail(phoneNumber) : null);
    if (!email) throw new BadRequestException('An email or a phone number is required');

    const user = await tx.user.create({
      data: {
        id: input.id,
        type: input.type,
        name: input.name,
        email,
        emailVerified: input.emailVerified,
        phoneNumber,
        phoneNumberVerified: phoneNumber ? (input.phoneNumberVerified ?? false) : null,
        status: input.status,
      },
    });
    await this.createCredential(tx, user.id, await hashPassword(input.password));
    return user;
  }

  /** Sets (or adds) the user's password sign-in, inside the caller's transaction. */
  async setPassword(tx: Prisma.TransactionClient, userId: string, password: string): Promise<void> {
    const hash = await hashPassword(password);
    const { count } = await tx.account.updateMany({
      where: { userId, providerId: 'credential' },
      data: { password: hash },
    });
    if (count === 0) await this.createCredential(tx, userId, hash);
  }

  private async createCredential(tx: Prisma.TransactionClient, userId: string, hash: string): Promise<void> {
    await tx.account.create({
      data: {
        // better-auth's own id format for its tables.
        id: generateRandomString(32, 'a-z', 'A-Z', '0-9'),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hash,
      },
    });
  }

  /** Signs a user out everywhere (removed admins, deactivated customers). */
  async revokeSessions(userId: string): Promise<void> {
    const context = await this.auth.instance.$context;
    await context.internalAdapter.deleteUserSessions(userId);
  }

  /** The user behind a session as the AccessGuard sees them; null if the user is gone. */
  async accessUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        type: true,
        status: true,
        email: true,
        twoFactorEnabled: true,
        admin: { select: { role: true } },
      },
    });
    if (!user) return null;
    if (user.type === 'ADMIN' && !user.admin) throw new ForbiddenException('This admin account is not set up');
    return {
      userId: user.id,
      type: user.type,
      role: user.type === 'ADMIN' && user.admin ? user.admin.role : 'CUSTOMER',
      email: visibleEmail(user.email),
      status: user.status,
      twoFactorEnabled: user.twoFactorEnabled === true,
    };
  }
}
