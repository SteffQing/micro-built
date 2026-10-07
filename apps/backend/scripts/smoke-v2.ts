// v2 end-to-end smoke (V2.MD Stage 7) against a running API: `node dist/main` or `pnpm start:dev`.
// HTTP only: Nest is never booted here. Prisma creates the starting users, reads balances for
// printing and cleans up; everything else goes through the API.
//
//   a. Admin sign-in: an admin without 2FA signs in with a password and admin routes answer; turns on
//      TOTP through better-auth (code computed here, RFC 6238); after signing out, the password sign-in
//      asks for the code.
//   b. A super admin: 403 TWO_FACTOR_SETUP_REQUIRED until 2FA is on; magic links and email codes refused; a gated
//      action answers 403 CONFIRMATION_REQUIRED until confirmed with a code (POST /confirmations/code). And a customer.
//   c. A month for the smoke's own organization (PLAN_V2): loan request → approve → disburse → preview →
//      generate (v1, file link) → top-up → regenerate (v2) → voucher (validate, upload) that underpays →
//      inflow SETTLED, the variation locked, a penalty → revert the voucher (penalty gone) → the voucher
//      again → net-pay cap proposal → approve → generate next month → the revert is now refused, and No
//      payroll is refused before the month ends → liquidation with proof → statement file → balances.
//      Ending a month needs a clock the API can't move: the LEDGER_IT specs (variation.integration.spec.ts,
//      ledger.integration.spec.ts) run No payroll and the month after.
//   d. Everything runs in an organization the smoke creates, so other customers' loans are never touched.
//      Snapshots the Period rows and Settings, and in `finally` deletes everything it created (rows and
//      stored files) and restores both.
//
//   cd apps/backend && pnpm exec tsx scripts/smoke-v2.ts
//   SMOKE_BASE=http://localhost:3003 (default)
//
// Mail only goes to Resend's test inbox (delivered+…@resend.dev) or to @example.com addresses.
// Exit code 0 only when every check passed, cleanup included.
import { nextPeriod, parsePeriodLabel, periodLabel, toYm, type Period } from '@microbuilt/shared';
import { Prisma, PrismaClient, type Period as PeriodRow, type Settings } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { hashPassword } from 'better-auth/crypto';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { payrollSheet, XLSX_MIME } from '../test/fixtures/payroll-sheet';

process.loadEnvFile(resolve(__dirname, '..', '.env'));

const BASE = (process.env.SMOKE_BASE ?? 'http://localhost:3003').replace(/\/$/, '');
const ORIGIN = (process.env.FRONTEND_ORIGINS ?? '').split(',')[0].trim() || BASE;
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

