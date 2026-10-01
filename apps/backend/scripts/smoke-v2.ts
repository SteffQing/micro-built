// v2 end-to-end smoke (V2.MD Stage 7) against a running API: `node dist/main` or `pnpm start:dev`.
// HTTP only: Nest is never booted here. Prisma creates the starting users, reads balances for
// printing and cleans up; everything else goes through the API.
//
//   a. Admin release blockers (V2.MD §0.2): an admin without 2FA signs in with a password, gets 200
//      from GET /user and 403 TWO_FACTOR_SETUP_REQUIRED from an admin route; turns on TOTP through
//      better-auth (code computed here, RFC 6238); the admin route answers; after signing out, the
//      password sign-in asks for the code; magic-link and email-code requests are refused.
//   b. A super admin (2FA turned on the same real way) and a customer.
//   c. A whole month: loan request → approve → disburse → variation preview, submit, file link →
//      payroll upload (validate, then upload) that underpays → inflow SETTLED → close the month
//      (penalty, net-pay cap proposal → approve) → liquidation with proof → statement file →
//      balances.
//   d. Refuses to run while any loan it didn't create exists (submitting and closing a month moves
//      every customer's deductions) unless --force. Snapshots the PayrollPeriod rows and Settings,
//      and in `finally` deletes everything it created (rows and stored files) and restores both.
//
//   cd apps/backend && pnpm exec tsx scripts/smoke-v2.ts [--force]
//   SMOKE_BASE=http://localhost:3003 (default)
//
// Mail only goes to Resend's test inbox (delivered+…@resend.dev) or to @example.com addresses.
// Exit code 0 only when every check passed, cleanup included.
import { parsePeriodLabel, periodLabel, toYm, type Period } from '@microbuilt/shared';
import { Prisma, PrismaClient, type PayrollPeriod, type Settings } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { hashPassword } from 'better-auth/crypto';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { payrollSheet, XLSX_MIME } from '../test/fixtures/payroll-sheet';

process.loadEnvFile(resolve(__dirname, '..', '.env'));

const BASE = (process.env.SMOKE_BASE ?? 'http://localhost:3003').replace(/\/$/, '');
const ORIGIN = (process.env.FRONTEND_ORIGINS ?? '').split(',')[0].trim() || BASE;
const FORCE = process.argv.includes('--force');
const TAG = `smk${Date.now().toString(36)}`;
const PASSWORD = `Mb-${randomBytes(12).toString('base64url')}`; // random, so HaveIBeenPwned passes it
const PDF = Buffer.from('%PDF-1.4\n% MicroBuilt smoke proof of payment\n%%EOF\n');
const BUCKETS = {
  payroll: 'payroll-uploads',
  variations: 'variations',
  proofs: 'liquidation-proofs',
  exports: 'exports',
} as const;

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
/** better-auth allows 3 sign-in / 2FA calls per 10 s from one IP. */
const authPause = () => sleep(3_500);

// ── Output ──────────────────────────────────────────────────────────────────

let failures = 0;
function check(ok: boolean, label: string, detail = ''): boolean {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  return ok;
}

/** A step the rest of the run depends on failed: stop and clean up. */
class Stop extends Error {}
function need<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Stop(`cannot continue without ${what}`);
  return value;
}

const section = (title: string) => console.log(`\n— ${title} —`);

// ── HTTP ────────────────────────────────────────────────────────────────────

