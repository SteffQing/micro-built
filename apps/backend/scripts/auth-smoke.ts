// Auth smoke test (V2.MD Stage 4): the real better-auth config, Prisma and Redis, without booting
// Nest; senders are stubs that capture the codes. Every user it creates is deleted at the end.
//
//   pnpm exec tsx scripts/auth-smoke.ts
import 'dotenv/config';
import { normalizeNgPhone, placeholderEmail } from '@microbuilt/shared';
import { base32 } from '@better-auth/utils/base32';
import { createOTP } from '@better-auth/utils/otp';
import { PrismaClient } from '@prisma/client';
import type { AuthService } from '@thallesp/nestjs-better-auth';
import * as bcrypt from 'bcrypt';
import { generateRandomString, hashPassword } from 'better-auth/crypto';
import { randomBytes, randomInt } from 'node:crypto';
import Redis from 'ioredis';
import { AuthAccountsService } from '../src/auth/auth-accounts.service';
import { createAuth, type Auth, type AuthSenders } from '../src/auth/auth.config';
import { ADMIN_KEEPS_2FA_MESSAGE, ADMIN_SIGN_IN_MESSAGE } from '../src/auth/auth.constants';
import { NEW_SIGN_UP_REASON, PASSWORD_RESET_REASON, readAuthEnv, runtimeAuthDeps } from '../src/auth/auth.runtime';
import { redisOptions, redisUrl } from '../src/common/config/redis.config';

// Everything better-auth logs, so the run can prove the schema check stayed quiet.
const logged: string[] = [];
for (const level of ['log', 'info', 'warn', 'error'] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
    original(...args);
  };
}

const TAG = `smoke${Date.now().toString(36)}`;
const PASSWORD = `Mb-${randomBytes(12).toString('base64url')}`; // random, so HaveIBeenPwned passes it
const mail = (name: string) => `${TAG}.${name}@example.com`;
const phone = () => `080${String(randomInt(10_000_000, 99_999_999))}`;

type Sent = { to: string; kind: string; code?: string; url?: string };
const sent: Sent[] = [];
const senders: AuthSenders = {
  emailOtp: async ({ email, otp, type }) => void sent.push({ to: email, kind: type, code: otp }),
  magicLink: async ({ email, url }) => void sent.push({ to: email, kind: 'magic-link', url }),
  passwordReset: async ({ email, url }) => void sent.push({ to: email, kind: 'reset-link', url }),
  twoFactorEmail: async ({ email, otp }) => void sent.push({ to: email, kind: 'two-factor', code: otp }),
  sms: async ({ phoneNumber, code, purpose }) => void sent.push({ to: phoneNumber, kind: `sms:${purpose}`, code }),
};
/** Deliveries run in the background (no timing oracle), so a code can land just after the call returns. */
async function lastSent(to: string, kind: string): Promise<Sent> {
  for (let waited = 0; waited <= 10_000; waited += 100) {
    const found = [...sent].reverse().find((s) => s.to === to && s.kind === kind);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`nothing sent to ${to} (${kind})`);
}

