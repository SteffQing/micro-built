import { redisStorage } from '@better-auth/redis-storage';
import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type Redis from 'ioredis';
import { generateId } from 'src/common/utils';
import type { MailService } from 'src/notifications/mail.service';
import type { SmsService } from 'src/notifications/sms.service';
import type { AuthDeps, AuthSenders } from './auth.config';

// The running app's better-auth dependencies (auth.module.ts). The smoke script builds the same
// deps with stub senders, so what it proves is what runs.

export const NEW_SIGN_UP_REASON = 'New sign up via app! Requires documents to proceed';
export const PASSWORD_RESET_REASON = 'User reset password! Requires admin to check in to confirm this action';

export type AuthEnv = Pick<
  AuthDeps,
  'baseURL' | 'secret' | 'frontendURL' | 'trustedOrigins' | 'cookieDomain' | 'secureCookies' | 'passkey'
>;

/** Reads the auth environment and fails at boot on anything missing (never at the first sign-in). */
export function readAuthEnv(env: NodeJS.ProcessEnv = process.env): AuthEnv {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} is not set (see apps/backend/.env.example)`);
    return value;
  };
  const origins = (value: string) =>
    value
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean);

  const secret = required('BETTER_AUTH_SECRET');
  if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');
  const frontendOrigins = origins(required('FRONTEND_ORIGINS'));
  const apiOrigin = env.API_ORIGIN?.trim().replace(/\/+$/, '');
  return {
    baseURL: required('BETTER_AUTH_URL'),
    secret,
    frontendURL: required('FRONTEND_URL').replace(/\/+$/, ''),
    // The API origin too, so Swagger (served there) can call /api/auth.
    trustedOrigins: [...new Set([...frontendOrigins, ...(apiOrigin ? [apiOrigin] : [])])],
    cookieDomain: env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
    secureCookies: env.NODE_ENV === 'production',
    passkey: { rpID: required('PASSKEY_RP_ID'), origin: frontendOrigins },
  };
}

export function deliverySenders(mail: MailService, sms: SmsService): AuthSenders {
  return {
    emailOtp: ({ email, otp, type }) => mail.sendOtp(email, otp, type),
    magicLink: ({ email, url }) => mail.sendMagicLink(email, url),
    passwordReset: ({ email, name, url }) => mail.sendPasswordReset(email, name, url),
    twoFactorEmail: ({ email, name, otp }) => mail.sendTwoFactorCode(email, name, otp),
    sms: ({ phoneNumber, code, purpose }) => sms.sendCode(phoneNumber, code, purpose),
  };
}

export function runtimeAuthDeps(
  prisma: PrismaClient,
  senders: AuthSenders,
  env: AuthEnv,
  redis?: Redis,
): AuthDeps {
  return {
    ...env,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    // Sessions are read from Redis and also kept in Postgres; rate limits live in Redis.
    secondaryStorage: redis ? redisStorage({ client: redis, keyPrefix: 'ba:' }) : undefined,
    generateUserId: generateId.userId,
    verifyLegacyPassword: (hash, password) => bcrypt.compare(password, hash),
    senders,
    lookups: {
      userGate: async (userId) => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            type: true,
            status: true,
            twoFactorEnabled: true,
            admin: { select: { role: true } },
            _count: { select: { passkeys: true } },
          },
        });
        if (!user) return null;
        return {
          type: user.type,
          status: user.status,
          role: user.admin?.role ?? null,
          twoFactorEnabled: user.twoFactorEnabled === true,
          passkeys: user._count.passkeys,
        };
      },
      emailAccount: async (email) => {
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { type: true, admin: { select: { role: true } } },
        });
        return user ? { type: user.type, role: user.admin?.role ?? null } : null;
      },
    },
    // better-auth creates only self sign-ups, which are customers (User.type defaults to
    // CUSTOMER and status to FLAGGED): open the customer record they'll complete.
    onUserCreated: async ({ id }) => {
      const user = await prisma.user.findUnique({ where: { id }, select: { type: true } });
      if (user?.type !== 'CUSTOMER') return;
      await prisma.customer.upsert({
        where: { userId: id },
        create: { userId: id, flagReason: NEW_SIGN_UP_REASON },
        update: {},
      });
    },
    // As v1: an admin confirms a reset with the customer before trusting the account again.
    onPasswordReset: async (userId) => {
      await prisma.customer.updateMany({ where: { userId }, data: { flagReason: PASSWORD_RESET_REASON } });
    },
    exposeReference: true,
  };
}