/** Cookies across calls, as a browser keeps them. */
class Jar {
  private readonly cookies = new Map<string, string>();
  take(headers: Headers): void {
    for (const line of headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      const name = pair.slice(0, at).trim();
      const value = pair.slice(at + 1).trim();
      if (!value || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  get size(): number {
    return this.cookies.size;
  }
}

interface TestUser {
  id: string;
  email: string;
  jar: Jar;
}

interface Reply {
  status: number;
  json: any;
  text: string;
}

async function call(method: string, path: string, user?: TestUser, body?: unknown): Promise<Reply> {
  const headers: Record<string, string> = { origin: ORIGIN };
  if (user?.jar.size) headers.cookie = user.jar.header();
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, { method, headers, body: payload, redirect: 'manual' });
  user?.jar.take(response.headers);
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: response.status, json, text };
}

/** Status and message only: auth replies carry session tokens and TOTP secrets, never printed. */
function brief(res: Reply): string {
  const message = res.json?.message;
  let text: string;
  if (typeof message === 'string') text = message;
  else if (message) text = JSON.stringify(message);
  else if (res.json && typeof res.json === 'object') text = `{ ${Object.keys(res.json as object).join(', ')} }`;
  else text = res.text.slice(0, 120);
  return `HTTP ${res.status} ${text}`.trim();
}

const naira = (value: unknown) =>
  typeof value === 'number' ? `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : String(value);

// ── TOTP (RFC 6238 over RFC 4226, HMAC-SHA1, 6 digits, 30 s) ────────────────

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error(`not base32: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

// ── Users ───────────────────────────────────────────────────────────────────

type Kind = 'ADMIN' | 'SUPER_ADMIN' | 'CUSTOMER';
const created = { users: [] as string[] };
const customerExternalId = `SMK-${TAG.toUpperCase()}`;
const customerName = `Smoke Customer ${TAG}`;

async function makeUser(kind: Kind): Promise<TestUser> {
  const id = kind === 'CUSTOMER' ? `MB-${TAG}` : `AD-${TAG}${kind === 'SUPER_ADMIN' ? 'S' : 'A'}`;
  const email = kind === 'CUSTOMER' ? `delivered+${TAG}@resend.dev` : `${TAG}.${kind.toLowerCase()}@example.com`;
  created.users.push(id);
  await prisma.user.create({
    data: {
      id,
      name: kind === 'CUSTOMER' ? customerName : `Smoke ${kind} ${TAG}`,
      email,
      emailVerified: true,
      status: 'ACTIVE',
      type: kind === 'CUSTOMER' ? 'CUSTOMER' : 'ADMIN',
      accounts: {
        create: { id: `acc-${id}`, accountId: id, providerId: 'credential', password: await hashPassword(PASSWORD) },
      },
      ...(kind === 'CUSTOMER'
        ? { customer: { create: { externalId: customerExternalId } } }
        : { admin: { create: { role: kind } } }),
    },
  });
  return { id, email, jar: new Jar() };
}

async function passwordSignIn(user: TestUser): Promise<Reply> {
  const res = await call('POST', '/api/auth/sign-in/email', user, { email: user.email, password: PASSWORD });
  await authPause();
  return res;
}

/** Turns TOTP on through better-auth (enable with the password → verify a code); returns the secret. */
async function enableTotp(user: TestUser, who: string): Promise<string> {
  const enabled = await call('POST', '/api/auth/two-factor/enable', user, { password: PASSWORD });
  await authPause();
  const uri: string | undefined = enabled.json?.totpURI;
  check(enabled.status === 200 && !!uri, `${who}: POST /api/auth/two-factor/enable returns the totpURI`, brief(enabled));
  const secret = need(uri ? new URL(uri).searchParams.get('secret') : null, 'the TOTP secret');
  const verified = await call('POST', '/api/auth/two-factor/verify-totp', user, { code: totp(secret) });
  await authPause();
  check(verified.status === 200, `${who}: verify-totp with the computed code turns 2FA on`, brief(verified));
  return secret;
}

/** Password sign-in that stops for the second factor, finished with a TOTP code. */
async function signInWithTotp(user: TestUser, secret: string, who: string): Promise<void> {
  const first = await passwordSignIn(user);
  check(
    first.status === 200 && first.json?.twoFactorRedirect === true,
    `${who}: password sign-in asks for the code (twoFactorRedirect)`,
    brief(first),
  );
  const verified = await call('POST', '/api/auth/two-factor/verify-totp', user, { code: totp(secret) });
  await authPause();
  const session = await call('GET', '/user', user);
  check(
    verified.status === 200 && session.status === 200 && session.json?.data?.twoFactorEnabled === true,
    `${who}: verify-totp gives the session`,
    brief(verified),
  );
}

// ── Safety: snapshots ───────────────────────────────────────────────────────

type PeriodSnapshot = Pick<PayrollPeriod, 'id' | 'year' | 'month' | 'variationSubmittedAt' | 'variationFilePath' | 'closedAt'>;

async function periodSnapshot(): Promise<PeriodSnapshot[]> {
  return prisma.payrollPeriod.findMany({
    select: { id: true, year: true, month: true, variationSubmittedAt: true, variationFilePath: true, closedAt: true },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });
}

async function tableCounts(): Promise<Record<string, number>> {
  const tables = await prisma.$queryRaw<{ t: string }[]>`
    SELECT table_name AS t FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations' AND table_name NOT LIKE 'pg\\_%'
    ORDER BY 1`;
  const counts: Record<string, number> = {};
  for (const { t } of tables) {
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${t}"`);
    counts[t] = n;
  }
  return counts;
}

const sameInstant = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

// ── Cleanup ─────────────────────────────────────────────────────────────────

interface Created {
  users: string[];
  payrollPaths: string[];
}

async function cleanup(
  made: Created,
  startedAt: Date,
  periodsBefore: PeriodSnapshot[],
  settingsBefore: Settings | null,
  jars: TestUser[],
): Promise<string[]> {
  const problems: string[] = [];
  const attempt = async (what: string, work: () => Promise<unknown>) => {
    try {
      await work();
    } catch (error) {
      problems.push(`${what}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Sessions also live in Redis (better-auth secondary storage): sign out so they go from there too.
  for (const user of jars) {
    if (user.jar.size) await attempt(`sign out ${user.id}`, () => call('POST', '/api/auth/sign-out', user, {}));
  }

  const ids = made.users;
  const customerIds = ids.filter((id) => id.startsWith('MB-'));
  const loanIds = (await prisma.loan.findMany({ where: { borrowerId: { in: customerIds } }, select: { id: true } })).map(
    (loan) => loan.id,
  );
  const uploads = await prisma.payrollUpload.findMany({ where: { uploadedById: { in: ids } }, select: { id: true } });
  const uploadIds = uploads.map((upload) => upload.id);
  const inflowWhere: Prisma.PaymentInflowWhereInput = {
    OR: [{ customerId: { in: customerIds } }, { uploadId: { in: uploadIds } }],
  };
  const [microLoans, changes, inflows, periodsNow] = await Promise.all([
    prisma.microLoan.findMany({ where: { loanId: { in: loanIds } }, select: { id: true } }),
    prisma.tenureChange.findMany({ where: { loanId: { in: loanIds } }, select: { id: true } }),
    prisma.paymentInflow.findMany({ where: inflowWhere, select: { id: true } }),
    periodSnapshot(),
  ]);
  const entityIds = [
    ...ids,
    ...loanIds,
    ...uploadIds,
    ...[...microLoans, ...changes, ...inflows].map((row) => row.id),
  ];

  await attempt('delete rows', () =>
    prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: entityIds } }] } }),
      prisma.repaymentBreakdown.deleteMany({ where: { repayment: { loanId: { in: loanIds } } } }),
      prisma.repayment.deleteMany({ where: { loanId: { in: loanIds } } }),
      prisma.deduction.deleteMany({ where: { loanId: { in: loanIds } } }),
      prisma.tenureChange.deleteMany({ where: { loanId: { in: loanIds } } }),
      prisma.commodityLoan.deleteMany({ where: { loanId: { in: loanIds } } }),
      prisma.microLoan.deleteMany({ where: { loanId: { in: loanIds } } }),
      prisma.paymentInflow.deleteMany({ where: inflowWhere }),
      prisma.payrollUpload.deleteMany({ where: { id: { in: uploadIds } } }),
      prisma.loan.deleteMany({ where: { id: { in: loanIds } } }),
      prisma.customerPayroll.deleteMany({ where: { externalId: customerExternalId } }),
      // Admin notifications name the smoke customer; other admins may have received some.
      prisma.notification.deleteMany({
        where: {
          OR: [
            { userId: { in: ids } },
            { createdAt: { gte: startedAt }, OR: [{ description: { contains: TAG } }, { title: { contains: TAG } }] },
          ],
        },
      }),
      prisma.verification.deleteMany({
        where: { OR: [{ value: { in: ids } }, ...ids.map((id) => ({ value: { contains: id } })), { identifier: { contains: TAG } }] },
      }),
      prisma.user.deleteMany({ where: { id: { in: ids } } }),
    ]),
  );

  // Stored files: the variation files of months this run submitted, its payroll sheet, the proofs
  // and generated files under its users' folders.
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) problems.push('SUPABASE_URL / SUPABASE_SERVICE_KEY unset: stored files not removed');
  else {
    const storage = createClient(url, key, { auth: { persistSession: false } }).storage;
    const before = new Map(periodsBefore.map((p) => [p.id, p]));
    const variationFiles = periodsNow
      .filter((p) => p.variationFilePath && p.variationFilePath !== before.get(p.id)?.variationFilePath)
      .map((p) => p.variationFilePath as string);
    const removals: [string, string[]][] = [
      [BUCKETS.variations, variationFiles],
      [BUCKETS.payroll, made.payrollPaths],
    ];
    for (const [bucket, prefixes] of [
      [BUCKETS.proofs, customerIds],
      [BUCKETS.exports, ids],
    ] as const) {
      for (const prefix of prefixes) {
        const { data, error } = await storage.from(bucket).list(prefix, { limit: 1000 });
        if (error) problems.push(`list ${bucket}/${prefix}: ${error.message}`);
        removals.push([bucket, (data ?? []).map((file) => `${prefix}/${file.name}`)]);
      }
    }
    for (const [bucket, paths] of removals) {
      if (!paths.length) continue;
      const { error } = await storage.from(bucket).remove(paths);
      if (error) problems.push(`remove from ${bucket}: ${error.message}`);
    }
  }

  // Periods back to the snapshot; the ones this run created go, unless something else now uses them.
  for (const period of periodsBefore) {
    await attempt(`restore ${period.year}-${period.month}`, () =>
      prisma.payrollPeriod.update({
        where: { id: period.id },
        data: {
          variationSubmittedAt: period.variationSubmittedAt,
          variationFilePath: period.variationFilePath,
          closedAt: period.closedAt,
        },
      }),
    );
  }
  const known = new Set(periodsBefore.map((p) => p.id));
  for (const period of periodsNow.filter((p) => !known.has(p.id))) {
    const [deductions, inflowCount, uploadCount] = await Promise.all([
      prisma.deduction.count({ where: { periodId: period.id } }),
      prisma.paymentInflow.count({ where: { periodId: period.id } }),
      prisma.payrollUpload.count({ where: { periodId: period.id } }),
    ]);
    const label = periodLabel(period);
    if (deductions + inflowCount + uploadCount > 0) {
      problems.push(`${label} was created during the run and other customers' rows now use it: left in place`);
      continue;
    }
    await attempt(`delete period ${label}`, () =>
      prisma.$transaction([
        prisma.auditLog.deleteMany({ where: { entityType: 'PAYROLL_PERIOD', entityId: period.id } }),
        prisma.payrollPeriod.delete({ where: { id: period.id } }),
      ]),
    );
  }

  await attempt('restore Settings', async () => {
    if (!settingsBefore) await prisma.settings.deleteMany({ where: { id: 1 } });
    else {
      const { id, updatedAt, ...values } = settingsBefore;
      void updatedAt;
      await prisma.settings.update({ where: { id }, data: values });
    }
  });
  return problems;
}

// ── The run ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startedAt = new Date();
  const made: Created = { users: created.users, payrollPaths: [] };
  const signedIn: TestUser[] = [];

  // Before touching anything: is the API up, and is the database one the smoke may change?
  const ping = await call('GET', '/').catch(() => null);
  if (!ping || ping.status >= 500) {
    console.error(`The API at ${BASE} is not answering. Start it (node dist/main or pnpm start:dev) first.`);
    process.exitCode = 1;
    return;
  }
  const foreignLoans = await prisma.loan.count();
  if (foreignLoans > 0 && !FORCE) {
    console.error(
      `Refusing to run: ${foreignLoans} loan(s) already exist. Submitting and closing a payroll month moves every ` +
        "customer's deductions and charges their penalties, which the cleanup can't undo. Pass --force to run anyway.",
    );
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }
  if (foreignLoans > 0) console.warn(`--force: ${foreignLoans} existing loan(s) will be affected by the month's submit/close.`);

  const periodsBefore = await periodSnapshot();
  const settingsBefore = await prisma.settings.findUnique({ where: { id: 1 } });
  const countsBefore = await tableCounts();
  console.log(`smoke ${TAG} against ${BASE}`);
  console.log(
    `snapshot: ${periodsBefore.length} payroll period(s) ` +
      periodsBefore
        .map((p) => `${periodLabel(p)}${p.variationSubmittedAt ? ' submitted' : ''}${p.closedAt ? ' closed' : ''}`)
        .join(', '),
  );

  let loanId: string | undefined;
  try {
    // ── a. Admin release blockers ──────────────────────────────────────────
    section('a. admin release blockers (V2.MD §0.2)');
    const admin = await makeUser('ADMIN');
    signedIn.push(admin);
    const first = await passwordSignIn(admin);
    check(first.status === 200 && !first.json?.twoFactorRedirect, 'admin without 2FA: password sign-in', brief(first));
    const me = await call('GET', '/user', admin);
    check(
      me.status === 200 && me.json?.data?.role === 'ADMIN' && me.json?.data?.twoFactorEnabled === false,
      'admin without 2FA: GET /user → 200',
      brief(me),
    );
    const gated = await call('GET', '/admin/loans/cash', admin);
    check(
      gated.status === 403 && gated.json?.code === 'TWO_FACTOR_SETUP_REQUIRED',
      'admin without 2FA: GET /admin/loans/cash → 403 TWO_FACTOR_SETUP_REQUIRED',
      brief(gated),
    );
    const adminSecret = await enableTotp(admin, 'admin');
    const open = await call('GET', '/admin/loans/cash', admin);
    check(open.status === 200, 'admin with 2FA: GET /admin/loans/cash → 200', brief(open));
    const out = await call('POST', '/api/auth/sign-out', admin, {});
    const afterOut = await call('GET', '/user', admin);
    check(out.status === 200 && afterOut.status === 401, 'admin signs out (GET /user → 401)', brief(afterOut));
    await signInWithTotp(admin, adminSecret, 'admin');
    const again = await call('GET', '/admin/loans/cash', admin);
    check(again.status === 200, 'admin after the 2FA sign-in: GET /admin/loans/cash → 200', brief(again));
    const magic = await call('POST', '/api/auth/sign-in/magic-link', undefined, { email: admin.email });
    await authPause();
    check(
      magic.status === 403 && /Admins sign in with password and 2FA/.test(String(magic.json?.message ?? '')),
      'admin magic link → 403 "Admins sign in with password and 2FA"',
      brief(magic),
    );
    const code = await call('POST', '/api/auth/email-otp/send-verification-otp', undefined, {
      email: admin.email,
      type: 'sign-in',
    });
    await authPause();
    check(
      code.status === 403 && /Admins sign in with password and 2FA/.test(String(code.json?.message ?? '')),
      'admin email sign-in code → 403 "Admins sign in with password and 2FA"',
      brief(code),
    );

    // ── b. Super admin and customer ────────────────────────────────────────
    section('b. super admin (2FA) and customer');
    // The super admin's 2FA is turned on the real way (enable + verify a TOTP code), like the admin's.
    const superAdmin = await makeUser('SUPER_ADMIN');
    signedIn.push(superAdmin);
    const superFirst = await passwordSignIn(superAdmin);
    check(superFirst.status === 200, 'super admin: password sign-in', brief(superFirst));
    await enableTotp(superAdmin, 'super admin');
    const superMe = await call('GET', '/admin', superAdmin);
    need(check(superMe.status === 200, 'super admin with 2FA: GET /admin → 200', brief(superMe)) || null, 'a super admin');

    const customer = await makeUser('CUSTOMER');
    signedIn.push(customer);
    await prisma.customerPayroll.create({
      data: { externalId: customerExternalId, netPay: '200000', employeeGross: '260000', command: 'Smoke', organization: 'Smoke' },
    });
    const customerIn = await passwordSignIn(customer);
    need(check(customerIn.status === 200, 'customer: password sign-in', brief(customerIn)) || null, 'a customer session');

    // Rates: a loan can't be approved, nor a month closed, until they are set. Set the missing ones
    // and a 12 % net-pay cap (restored at the end).
    const rates: Record<string, number> = { maxDeductionRate: 12 };
    if (!settingsBefore?.interestRate) rates.interestRate = 6;
    if (!settingsBefore?.managementFeeRate) rates.managementFeeRate = 2.5;
    if (!settingsBefore?.penaltyRate) rates.penaltyRate = 10;
    const settings = await call('PATCH', '/admin/rate', superAdmin, rates);
    check(settings.status === 200, `PATCH /admin/rate ${JSON.stringify(rates)}`, brief(settings));

    // ── c. The month ───────────────────────────────────────────────────────
    section('c. loan → payroll month → liquidation → statement');
    const requested = await call('POST', '/user/loan', customer, { amount: 100000, category: 'PERSONAL' });
    loanId = requested.json?.data?.loanId;
    check([200, 201].includes(requested.status) && !!loanId, '1. customer requests a ₦100,000 cash loan', brief(requested));
    need(loanId, 'the loan');

    const approved = await call('PATCH', `/admin/loans/cash/${loanId}/approve`, superAdmin, { tenure: 6 });
    check(approved.status === 200 && approved.json?.data?.status === 'APPROVED', '2. approve (6 months)', brief(approved));
    const disbursed = await call('PATCH', `/admin/loans/cash/${loanId}/disburse`, superAdmin);
    need(
      check(disbursed.status === 200 && disbursed.json?.data?.status === 'DISBURSED', '2. disburse', brief(disbursed)) || null,
      'a disbursed loan',
    );

    const overview = await call('GET', '/user/overview', customer);
    const next = overview.json?.data?.nextDeduction as { amount: number; period: string } | null | undefined;
    check(overview.status === 200 && !!next, 'customer sees the first deduction', next ? `${naira(next.amount)} in ${next.period}` : brief(overview));
    const month: Period = parsePeriodLabel(need(next, 'the first deduction').period);
    const ym = toYm(month);
    const label = periodLabel(month);
    const expected = next!.amount;

    const preview = await call('GET', `/admin/payroll-variations?period=${ym}`, superAdmin);
    const row = (preview.json?.data?.rows ?? []).find((item: any) => item.loanId === loanId);
    check(
      preview.status === 200 && row?.action === 'START' && row?.amount === expected,
      `3. GET /admin/payroll-variations?period=${ym} lists the loan as START`,
      row ? `${row.action} ${naira(row.amount)} × ${row.tenure}, ${row.start} → ${row.end}` : brief(preview),
    );
    const submitted = await call('POST', '/admin/payroll-variations/submit', superAdmin, { period: ym });
    need(
      check(
        submitted.status === 200 && submitted.json?.data?.frozen >= 1,
        `3. submit the ${label} variation`,
        submitted.status === 200 ? `frozen ${submitted.json.data.frozen}, opened ${submitted.json.data.opened}` : brief(submitted),
      ) || null,
      'a submitted variation',
    );
    const fileLink = await call('GET', `/admin/payroll-variations/file?period=${ym}`, superAdmin);
    const fileUrl: string | undefined = fileLink.json?.data?.url;
    let isXlsx = false;
    if (fileUrl) {
      const file = Buffer.from(await (await fetch(fileUrl)).arrayBuffer());
      isXlsx = file.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    }
    check(fileLink.status === 200 && isXlsx, '3. variation file link downloads the .xlsx', brief(fileLink));

    // The payroll return pays less than the deduction on file.
    const paid = 10000;
    const sheet = payrollSheet(month, [
      { staffId: customerExternalId, fullName: customerName, amount: paid, netPay: 200000, employeeGross: 260000 },
    ]);
    made.payrollPaths.push(`${ym}/${createHash('sha256').update(sheet).digest('hex')}.xlsx`);
    const sheetForm = () => {
      const form = new FormData();
      form.set('file', new Blob([new Uint8Array(sheet)], { type: XLSX_MIME }), `payroll-${ym}-${TAG}.xlsx`);
      form.set('period', ym);
      return form;
    };
    const validated = await call('POST', '/admin/repayments/validate', superAdmin, sheetForm());
    check(
      validated.status === 200 && validated.json?.data?.valid === true && validated.json?.data?.period === label,
      `4. POST /admin/repayments/validate (${label}, ${naira(paid)} against ${naira(expected)})`,
      validated.json?.data?.valid ? `${validated.json.data.rows} row` : brief(validated),
    );
    const uploaded = await call('POST', '/admin/repayments/upload', superAdmin, sheetForm());
    const uploadId: string | undefined = uploaded.json?.data?.uploadId;
    need(check(uploaded.status === 201 && !!uploadId, '4. POST /admin/repayments/upload (multipart)', brief(uploaded)) || null, 'an upload');

    let inflow: any = null;
    for (let i = 0; i < 30; i++) {
      const list = await call('GET', `/admin/repayments?uploadId=${uploadId}&limit=50`, superAdmin);
      inflow = (list.json?.data ?? []).find((item: any) => item.customer?.id === customer.id) ?? null;
      if (inflow && inflow.state !== 'AWAITING' && inflow.state !== 'UNMATCHED') break;
      await sleep(1_000);
    }
    check(
      inflow?.state === 'SETTLED' && inflow?.applied === paid,
      '5. the payroll inflow is SETTLED',
      inflow ? `${inflow.state}, applied ${naira(inflow.applied)}` : 'no inflow',
    );

    const closed = await call('POST', '/admin/repayments/close-period', superAdmin, { period: ym });
    const summary = closed.json?.data;
    check(
      closed.status === 200 && summary?.closed === true && summary?.partial >= 1 && summary?.penalties >= 1,
      `6. close ${label}: the short month is charged a penalty`,
      summary ? `partial ${summary.partial}, penalties ${naira(summary.penaltyTotal)}, proposals ${summary.proposals}` : brief(closed),
    );
    const pending = await call('GET', '/admin/tenure-changes?status=PENDING&limit=100', superAdmin);
    const proposal = (pending.json?.data ?? []).find((item: any) => item.loanId === loanId);
    if (proposal) {
      check(
        proposal.reason === 'DEFAULT' && proposal.requestedBy === null,
        '6. the system proposes a tenure change (net-pay cap)',
        `+${proposal.monthsDelta} month(s): monthly ${naira(proposal.currentMonthly)} → ${naira(proposal.proposedMonthly)}, cap ${naira(proposal.cap)}`,
      );
      const decided = await call('POST', `/admin/tenure-changes/${proposal.id}/approve`, superAdmin);
      check(
        decided.status === 200 && decided.json?.data?.status === 'APPROVED',
        '6. approve the proposal',
        decided.status === 200 ? `tenure ${decided.json.data.loanTenure}` : brief(decided),
      );
    } else {
      check(summary?.proposals === 0, '6. no tenure proposal (the monthly stays under the cap)', brief(pending));
    }

    const liquidation = new FormData();
    liquidation.set('amount', '20000');
    liquidation.set('proof', new Blob([PDF], { type: 'application/pdf' }), 'proof.pdf');
    const requestedLiq = await call('POST', '/user/repayments/liquidation', customer, liquidation);
    const liquidationId: string | undefined = requestedLiq.json?.data?.id;
    check(
      requestedLiq.status === 201 && requestedLiq.json?.data?.state === 'AWAITING',
      '7. customer requests a ₦20,000 liquidation with proof (multipart PDF)',
      brief(requestedLiq),
    );
    if (liquidationId) {
      const accepted = await call('PATCH', `/admin/repayments/${liquidationId}/accept-liquidation`, superAdmin);
      check(
        accepted.status === 200 && accepted.json?.data?.state === 'SETTLED' && accepted.json?.data?.applied === 20000,
        '7. super admin approves it',
        accepted.status === 200 ? `outstanding now ${naira(accepted.json.data.outstanding)}` : brief(accepted),
      );
    }

    const statement = await call('POST', '/user/statement', customer, { format: 'pdf' });
    check(statement.status === 202 && !!statement.json?.data?.jobId, '8. POST /user/statement → 202 { jobId }', brief(statement));
    let link: string | undefined;
    for (let i = 0; i < 45 && !link; i++) {
      await sleep(2_000);
      const inbox = await call('GET', '/user/notifications?limit=50', customer);
      link = (inbox.json?.data?.notifications ?? [])
        .map((n: any) => n.callToActionUrl as string | null)
        .find((url: string | null) => !!url && url.includes(`/${BUCKETS.exports}/`));
    }
    let isPdf = false;
    if (link) {
      const file = Buffer.from(await (await fetch(link)).arrayBuffer());
      isPdf = file.subarray(0, 5).toString() === '%PDF-';
    }
    check(!!link && isPdf, '8. the statement arrives as a notification link to a PDF', link ? 'downloaded' : 'no link');

    // ── 9. Balances ──────────────────────────────────────────────────────────
    const figures = await call('GET', `/admin/loans/cash/${loanId}`, superAdmin);
    const f = figures.json?.data;
    const [microLoans, breakdown] = await Promise.all([
      prisma.microLoan.groupBy({ by: ['purpose'], where: { loanId, status: 'DISBURSED' }, _sum: { amount: true } }),
      prisma.repaymentBreakdown.groupBy({ by: ['component'], where: { repayment: { loanId } }, _sum: { amount: true } }),
    ]);
    const booked = (purposes: string[]) =>
      microLoans.filter((m) => purposes.includes(m.purpose)).reduce((s, m) => s.plus(m._sum.amount ?? 0), new Prisma.Decimal(0));
    const collected = (component: string) =>
      new Prisma.Decimal(breakdown.find((b) => b.component === component)?._sum.amount ?? 0);
    const split = {
      principal: [booked(['NEW_LOAN', 'TOPUP']), collected('PRINCIPAL')],
      interest: [booked(['INTEREST']), collected('INTEREST')],
      penalty: [booked(['PENALTY']), collected('PENALTY')],
    } as const;
    console.log(`\n   loan ${loanId}: tenure ${f?.tenure}, ${f?.remainingMonths} month(s) left, monthly ${naira(f?.monthly)}`);
    console.log(`   owed ${naira(f?.owed)}   repaid ${naira(f?.repaid)}   outstanding ${naira(f?.outstanding)}`);
    for (const [name, [b, c]] of Object.entries(split)) {
      console.log(`   ${name.padEnd(9)} booked ${naira(b.toNumber())}   collected ${naira(c.toNumber())}`);
    }
    const bookedTotal = split.principal[0].plus(split.interest[0]).plus(split.penalty[0]);
    const collectedTotal = split.principal[1].plus(split.interest[1]).plus(split.penalty[1]);
    check(
      figures.status === 200 &&
        bookedTotal.toNumber() === f.owed &&
        collectedTotal.toNumber() === f.repaid &&
        Math.abs(f.owed - f.repaid - f.outstanding) < 0.005 &&
        f.repaid === paid + 20000 &&
        f.penaltyBooked > 0,
      '9. balances agree: owed = Σ booked, repaid = Σ collected = payroll + liquidation, outstanding = owed − repaid',
    );
  } catch (error) {
    if (error instanceof Stop) check(false, error.message);
    else check(false, 'unexpected error', error instanceof Error ? (error.stack ?? error.message) : String(error));
  } finally {
    section('d. cleanup');
    const problems = await cleanup(made, startedAt, periodsBefore, settingsBefore, signedIn);
    for (const problem of problems) console.log(`   ${problem}`);
    check(problems.length === 0, 'cleanup ran without errors', `${problems.length} problem(s)`);

    const periodsAfter = await periodSnapshot();
    const periodsEqual =
      periodsAfter.length === periodsBefore.length &&
      periodsBefore.every((before, i) => {
        const after = periodsAfter[i];
        return (
          after.id === before.id &&
          sameInstant(after.variationSubmittedAt, before.variationSubmittedAt) &&
          after.variationFilePath === before.variationFilePath &&
          sameInstant(after.closedAt, before.closedAt)
        );
      });
    check(periodsEqual, 'payroll periods equal the snapshot', `${periodsAfter.length} row(s)`);
    const settingsAfter = await prisma.settings.findUnique({ where: { id: 1 } });
    const rateKeys = ['interestRate', 'managementFeeRate', 'penaltyRate', 'maxDeductionRate', 'inMaintenance'] as const;
    check(
      rateKeys.every((k) => String(settingsAfter?.[k] ?? null) === String(settingsBefore?.[k] ?? null)),
      'Settings restored',
    );
    const countsAfter = await tableCounts();
    const changed = Object.keys({ ...countsBefore, ...countsAfter }).filter(
      (t) => (countsBefore[t] ?? 0) !== (countsAfter[t] ?? 0),
    );
    check(
      changed.length === 0,
      'no leftover rows (every table has its starting row count)',
      changed.map((t) => `${t} ${countsBefore[t] ?? 0} → ${countsAfter[t] ?? 0}`).join(', '),
    );
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