async function call(
  method: string,
  path: string,
  user?: TestUser,
  body?: unknown,
  extra: Record<string, string> = {},
): Promise<Reply> {
  const headers: Record<string, string> = { origin: ORIGIN, ...extra };
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
/** A one-use confirmation for a gated action (@Confirm), as the X-Confirmation header. */
async function confirmed(user: TestUser, secret: string): Promise<Record<string, string>> {
  const res = await call('POST', '/confirmations/code', user, { code: totp(secret) });
  need(check(res.status === 200 && !!res.json?.data?.token, 'confirm with the authenticator code', brief(res)) || null, 'a confirmation');
  return { 'x-confirmation': res.json.data.token as string };
}

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

type PeriodSnapshot = Pick<PeriodRow, 'id' | 'year' | 'month'>;

async function periodSnapshot(): Promise<PeriodSnapshot[]> {
  return prisma.period.findMany({
    select: { id: true, year: true, month: true },
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

// ── Cleanup ─────────────────────────────────────────────────────────────────

interface Created {
  users: string[];
  payrollPaths: string[];
  organizationIds: string[];
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
  const organizationIds = made.organizationIds;
  const variations = await prisma.variation.findMany({
    where: { organizationId: { in: organizationIds } },
    select: { id: true },
  });
  const variationIds = variations.map((variation) => variation.id);
  const vouchers = await prisma.voucher.findMany({
    where: { OR: [{ uploadedById: { in: ids } }, { variationId: { in: variationIds } }] },
    select: { id: true },
  });
  const voucherIds = vouchers.map((voucher) => voucher.id);
  const inflowWhere: Prisma.PaymentInflowWhereInput = {
    OR: [{ customerId: { in: customerIds } }, { voucherId: { in: voucherIds } }],
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
    ...organizationIds,
    ...variationIds,
    ...voucherIds,
    ...[...microLoans, ...changes, ...inflows].map((row) => row.id),
  ];
  // A voucher revert deletes the penalties and cap proposals its settling made, but not their audit rows: find
  // those (since the run started) by the rows they name no longer existing.
  const settledSince = await prisma.auditLog.findMany({
    where: { createdAt: { gte: startedAt }, entityType: { in: ['MICRO_LOAN', 'TENURE_CHANGE'] } },
    select: { entityType: true, entityId: true },
  });
  const [liveLoans, liveChanges] = await Promise.all([
    prisma.microLoan.findMany({ where: { id: { in: settledSince.map((a) => a.entityId) } }, select: { id: true } }),
    prisma.tenureChange.findMany({ where: { id: { in: settledSince.map((a) => a.entityId) } }, select: { id: true } }),
  ]);
  const live = new Set([...liveLoans, ...liveChanges].map((row) => row.id));
  entityIds.push(...settledSince.filter((a) => !live.has(a.entityId)).map((a) => a.entityId));

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
      prisma.voucher.deleteMany({ where: { id: { in: voucherIds } } }),
      prisma.variation.deleteMany({ where: { id: { in: variationIds } } }),
      prisma.loan.deleteMany({ where: { id: { in: loanIds } } }),
      prisma.customerPayroll.deleteMany({ where: { externalId: customerExternalId } }),
      prisma.organization.deleteMany({ where: { id: { in: organizationIds } } }),
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

  // Stored files: its organization's variation files (`<orgId>/<YYYY-MM>/v<n>.xlsx`), its voucher sheet,
  // the proofs and generated files under its users' folders.
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) problems.push('SUPABASE_URL / SUPABASE_SERVICE_KEY unset: stored files not removed');
  else {
    const storage = createClient(url, key, { auth: { persistSession: false } }).storage;
    const variationFiles: string[] = [];
    for (const organizationId of organizationIds) {
      const { data: months, error } = await storage.from(BUCKETS.variations).list(organizationId, { limit: 1000 });
      if (error) problems.push(`list ${BUCKETS.variations}/${organizationId}: ${error.message}`);
      for (const month of months ?? []) {
        const folder = `${organizationId}/${month.name}`;
        const { data: files, error: listed } = await storage.from(BUCKETS.variations).list(folder, { limit: 1000 });
        if (listed) problems.push(`list ${BUCKETS.variations}/${folder}: ${listed.message}`);
        variationFiles.push(...(files ?? []).map((file) => `${folder}/${file.name}`));
      }
    }
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

  // The months this run created go, unless something else now uses them.
  const known = new Set(periodsBefore.map((p) => p.id));
  for (const period of periodsNow.filter((p) => !known.has(p.id))) {
    const [deductions, inflowCount, variationCount] = await Promise.all([
      prisma.deduction.count({ where: { periodId: period.id } }),
      prisma.paymentInflow.count({ where: { periodId: period.id } }),
      prisma.variation.count({ where: { periodId: period.id } }),
    ]);
    const label = periodLabel(period);
    if (deductions + inflowCount + variationCount > 0) {
      problems.push(`${label} was created during the run and other customers' rows now use it: left in place`);
      continue;
    }
    await attempt(`delete period ${label}`, () => prisma.period.delete({ where: { id: period.id } }));
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
  const made: Created = { users: created.users, payrollPaths: [], organizationIds: [] };
  const signedIn: TestUser[] = [];

  // Before touching anything: is the API up, and is the database one the smoke may change?
  const ping = await call('GET', '/').catch(() => null);
  if (!ping || ping.status >= 500) {
    console.error(`The API at ${BASE} is not answering. Start it (node dist/main or pnpm start:dev) first.`);
    process.exitCode = 1;
    return;
  }
  const periodsBefore = await periodSnapshot();
  const settingsBefore = await prisma.settings.findUnique({ where: { id: 1 } });
  const countsBefore = await tableCounts();
  console.log(`smoke ${TAG} against ${BASE}`);
  console.log(`snapshot: ${periodsBefore.length} month(s) ${periodsBefore.map((p) => periodLabel(p)).join(', ')}`);

  let loanId: string | undefined;
  try {
    // ── a. Admin release blockers ──────────────────────────────────────────
    section('a. admin sign-in');
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
    const noFactor = await call('GET', '/admin/loans/cash', admin);
    check(noFactor.status === 200, 'admin without 2FA: GET /admin/loans/cash → 200 (only super admins must have it)', brief(noFactor));
    const adminSecret = await enableTotp(admin, 'admin');
    const open = await call('GET', '/admin/loans/cash', admin);
    check(open.status === 200, 'admin with 2FA: GET /admin/loans/cash → 200', brief(open));
    const out = await call('POST', '/api/auth/sign-out', admin, {});
    const afterOut = await call('GET', '/user', admin);
    check(out.status === 200 && afterOut.status === 401, 'admin signs out (GET /user → 401)', brief(afterOut));
    await signInWithTotp(admin, adminSecret, 'admin');
    const again = await call('GET', '/admin/loans/cash', admin);
    check(again.status === 200, 'admin after the 2FA sign-in: GET /admin/loans/cash → 200', brief(again));
    // ── b. Super admin and customer ────────────────────────────────────────
    section('b. super admin (2FA, confirmations) and customer');
    // The super admin's 2FA is turned on the real way (enable + verify a TOTP code), like the admin's.
    const superAdmin = await makeUser('SUPER_ADMIN');
    signedIn.push(superAdmin);
    const superFirst = await passwordSignIn(superAdmin);
    check(superFirst.status === 200, 'super admin: password sign-in', brief(superFirst));
    const blocked = await call('GET', '/admin', superAdmin);
    check(
      blocked.status === 403 && blocked.json?.code === 'TWO_FACTOR_SETUP_REQUIRED',
      'super admin without 2FA or a passkey: GET /admin → 403 TWO_FACTOR_SETUP_REQUIRED',
      brief(blocked),
    );
    const superSecret = await enableTotp(superAdmin, 'super admin');
    const superMe = await call('GET', '/admin', superAdmin);
    need(check(superMe.status === 200, 'super admin with 2FA: GET /admin → 200', brief(superMe)) || null, 'a super admin');
    // Magic links and email/SMS codes are open to admins and customers, never to a super admin (they skip the second factor).
    const magic = await call('POST', '/api/auth/sign-in/magic-link', undefined, { email: superAdmin.email });
    await authPause();
    check(
      magic.status === 403 && /Super admins sign in with a passkey/.test(String(magic.json?.message ?? '')),
      'super admin magic link → 403 "Super admins sign in with a passkey, or a password and 2FA"',
      brief(magic),
    );
    const code = await call('POST', '/api/auth/email-otp/send-verification-otp', undefined, {
      email: superAdmin.email,
      type: 'sign-in',
    });
    await authPause();
    check(
      code.status === 403 && /Super admins sign in with a passkey/.test(String(code.json?.message ?? '')),
      'super admin email sign-in code → 403',
      brief(code),
    );

    const customer = await makeUser('CUSTOMER');
    signedIn.push(customer);
    // The smoke's own organization: generating, vouchers and penalties only ever reach its customer.
    const organizationName = `Smoke ${TAG}`;
    const organization = await prisma.organization.create({
      data: { name: organizationName, normalizedName: organizationName.toLowerCase() },
    });
    made.organizationIds.push(organization.id);
    await prisma.customerPayroll.create({
      data: {
        externalId: customerExternalId,
        netPay: '200000',
        employeeGross: '260000',
        command: 'Smoke',
        organizationId: organization.id,
      },
    });
    // A loan is approved only with identity and payroll details on file (deleted with the user).
    await prisma.customerIdentity.create({
      data: {
        userId: customer.id,
        dateOfBirth: new Date('1985-05-05'),
        gender: 'Female',
        maritalStatus: 'Single',
        residencyAddress: '1 Smoke Street',
        stateResidency: 'Lagos',
        landmarkOrBusStop: 'Smoke bus stop',
        nextOfKinName: 'Smoke Kin',
        nextOfKinContact: '+2348000000000',
        nextOfKinAddress: '1 Smoke Street',
        nextOfKinRelationship: 'Sibling',
      },
    });
    const customerIn = await passwordSignIn(customer);
    need(check(customerIn.status === 200, 'customer: password sign-in', brief(customerIn)) || null, 'a customer session');

    // Rates: a loan can't be approved, nor a month closed, until they are set. Set the missing ones
    // and a 12 % net-pay cap (restored at the end).
    const rates: Record<string, number> = { maxDeductionRate: 12 };
    if (!settingsBefore?.interestRate) rates.interestRate = 6;
    if (!settingsBefore?.managementFeeRate) rates.managementFeeRate = 2.5;
    if (!settingsBefore?.penaltyRate) rates.penaltyRate = 10;
    const unconfirmed = await call('PATCH', '/admin/rate', superAdmin, rates);
    check(
      unconfirmed.status === 403 && unconfirmed.json?.code === 'CONFIRMATION_REQUIRED',
      'PATCH /admin/rate unconfirmed → 403 CONFIRMATION_REQUIRED',
      brief(unconfirmed),
    );
    await confirmed(superAdmin, superSecret); // opens the ten-minute window for settings
    const settings = await call('PATCH', '/admin/rate', superAdmin, rates);
    check(settings.status === 200, `PATCH /admin/rate ${JSON.stringify(rates)}`, brief(settings));

    // ── c. The month ───────────────────────────────────────────────────────
    section('c. loan → variations → voucher → revert → next month → liquidation → statement');
    const requested = await call('POST', '/user/loan', customer, { amount: 100000, category: 'PERSONAL' });
    loanId = requested.json?.data?.loanId;
    check([200, 201].includes(requested.status) && !!loanId, '1. customer requests a ₦100,000 cash loan', brief(requested));
    need(loanId, 'the loan');

    const approved = await call('PATCH', `/admin/loans/cash/${loanId}/approve`, superAdmin, { tenure: 6 });
    check(approved.status === 200 && approved.json?.data?.status === 'APPROVED', '2. approve (6 months)', brief(approved));
    const disbursed = await call('PATCH', `/admin/loans/cash/${loanId}/disburse`, superAdmin, undefined, await confirmed(superAdmin, superSecret));
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

    const orgQuery = (month: string) => `/admin/variations?organizationId=${organization.id}&period=${month}`;
    const rowOf = (reply: Reply) => (reply.json?.data?.rows ?? []).find((item: any) => item.loanId === loanId);
    /** Generating runs as a job: wait for the variation to reach `version`. */
    const generated = async (month: string, version: number) => {
      const confirmation = await confirmed(superAdmin, superSecret);
      const queued = await call('POST', '/admin/variations/generate', superAdmin, { period: month, organizationIds: [organization.id] }, confirmation);
      const isQueued = queued.status === 202 && (queued.json?.data?.queued ?? []).some((o: any) => o.id === organization.id);
      let state: Reply | null = null;
      for (let i = 0; i < 30 && isQueued; i++) {
        state = await call('GET', orgQuery(month), superAdmin);
        if ((state.json?.data?.variation?.version ?? 0) >= version) break;
        await sleep(1_000);
      }
      return { queued, state, ok: Boolean(isQueued && state?.json?.data?.variation?.version === version) };
    };

    const preview = await call('GET', orgQuery(ym), superAdmin);
    const row = rowOf(preview);
    check(
      preview.status === 200 && row?.action === 'START' && row?.amount === expected && preview.json?.data?.generateBlockedBy === null,
      `3. GET /admin/variations (${organizationName}, ${ym}) lists the loan as START`,
      row ? `${row.action} ${naira(row.amount)} × ${row.tenure}, ${row.start} → ${row.end}` : brief(preview),
    );
    const firstVersion = await generated(ym, 1);
    need(check(firstVersion.ok, `3. generate the ${label} variation (v1)`, brief(firstVersion.state ?? firstVersion.queued)) || null, 'a generated variation');
    const variationId: string = firstVersion.state!.json.data.variation.id;
    const fileLink = await call('GET', `/admin/variations/${variationId}/file`, superAdmin);
    const fileUrl: string | undefined = fileLink.json?.data?.url;
    let isXlsx = false;
    if (fileUrl) {
      const file = Buffer.from(await (await fetch(fileUrl)).arrayBuffer());
      isXlsx = file.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    }
    check(fileLink.status === 200 && isXlsx, '3. the variation file link downloads the .xlsx', brief(fileLink));

    // A top-up after the variation went out: next month's row opens, and regenerating folds it back in.
    const topup = await call('POST', `/admin/customer/${customer.id}/loan-topup`, superAdmin, { kind: 'CASH', cashLoan: { amount: 50000 } });
    const topupId: string | undefined = topup.json?.data?.topupId;
    check([200, 201].includes(topup.status) && !!topupId, '4. request a ₦50,000 top-up', brief(topup));
    if (topupId) {
      const topupApproved = await call('PATCH', `/admin/loans/topups/${topupId}/approve`, superAdmin, {});
      const topupPaid = await call('PATCH', `/admin/loans/topups/${topupId}/disburse`, superAdmin, undefined, await confirmed(superAdmin, superSecret));
      check(topupApproved.status === 200 && topupPaid.status === 200, '4. approve and disburse the top-up', brief(topupPaid));
    }
    const afterTopup = rowOf(await call('GET', orgQuery(ym), superAdmin));
    check(
      afterTopup?.action === 'START' && afterTopup?.amount > expected,
      `4. the ${label} preview folds the top-up in`,
      afterTopup ? `${naira(expected)} → ${naira(afterTopup.amount)}` : 'no row',
    );
    const second = await generated(ym, 2);
    check(
      second.ok && JSON.stringify(second.state?.json?.data?.variation?.versions) === '[1,2]',
      `4. regenerate ${label} (v2; v1 kept until the voucher)`,
      brief(second.state ?? second.queued),
    );
    const owing = afterTopup?.amount ?? expected;

    // The voucher pays less than the deduction on file.
    const paid = 10000;
    const sheet = payrollSheet(month, [
      { staffId: customerExternalId, fullName: customerName, amount: paid, netPay: 200000, employeeGross: 260000 },
    ]);
    made.payrollPaths.push(`${ym}/${createHash('sha256').update(sheet).digest('hex')}.xlsx`);
    const sheetForm = () => {
      const form = new FormData();
      form.set('file', new Blob([new Uint8Array(sheet)], { type: XLSX_MIME }), `voucher-${ym}-${TAG}.xlsx`);
      form.set('organizationId', organization.id);
      form.set('period', ym);
      return form;
    };
    const validated = await call('POST', '/admin/vouchers/validate', superAdmin, sheetForm());
    const report = validated.json?.data;
    check(
      validated.status === 200 &&
        report?.valid === true &&
        report?.variation?.id === variationId &&
        report?.issues?.unmatched === 0 &&
        report?.issues?.otherOrganization === 0 &&
        report?.issues?.notInVariation === 0,
      `5. POST /admin/vouchers/validate (${label}, ${naira(paid)} against ${naira(owing)})`,
      report?.valid ? `${report.rows} row, variation v${report.variation?.version}` : brief(validated),
    );

    const loanFigures = async () => (await call('GET', `/admin/loans/cash/${loanId}`, superAdmin)).json?.data;
    /**
     * Uploads the voucher and waits until its row is settled, the variation locked and settled: the lock comes with
     * the voucher, the short month's penalty (and any cap proposal) only after its last row.
     */
    const voucherIn = async (step: string) => {
      const uploaded = await call('POST', '/admin/vouchers', superAdmin, sheetForm(), await confirmed(superAdmin, superSecret));
      const voucherId: string | undefined = uploaded.json?.data?.voucherId;
      need(check(uploaded.status === 201 && !!voucherId, `${step} POST /admin/vouchers (multipart)`, brief(uploaded)) || null, 'a voucher');
      let inflow: any = null;
      let lock: any = null;
      for (let i = 0; i < 45; i++) {
        const list = await call('GET', `/admin/repayments/inflows?voucherId=${voucherId}&limit=50`, superAdmin);
        inflow = (list.json?.data ?? []).find((item: any) => item.customer?.id === customer.id) ?? null;
        lock = (await call('GET', orgQuery(ym), superAdmin)).json?.data?.variation?.lock ?? null;
        if (inflow?.state === 'SETTLED' && lock && (await loanFigures())?.penaltyBooked > 0) break;
        await sleep(1_000);
      }
      check(
        inflow?.state === 'SETTLED' && inflow?.applied === paid && lock?.kind === 'VOUCHER' && lock?.voucherId === voucherId,
        `${step} the row is SETTLED and the voucher locks ${label}`,
        inflow ? `${inflow.state}, applied ${naira(inflow.applied)}, lock ${lock?.kind ?? 'none'}` : 'no inflow',
      );
      return voucherId as string;
    };

    const firstVoucher = await voucherIn('5.');
    const settled = await loanFigures();
    check(
      settled?.repaid === paid && settled?.penaltyBooked > 0,
      '5. the short month is charged a penalty',
      `repaid ${naira(settled?.repaid)}, penalty ${naira(settled?.penaltyBooked)}`,
    );
    const refile = await call('POST', '/admin/vouchers', superAdmin, sheetForm(), await confirmed(superAdmin, superSecret));
    check(refile.status === 409, `5. a second voucher for ${label} → 409`, brief(refile));

    // Revert: allowed while the month is current and the next one isn't generated.
    const reverted = await call('DELETE', `/admin/vouchers/${firstVoucher}`, superAdmin, { reason: `smoke ${TAG}` }, await confirmed(superAdmin, superSecret));
    const undone = await loanFigures();
    const unlocked = (await call('GET', orgQuery(ym), superAdmin)).json?.data?.variation;
    check(
      reverted.status === 200 &&
        reverted.json?.data?.inflowsRemoved === 1 &&
        reverted.json?.data?.penaltiesRemoved >= 1 &&
        undone?.repaid === 0 &&
        undone?.penaltyBooked === 0 &&
        unlocked?.lock === null,
      '6. revert the voucher: payment and penalty gone, the variation unlocked',
      reverted.status === 200 ? `repaid ${naira(undone?.repaid)}, penalty ${naira(undone?.penaltyBooked)}` : brief(reverted),
    );
    await voucherIn('6. upload it again:');

    // Settling proposes a tenure change when the monthly now breaks the net-pay cap.
    const pending = await call('GET', '/admin/tenure-changes?status=PENDING&limit=100', superAdmin);
    const proposal = (pending.json?.data ?? []).find((item: any) => item.loanId === loanId);
    if (proposal) {
      check(
        proposal.reason === 'DEFAULT' && proposal.requestedBy === null,
        '7. the system proposes a tenure change (net-pay cap)',
        `+${proposal.monthsDelta} month(s): monthly ${naira(proposal.currentMonthly)} → ${naira(proposal.proposedMonthly)}, cap ${naira(proposal.cap)}`,
      );
      const decided = await call('POST', `/admin/tenure-changes/${proposal.id}/approve`, superAdmin);
      check(
        decided.status === 200 && decided.json?.data?.status === 'APPROVED',
        '7. approve the proposal',
        decided.status === 200 ? `tenure ${decided.json.data.loanTenure}` : brief(decided),
      );
    } else {
      check(pending.status === 200, '7. no tenure proposal (the monthly stays under the cap)', brief(pending));
    }

    // The next month, generated before it starts: the revert is now refused, and so is No payroll until it ends.
    const following = nextPeriod(month);
    const followingYm = toYm(following);
    const nextMonth = await generated(followingYm, 1);
    const nextRow = nextMonth.state ? rowOf(nextMonth.state) : undefined;
    check(
      nextMonth.ok && !!nextRow,
      `8. generate ${periodLabel(following)} (the ${label} voucher's outcome rides in it)`,
      nextRow ? `${nextRow.action} ${naira(nextRow.amount)}` : brief(nextMonth.state ?? nextMonth.queued),
    );
    const lockedVoucher = (await call('GET', orgQuery(ym), superAdmin)).json?.data?.variation?.lock?.voucherId;
    const lateRevert = await call('DELETE', `/admin/vouchers/${lockedVoucher}`, superAdmin, { reason: `smoke ${TAG}` }, await confirmed(superAdmin, superSecret));
    check(lateRevert.status === 409, `8. reverting the ${label} voucher → 409 once ${periodLabel(following)} exists`, brief(lateRevert));
    const nextId: string | undefined = nextMonth.state?.json?.data?.variation?.id;
    const early = await call('POST', `/admin/variations/${nextId}/no-payroll`, superAdmin, { reason: `smoke ${TAG}` }, await confirmed(superAdmin, superSecret));
    check(early.status === 409, `8. No payroll for ${periodLabel(following)} before it ends → 409`, brief(early));

    const liquidation = new FormData();
    liquidation.set('amount', '20000');
    liquidation.set('proof', new Blob([PDF], { type: 'application/pdf' }), 'proof.pdf');
    const requestedLiq = await call('POST', '/user/repayments/liquidation', customer, liquidation);
    const liquidationId: string | undefined = requestedLiq.json?.data?.id;
    check(
      requestedLiq.status === 201 && requestedLiq.json?.data?.state === 'AWAITING',
      '9. customer requests a ₦20,000 liquidation with proof (multipart PDF)',
      brief(requestedLiq),
    );
    if (liquidationId) {
      const accepted = await call('PATCH', `/admin/repayments/inflows/${liquidationId}/accept-liquidation`, superAdmin, undefined, await confirmed(superAdmin, superSecret));
      check(
        accepted.status === 200 && accepted.json?.data?.state === 'SETTLED' && accepted.json?.data?.applied === 20000,
        '9. super admin approves it',
        accepted.status === 200 ? `outstanding now ${naira(accepted.json.data.outstanding)}` : brief(accepted),
      );
    }

    const statement = await call('POST', '/user/statement', customer, { format: 'pdf' });
    check(statement.status === 202 && !!statement.json?.data?.jobId, '10. POST /user/statement → 202 { jobId }', brief(statement));
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
    check(!!link && isPdf, '10. the statement arrives as a notification link to a PDF', link ? 'downloaded' : 'no link');

    // ── 11. Balances ──────────────────────────────────────────────────────────
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
      '11. balances agree: owed = Σ booked, repaid = Σ collected = payroll + liquidation, outstanding = owed − repaid',
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
      periodsBefore.every((before, i) => periodsAfter[i].id === before.id);
    check(periodsEqual, 'months equal the snapshot', `${periodsAfter.length} row(s)`);
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
