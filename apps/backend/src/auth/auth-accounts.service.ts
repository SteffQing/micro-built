import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { normalizeNgPhone, placeholderEmail, visibleEmail } from '@microbuilt/shared';
import type { Prisma, User, UserStatus, UserType } from '@prisma/client';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { createOTP } from '@better-auth/utils/otp';
import { generateRandomString, hashPassword, symmetricDecrypt } from 'better-auth/crypto';
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

const MAX_CODE_FAILURES = 5;
const CODE_LOCK_MS = 15 * 60 * 1000;

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

  /**
   * Re-checks a signed-in user's authenticator (TOTP) code before an action that can't be taken back lightly, the way
   * better-auth's own verifyTOTP does. Five wrong codes lock it for 15 minutes (better-auth's lock fields), so the
   * six digits can't be guessed. Throws 403 with what to do; resolves when the code is right.
   */
  async assertTwoFactorCode(userId: string, code: string): Promise<void> {
    const record = await this.prisma.twoFactor.findFirst({ where: { userId } });
    if (!record?.secret) throw new ForbiddenException('Set up two-factor authentication first');
    if (record.lockedUntil && record.lockedUntil > new Date()) {
      throw new ForbiddenException('Too many wrong codes. Try again in 15 minutes');
    }
    const context = await this.auth.instance.$context;
    const secret = await symmetricDecrypt({ key: context.secretConfig, data: record.secret });
    const valid = /^\d{6}$/.test(code) && (await createOTP(secret, { period: 30, digits: 6 }).verify(code));
    if (valid) {
      if (record.failedVerificationCount) {
        await this.prisma.twoFactor.update({
          where: { id: record.id },
          data: { failedVerificationCount: 0, lockedUntil: null },
        });
      }
      return;
    }
    const failures = (record.failedVerificationCount ?? 0) + 1;
    const lock = failures >= MAX_CODE_FAILURES;
    await this.prisma.twoFactor.update({
      where: { id: record.id },
      data: {
        failedVerificationCount: lock ? 0 : failures,
        lockedUntil: lock ? new Date(Date.now() + CODE_LOCK_MS) : null,
      },
    });
    throw new ForbiddenException(
      lock ? 'Too many wrong codes. Try again in 15 minutes' : 'That code is not correct. Use the current one from your app',
    );
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