/** Cookies across calls, as a browser keeps them. */
class Jar {
  private readonly cookies = new Map<string, string>();
  take(headers: Headers): this {
    for (const line of headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      const name = pair.slice(0, at).trim();
      const value = pair.slice(at + 1).trim();
      if (!value || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return this;
  }
  headers(): Headers {
    const headers = new Headers();
    if (this.cookies.size) headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    return headers;
  }
}

const errorText = (error: unknown) => {
  const e = error as { status?: string | number; body?: { message?: string }; message?: string };
  return `${e.status ?? ''} ${e.body?.message ?? e.message ?? String(error)}`.trim();
};
async function refused(action: Promise<unknown>, expected?: string | RegExp): Promise<string> {
  try {
    await action;
  } catch (error) {
    const text = errorText(error);
    const ok = !expected || (typeof expected === 'string' ? text.includes(expected) : expected.test(text));
    if (!ok) throw new Error(`refused with "${text}", expected ${expected}`);
    return text;
  }
  throw new Error('was allowed');
}
function check(condition: unknown, what: string): asserts condition {
  if (!condition) throw new Error(what);
}
async function totpFor(enabled: { method: string } | { method: 'totp'; totpURI: string }): Promise<string> {
  check('totpURI' in enabled, 'enabling 2FA should return a TOTP URI');
  const secret = new URL(enabled.totpURI).searchParams.get('secret') ?? '';
  return createOTP(new TextDecoder().decode(base32.decode(secret))).totp();
}

async function main() {
  const prisma = new PrismaClient();
  const redis = new Redis(redisUrl, { ...redisOptions, maxRetriesPerRequest: 3 });
  const auth: Auth = createAuth(runtimeAuthDeps(prisma, senders, readAuthEnv(), redis));
  const accounts = new AuthAccountsService(prisma as never, { instance: auth } as unknown as AuthService<Auth>);
  const created: string[] = [];
  const phones: string[] = [];
  let failed = false;

  const step = async (name: string, run: () => Promise<void>) => {
    if (failed) return;
    try {
      await run();
      console.log(`✓ ${name}`);
    } catch (error) {
      failed = true;
      console.log(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const customerEmail = mail('customer');
  const customer = new Jar();

  try {
    await step('email sign-up waits for the emailed code; the code verifies it; sign-in gives a session', async () => {
      const signUp = await auth.api.signUpEmail({ body: { name: 'Smoke Customer', email: customerEmail, password: PASSWORD } });
      created.push(signUp.user.id);
      check(signUp.token === null, 'sign-up should not sign in before the email is verified');
      check(signUp.user.id.startsWith('MB-'), `customer id ${signUp.user.id} should be MB-…`);
      await auth.api.verifyEmailOTP({ body: { email: customerEmail, otp: (await lastSent(customerEmail, 'email-verification')).code! } });
      const { headers } = await auth.api.signInEmail({ body: { email: customerEmail, password: PASSWORD }, returnHeaders: true });
      customer.take(headers);
      const session = await auth.api.getSession({ headers: customer.headers() });
      check(session?.user.email === customerEmail, 'getSession should return the customer');
      const row = await prisma.user.findUniqueOrThrow({ where: { id: signUp.user.id }, include: { customer: true } });
      check(row.type === 'CUSTOMER' && row.status === 'FLAGGED', `new user is ${row.type}/${row.status}`);
      check(row.customer?.flagReason === NEW_SIGN_UP_REASON, 'a Customer row flagged for onboarding');
    });

    const local = phone();
    const e164 = normalizeNgPhone(local)!;
    phones.push(e164);
    await step('phone sign-up as 080…: nothing mailed to the placeholder, SMS code verifies, phone + password signs in', async () => {
      const signUp = await auth.api.signUpEmail({
        body: { name: 'Smoke Phone', email: placeholderEmail(e164), password: PASSWORD, phoneNumber: local },
      });
      created.push(signUp.user.id);
      check(!sent.some((s) => s.to === placeholderEmail(e164)), 'nothing may be mailed to a placeholder address');
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: signUp.user.id } });
      check(stored.phoneNumber === e164, `phone stored as ${stored.phoneNumber}, expected ${e164}`);
      await refused(auth.api.signInPhoneNumber({ body: { phoneNumber: local, password: PASSWORD } }), /not verified/i);
      await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: local } });
      await auth.api.verifyPhoneNumber({ body: { phoneNumber: local, code: (await lastSent(e164, 'sms:verify')).code! } });
      const signIn = await auth.api.signInPhoneNumber({ body: { phoneNumber: local, password: PASSWORD } });
      check(signIn.token, 'phone + password should give a session');
    });

