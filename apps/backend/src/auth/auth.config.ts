// The better-auth configuration: every option and plugin, with everything app-specific injected
// through `deps` (D15). Three places use it: auth.module.ts builds the running instance, auth.ts
// feeds the CLI that generates the auth models, and client.ts derives the frontend's typed client
// from `Auth`. The frontend type-checks this file, so it imports nothing from Nest, Prisma or
// `src/*` — only better-auth and @microbuilt/shared.
import { isNigerianPhone, isPlaceholderEmail, normalizeNgPhone, placeholderEmail } from '@microbuilt/shared';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { generateRandomString, verifyPassword } from 'better-auth/crypto';
import { openAPI } from 'better-auth/plugins';
import { bearer } from 'better-auth/plugins/bearer';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { haveIBeenPwned } from 'better-auth/plugins/haveibeenpwned';
import { magicLink } from 'better-auth/plugins/magic-link';
import { phoneNumber } from 'better-auth/plugins/phone-number';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { passkey } from '@better-auth/passkey';
import {
  SUPER_ADMIN_SIGN_IN_MESSAGE,
  SUPER_ADMIN_KEEPS_FACTOR_MESSAGE,
  SUPER_ADMIN_USE_PASSKEY_MESSAGE,
  CODE_TTL_MINUTES,
  MAGIC_LINK_TTL_MINUTES,
  TWO_FACTOR_CODE_TTL_MINUTES,
} from './auth.constants';

export type AccountType = 'CUSTOMER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'FLAGGED';
export type EmailOtpType = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

/**
 * Delivery for every code and link better-auth issues. Placeholder addresses are filtered out
 * before these are called. Each call runs in the background, so the response never waits on
 * delivery (no timing oracle) and a rejection is logged by better-auth, never surfaced.
 */
export interface AuthSenders {
  emailOtp(data: { email: string; otp: string; type: EmailOtpType }): Promise<void>;
  magicLink(data: { email: string; url: string }): Promise<void>;
  passwordReset(data: { email: string; name: string; url: string }): Promise<void>;
  twoFactorEmail(data: { email: string; name: string; otp: string }): Promise<void>;
  sms(data: { phoneNumber: string; code: string; purpose: 'verify' | 'reset-password' | 'two-factor' }): Promise<void>;
}

export interface UserGate {
  type: AccountType;
  status: AccountStatus;
  /** The admin's role; null for customers. */
  role: string | null;
  twoFactorEnabled: boolean;
  passkeys: number;
}

export interface AuthLookups {
  /** Who a user is for the sign-in rules, or null when there is no such user. */
  userGate(userId: string): Promise<UserGate | null>;
  /** The account registered under a (lower-cased) email (role null for customers), or null when there is none. */
  emailAccount(email: string): Promise<{ type: AccountType; role: string | null } | null>;
}

export interface AuthDeps {
  /** Public origin auth links are built from: the frontend origin, which proxies /api (D8). */
  baseURL: string;
  secret: string;
  /** Frontend origin that hosts the reset-password page. */
  frontendURL: string;
  trustedOrigins: string[];
  database: BetterAuthOptions['database'];
  secondaryStorage?: BetterAuthOptions['secondaryStorage'];
  /** Parent domain the session cookie is shared on, e.g. "microbuiltprime.com"; unset locally. */
  cookieDomain?: string;
  secureCookies: boolean;
  passkey: { rpID: string; origin: string | string[] };
  /** Id for users better-auth creates (self sign-ups, so customer ids). */
  generateUserId(): string;
  /** Verifies bcrypt hashes carried over from v1 ("$2a$…"/"$2b$…"). */
  verifyLegacyPassword?(hash: string, password: string): Promise<boolean>;
  senders: AuthSenders;
  lookups: AuthLookups;
  onUserCreated?(user: { id: string; email: string; name: string }): Promise<void>;
  onPasswordReset?(userId: string): Promise<void>;
  /**
   * A signed-in user changing their own name, email or phone. Null lets the write go
   * ahead; otherwise the change was put up for approval and the result is written instead (the
   * current values, so nothing changes yet).
   */
  holdProfileChange?(userId: string, fields: ProfileChange): Promise<Record<string, unknown> | null>;
  /** Serve better-auth's own endpoint reference at <basePath>/reference. */
  exposeReference?: boolean;
}

/** What waits for approval; a photo changes at once. */
export interface ProfileChange {
  name?: string;
  email?: string;
  phoneNumber?: string;
}

export { SUPER_ADMIN_SIGN_IN_MESSAGE };

// Where a user changes their own profile (each after its code is checked, for email and phone).
// Writes from anywhere else (verifying an address, 2FA, sign-up) are not profile changes.
const PROFILE_CHANGE_PATHS = new Set(['/update-user', '/email-otp/change-email', '/phone-number/verify']);

function profileChange(data: Record<string, unknown>): ProfileChange | null {
  const change: ProfileChange = {};
  if (typeof data.name === 'string') change.name = data.name;
  if (typeof data.email === 'string') change.email = data.email;
  if (typeof data.phoneNumber === 'string') change.phoneNumber = data.phoneNumber;
  return Object.keys(change).length > 0 ? change : null;
}

// Sessions from a code or link sent to the inbox or phone: open to everyone but super admins, whose sign-in always
// takes a second factor (these skip it). Admins' and marketers' core actions still ask for a code or passkey
// (ConfirmationGuard). A passkey is fine for anyone: it is already two factors, the device and its fingerprint/face/PIN.
const PASSWORDLESS_SESSION_PATHS = new Set(['/magic-link/verify', '/sign-in/email-otp', '/phone-number/verify']);

// Password sign-ins. A super admin with 2FA goes on to the code (the plugin swaps this session for a pending one);
// one with only a passkey uses the passkey instead, so the password alone never signs them in.
const PASSWORD_SESSION_PATHS = new Set(['/sign-in/email', '/sign-in/phone-number', '/sign-in/username']);

function stringField(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

export function createAuth(deps: AuthDeps) {
  const { senders, lookups } = deps;

  return betterAuth({
    appName: 'MicroBuilt',
    baseURL: deps.baseURL,
    secret: deps.secret,
    trustedOrigins: deps.trustedOrigins,
    database: deps.database,
    secondaryStorage: deps.secondaryStorage,
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      storeSessionInDatabase: true,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      enabled: true,
      storage: deps.secondaryStorage ? 'secondary-storage' : 'memory',
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      // Whoever held a session before the reset (perhaps the reason for it) is signed out.
      revokeSessionsOnPasswordReset: true,
      password: {
        verify: async ({ hash, password }) => {
          if (!hash.startsWith('$2')) return verifyPassword({ hash, password });
          return deps.verifyLegacyPassword ? deps.verifyLegacyPassword(hash, password) : false;
        },
      },
      sendResetPassword: async ({ user, token }) => {
        if (isPlaceholderEmail(user.email)) return;
        const url = `${deps.frontendURL}/reset-password?token=${encodeURIComponent(token)}`;
        return senders.passwordReset({ email: user.email, name: user.name, url });
      },
      onPasswordReset: async ({ user }) => {
        await deps.onPasswordReset?.(user.id);
      },
    },
    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        disableSignUp: true,
        expiresIn: CODE_TTL_MINUTES * 60,
        // Only a hash is stored: a database reader can't use a live code.
        storeOTP: 'hashed',
        // The code goes to the new address only: a placeholder can't receive one.
        changeEmail: { enabled: true, verifyCurrentEmail: false },
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (isPlaceholderEmail(email)) return;
          return senders.emailOtp({ email, otp, type });
        },
      }),
      magicLink({
        disableSignUp: true,
        expiresIn: MAGIC_LINK_TTL_MINUTES * 60,
        storeToken: 'hashed',
        sendMagicLink: async ({ email, url }, ctx) => {
          if (isPlaceholderEmail(email)) return;
          // Unlike the other senders, better-auth awaits this one directly.
          const delivery = senders.magicLink({ email, url });
          if (ctx) await ctx.context.runInBackgroundOrAwait(delivery);
          else await delivery;
        },
      }),
      phoneNumber({
        requireVerification: true,
        expiresIn: CODE_TTL_MINUTES * 60,
        phoneNumberValidator: isNigerianPhone,
        sendOTP: ({ phoneNumber, code }) => senders.sms({ phoneNumber, code, purpose: 'verify' }),
        sendPasswordResetOTP: ({ phoneNumber, code }) =>
          senders.sms({ phoneNumber, code, purpose: 'reset-password' }),
      }),
      twoFactor({
        issuer: 'MicroBuilt',
        otpOptions: {
          period: TWO_FACTOR_CODE_TTL_MINUTES,
          storeOTP: 'hashed',
          // Email when the user has a real address, otherwise SMS to the verified phone.
          sendOTP: async ({ user, otp }) => {
            if (!isPlaceholderEmail(user.email)) {
              return senders.twoFactorEmail({ email: user.email, name: user.name, otp });
            }
            if ('phoneNumber' in user && typeof user.phoneNumber === 'string') {
              return senders.sms({ phoneNumber: user.phoneNumber, code: otp, purpose: 'two-factor' });
            }
          },
        },
      }),
      passkey({
        rpID: deps.passkey.rpID,
        rpName: 'MicroBuilt',
        origin: deps.passkey.origin,
      }),
      bearer(),
      haveIBeenPwned(),
      ...(deps.exposeReference ? [openAPI()] : []),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // A super admin asking for a magic link or a sign-in code is told straight away to use a passkey or password
        // + 2FA, and nothing is sent. The session gate below is still what enforces it.
        // Magic links for unknown emails get the normal reply with nothing sent, as email codes do.
        if (ctx.path === '/sign-in/magic-link' || ctx.path === '/email-otp/send-verification-otp') {
          const email = stringField(ctx.body, 'email')?.toLowerCase();
          const isSignIn = ctx.path === '/sign-in/magic-link' || stringField(ctx.body, 'type') === 'sign-in';
          if (email && isSignIn) {
            const account = await lookups.emailAccount(email);
            if (account?.role === 'SUPER_ADMIN') throw new APIError('FORBIDDEN', { message: SUPER_ADMIN_SIGN_IN_MESSAGE });
            if (ctx.path === '/sign-in/magic-link' && account === null) return ctx.json({ status: true });
          }
        }
        // A super admin always keeps one strong factor: 2FA off only with a passkey, the last passkey only with 2FA.
        if (ctx.path === '/two-factor/disable' || ctx.path === '/passkey/delete-passkey') {
          const session = await getSessionFromCtx(ctx);
          const gate = session ? await lookups.userGate(session.user.id) : null;
          if (gate?.role === 'SUPER_ADMIN') {
            const keepsOne =
              ctx.path === '/two-factor/disable' ? gate.passkeys > 0 : gate.twoFactorEnabled || gate.passkeys > 1;
            if (!keepsOne) throw new APIError('FORBIDDEN', { message: SUPER_ADMIN_KEEPS_FACTOR_MESSAGE });
          }
        }
        // Phones are stored as +234XXXXXXXXXX. Accept 080…, 234… and +234… everywhere, so sign-in,
        // OTP and reset lookups match what sign-up stored.
        const phone = stringField(ctx.body, 'phoneNumber');
        const normalized = phone === undefined ? null : normalizeNgPhone(phone);
        if (normalized && normalized !== phone) {
          return { context: { body: { ...(ctx.body as Record<string, unknown>), phoneNumber: normalized } } };
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const email = user.email.toLowerCase();
            let phone: string | null = null;
            if (user.phoneNumber !== undefined && user.phoneNumber !== null) {
              phone = typeof user.phoneNumber === 'string' ? normalizeNgPhone(user.phoneNumber) : null;
              if (!phone) throw new APIError('BAD_REQUEST', { message: 'Enter a valid Nigerian phone number' });
            }
            if (isPlaceholderEmail(email) && (!phone || placeholderEmail(phone) !== email)) {
              throw new APIError('BAD_REQUEST', {
                message: 'A phone-only sign-up needs the placeholder email of its phone number',
              });
            }
            return { data: { ...user, email, phoneNumber: phone } };
          },
          after: async (user) => {
            await deps.onUserCreated?.({ id: user.id, email: user.email, name: user.name });
          },
        },
        update: {
          before: async (data, ctx) => {
            // Profile changes wait for approval (except a super admin's). better-auth merges what
            // this returns over `data`, so a held change is written back as the current values.
            const self = ctx?.context.session?.user.id;
            const change = profileChange(data);
            if (self && change && deps.holdProfileChange && PROFILE_CHANGE_PATHS.has(ctx.path)) {
              const keep = await deps.holdProfileChange(self, change);
              if (keep) return { data: { ...data, ...keep } };
            }
            // A phone-only user who changes number gets the new number's placeholder, so the old
            // number stays free for someone else to sign up with.
            const current = ctx?.context.session?.user.email;
            if (typeof data.phoneNumber !== 'string' || data.email !== undefined || !current) return;
            if (!isPlaceholderEmail(current) || !isNigerianPhone(data.phoneNumber)) return;
            return { data: { ...data, email: placeholderEmail(data.phoneNumber) } };
          },
        },
      },
      session: {
        create: {
          // The one enforcement point for account status and how admins may sign in (D2, D6).
          before: async (session, ctx) => {
            const gate = await lookups.userGate(session.userId);
            if (!gate || gate.status === 'INACTIVE') {
              throw new APIError('FORBIDDEN', { message: 'This account is deactivated. Contact support.' });
            }
            if (gate.role === 'SUPER_ADMIN' && ctx && PASSWORDLESS_SESSION_PATHS.has(ctx.path)) {
              throw new APIError('FORBIDDEN', { message: SUPER_ADMIN_SIGN_IN_MESSAGE });
            }
            if (
              gate.role === 'SUPER_ADMIN' &&
              ctx &&
              PASSWORD_SESSION_PATHS.has(ctx.path) &&
              !gate.twoFactorEnabled &&
              gate.passkeys > 0
            ) {
              throw new APIError('FORBIDDEN', { message: SUPER_ADMIN_USE_PASSKEY_MESSAGE });
            }
          },
        },
      },
    },
    advanced: {
      useSecureCookies: deps.secureCookies,
      crossSubDomainCookies: deps.cookieDomain ? { enabled: true, domain: deps.cookieDomain } : undefined,
      ipAddress: { ipAddressHeaders: ['x-client-ip'] },
      // Having a handler is what stops better-auth awaiting deliveries. The process outlives the
      // request and better-auth has already attached error logging, so there is nothing to do here.
      backgroundTasks: { handler: () => {} },
      database: {
        validateSchema: true,
        // Customers get MB- ids; every other auth row keeps better-auth's default id format.
        generateId: ({ model, size }) =>
          model === 'user' ? deps.generateUserId() : generateRandomString(size ?? 32, 'a-z', 'A-Z', '0-9'),
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