    await step('customer turns on TOTP; the next password sign-in stops for the second factor, an emailed code finishes it', async () => {
      const enabled = await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers: customer.headers() });
      const { headers } = await auth.api.verifyTOTP({
        body: { code: await totpFor(enabled) },
        headers: customer.headers(),
        returnHeaders: true,
      });
      customer.take(headers);
      const pending = new Jar();
      const signIn = await auth.api.signInEmail({ body: { email: customerEmail, password: PASSWORD }, returnHeaders: true });
      pending.take(signIn.headers);
      check('twoFactorRedirect' in signIn.response && signIn.response.twoFactorRedirect, 'sign-in should ask for the second factor');
      await auth.api.sendTwoFactorOTP({ headers: pending.headers() });
      const verified = await auth.api.verifyTwoFactorOTP({
        body: { code: (await lastSent(customerEmail, 'two-factor')).code! },
        headers: pending.headers(),
        returnHeaders: true,
      });
      pending.take(verified.headers);
      check((await auth.api.getSession({ headers: pending.headers() }))?.user.email === customerEmail, 'session after 2FA');
    });

    await step('customer can also sign in by magic link, by email code and by SMS code', async () => {
      await auth.api.signInMagicLink({ body: { email: customerEmail }, headers: new Headers() });
      const token = new URL((await lastSent(customerEmail, 'magic-link')).url!).searchParams.get('token')!;
      const link = await auth.api.magicLinkVerify({ query: { token }, headers: new Headers() });
      check(link && 'token' in link && link.token, 'magic link should give a session');
      await auth.api.sendVerificationOTP({ body: { email: customerEmail, type: 'sign-in' } });
      const code = await auth.api.signInEmailOTP({ body: { email: customerEmail, otp: (await lastSent(customerEmail, 'sign-in')).code! } });
      check(code.token, 'email code should give a session');
      await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: e164 } });
      const sms = await auth.api.verifyPhoneNumber({ body: { phoneNumber: e164, code: (await lastSent(e164, 'sms:verify')).code! } });
      check(sms.token, 'SMS code should give a session');
    });

    const adminEmail = mail('admin');
    const adminPhone = normalizeNgPhone(phone())!;
    phones.push(adminPhone);
    const adminId = `AD-${TAG.toUpperCase()}`;
    const admin = new Jar();
    await step('admin: magic link and email-code requests are refused with the message, and nothing is sent', async () => {
      await prisma.$transaction(async (tx) => {
        await accounts.createWithPassword(tx, {
          id: adminId,
          type: 'ADMIN',
          name: 'Smoke Admin',
          email: adminEmail,
          phoneNumber: adminPhone,
          status: 'ACTIVE',
          emailVerified: true,
          password: PASSWORD,
        });
        await tx.admin.create({ data: { userId: adminId, role: 'ADMIN' } });
      });
      created.push(adminId);
      const before = sent.length;
      await refused(auth.api.signInMagicLink({ body: { email: adminEmail }, headers: new Headers() }), ADMIN_SIGN_IN_MESSAGE);
      await refused(auth.api.sendVerificationOTP({ body: { email: adminEmail, type: 'sign-in' } }), ADMIN_SIGN_IN_MESSAGE);
      check(sent.length === before, 'no code or link may go to an admin');
    });

    await step('admin: sessions from an email code or an SMS code are refused by the session gate', async () => {
      const otp = await auth.api.createVerificationOTP({ body: { email: adminEmail, type: 'sign-in' } });
      await refused(auth.api.signInEmailOTP({ body: { email: adminEmail, otp } }), ADMIN_SIGN_IN_MESSAGE);
      await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: adminPhone } });
      await refused(
        auth.api.verifyPhoneNumber({ body: { phoneNumber: adminPhone, code: (await lastSent(adminPhone, 'sms:verify')).code! } }),
        ADMIN_SIGN_IN_MESSAGE,
      );
    });

    await step('admin: password sign-in works; passkeys refused; 2FA turned on and then required; 2FA cannot be turned off', async () => {
      const signIn = await auth.api.signInEmail({ body: { email: adminEmail, password: PASSWORD }, returnHeaders: true });
      admin.take(signIn.headers);
      await refused(auth.api.generatePasskeyRegistrationOptions({ headers: admin.headers() }), ADMIN_SIGN_IN_MESSAGE);
      const enabled = await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers: admin.headers() });
      const verified = await auth.api.verifyTOTP({
        body: { code: await totpFor(enabled) },
        headers: admin.headers(),
        returnHeaders: true,
      });
      admin.take(verified.headers);
      const again = await auth.api.signInEmail({ body: { email: adminEmail, password: PASSWORD } });
      check('twoFactorRedirect' in again && again.twoFactorRedirect, 'admin password sign-in should ask for the code');
      await refused(
        auth.api.disableTwoFactor({ body: { password: PASSWORD }, headers: admin.headers() }),
        ADMIN_KEEPS_2FA_MESSAGE,
      );
    });

    await step('a pwned password ("password") is refused', async () => {
      await refused(auth.api.signUpEmail({ body: { name: 'Pwned', email: mail('pwned'), password: 'password' } }), /compromised/i);
    });

    await step('the bearer token from sign-in works as Authorization: Bearer', async () => {
      const signIn = await auth.api.signInPhoneNumber({ body: { phoneNumber: e164, password: PASSWORD }, returnHeaders: true });
      const token = signIn.headers.get('set-auth-token');
      check(token, 'sign-in should return set-auth-token');
      const session = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
      check(session?.user.phoneNumber === e164, 'getSession by bearer token');
    });

    await step('a v1 user with a bcrypt password signs in', async () => {
      const id = `MB-${TAG.toUpperCase()}L`;
      const email = mail('legacy');
      await prisma.user.create({ data: { id, name: 'Smoke Legacy', email, emailVerified: true, status: 'ACTIVE' } });
      created.push(id);
      await prisma.account.create({
        data: {
          id: generateRandomString(32, 'a-z', 'A-Z', '0-9'),
          accountId: id,
          providerId: 'credential',
          userId: id,
          password: await bcrypt.hash(PASSWORD, 10),
        },
      });
      const signIn = await auth.api.signInEmail({ body: { email, password: PASSWORD } });
      check(signIn.token, 'legacy bcrypt hash should verify');
      void hashPassword;
    });

    await step('a password reset by SMS code flags the customer for review', async () => {
      const phoneUser = await prisma.user.findFirstOrThrow({ where: { phoneNumber: e164 } });
      await auth.api.requestPasswordResetPhoneNumber({ body: { phoneNumber: e164 } });
      const code = (await lastSent(e164, 'sms:reset-password')).code!;
      await auth.api.resetPasswordPhoneNumber({ body: { phoneNumber: e164, otp: code, newPassword: `${PASSWORD}x` } });
      const flagged = await prisma.customer.findUniqueOrThrow({ where: { userId: phoneUser.id } });
      check(flagged.flagReason === PASSWORD_RESET_REASON, `flagReason is "${flagged.flagReason}"`);
    });

    await step('a deactivated (INACTIVE) user cannot get a session', async () => {
      await prisma.user.update({ where: { email: customerEmail }, data: { status: 'INACTIVE' } });
      await auth.api.sendVerificationOTP({ body: { email: customerEmail, type: 'sign-in' } });
      await refused(
        auth.api.signInEmailOTP({ body: { email: customerEmail, otp: (await lastSent(customerEmail, 'sign-in')).code! } }),
        /deactivated/,
      );
    });

    await step('better-auth logged no schema mismatch', async () => {
      const mismatch = logged.find((line) => /schema mismatch|SchemaMismatch/i.test(line));
      check(!mismatch, `logged: ${mismatch}`);
    });
  } finally {
    const context = await auth.$context;
    for (const id of created) await context.internalAdapter.deleteUserSessions(id).catch(() => undefined);
    await prisma.verification.deleteMany({
      where: {
        OR: [
          { identifier: { contains: TAG } },
          { value: { contains: TAG } },
          ...phones.map((p) => ({ identifier: { contains: p } })),
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    const left = await prisma.user.count({ where: { id: { in: created } } });
    console.log(`cleanup: ${created.length} users removed${left ? `, ${left} LEFT` : ''}`);
    await redis.quit();
    await prisma.$disconnect();
  }
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
