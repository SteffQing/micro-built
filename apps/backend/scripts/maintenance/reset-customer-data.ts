// Nukes every CUSTOMER account and all ledger data (v2 models), so a database can start again with
// only its admins and settings. Deletes, in one transaction:
//   - CUSTOMER users and everything hanging off them (Customer, identity, payment method, payroll,
//     better-auth sessions/accounts/2FA/passkeys, notifications, verification rows naming them);
//   - every Loan with its MicroLoans, CommodityLoans, TenureChanges, Deductions, Repayments and
//     RepaymentBreakdowns;
//   - every PaymentInflow (also UNMATCHED payroll rows that never found a customer), PayrollUpload and
//     PayrollPeriod. The uploads' file hashes and the periods' variationSubmittedAt / closedAt are the
//     ledger's idempotency markers (v1: LAST_REPAYMENT_DATE): left behind, the next payroll upload
//     would be refused as "already uploaded" or its month as submitted/closed;
//   - AuditLog rows about those entities (loans, microloans, tenure changes, inflows, periods,
//     uploads, commodity requests, customer users).
// and removes the stored files: everything in the private `payroll-uploads`, `variations` and
// `liquidation-proofs` buckets, and each customer's folder in `exports`.
//
// Never touches: ADMIN users (any role, including the SYSTEM admin) and their audit entries about
// admins, Settings (rates, cap, maintenance flag), Commodity rows. There are no balance counters in
// v2: every figure is computed from the ledger rows, so there is nothing to zero.
//
// Irreversible. No soft-delete, no audit trail. Take a DB snapshot/backup before running.
// Recommended: turn maintenance mode on (PATCH /admin/maintenance) and confirm the `repayments` and
// `reports` Bull queues are idle, so nothing writes ledger rows or files while this runs.
//
// Run from apps/backend. DATABASE_URL / SUPABASE_URL / SUPABASE_SERVICE_KEY come from the
// environment, or from apps/backend/.env when DATABASE_URL isn't set:
//   pnpm exec tsx scripts/maintenance/reset-customer-data.ts                     # dry run, no writes
//   pnpm exec tsx scripts/maintenance/reset-customer-data.ts --yes-nuke          # executes, asks you to type NUKE
//   pnpm exec tsx scripts/maintenance/reset-customer-data.ts --yes-nuke --force  # executes, skips the prompt
//                                                    # (disposable/non-interactive envs only — never prod)
import { PrismaClient, type AuditEntityType } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

const envFile = resolve(__dirname, '..', '..', '.env');
if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);

const prisma = new PrismaClient();

/** Audit entries about ledger entities: all of them go with the ledger. */
const LEDGER_ENTITY_TYPES: AuditEntityType[] = [
  'LOAN',
  'MICRO_LOAN',
  'TENURE_CHANGE',
  'PAYMENT_INFLOW',
  'PAYROLL_PERIOD',
  'PAYROLL_UPLOAD',
  'COMMODITY_LOAN',
];
/** Emptied completely. */
const LEDGER_BUCKETS = ['payroll-uploads', 'variations', 'liquidation-proofs'] as const;
/** Generated files live under `<userId>/`; only customers' folders go. */
const EXPORTS_BUCKET = 'exports';
const CHUNK = 500;

function redactDbUrl(url: string | undefined): string {
  if (!url) return '(unset)';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface Report {
  customers: number;
  customerPayroll: number;
  customerIdentity: number;
  customerPaymentMethod: number;
  loans: number;
  microLoans: number;
  commodityLoans: number;
  tenureChanges: number;
  deductions: number;
  repayments: number;
  repaymentBreakdowns: number;
  paymentInflows: number;
  payrollUploads: number;
  payrollPeriods: number;
  ledgerAuditLogs: number;
  customerNotifications: number;
  adminUsers: number;
  commodities: number;
  settings: string;
}

async function gatherReport(customerIds: string[]): Promise<Report> {
  const [
    customers,
    customerPayroll,
    customerIdentity,
    customerPaymentMethod,
    loans,
    microLoans,
    commodityLoans,
    tenureChanges,
    deductions,
    repayments,
    repaymentBreakdowns,
    paymentInflows,
    payrollUploads,
    payrollPeriods,
    ledgerAuditLogs,
    customerNotifications,
    adminUsers,
    commodities,
    settings,
  ] = await Promise.all([
    prisma.user.count({ where: { type: 'CUSTOMER' } }),
    prisma.customerPayroll.count(),
    prisma.customerIdentity.count(),
    prisma.customerPaymentMethod.count(),
    prisma.loan.count(),
    prisma.microLoan.count(),
    prisma.commodityLoan.count(),
    prisma.tenureChange.count(),
    prisma.deduction.count(),
    prisma.repayment.count(),
    prisma.repaymentBreakdown.count(),
    prisma.paymentInflow.count(),
    prisma.payrollUpload.count(),
    prisma.payrollPeriod.count(),
    prisma.auditLog.count({
      where: {
        OR: [{ entityType: { in: LEDGER_ENTITY_TYPES } }, { entityType: 'USER', entityId: { in: customerIds } }],
      },
    }),
    prisma.notification.count({ where: { user: { type: 'CUSTOMER' } } }),
    prisma.user.count({ where: { type: 'ADMIN' } }),
    prisma.commodity.count(),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);
  const settingsText = settings
    ? JSON.stringify({
        interestRate: settings.interestRate,
        managementFeeRate: settings.managementFeeRate,
        penaltyRate: settings.penaltyRate,
        maxDeductionRate: settings.maxDeductionRate,
        inMaintenance: settings.inMaintenance,
      })
    : '(no Settings row)';
  return {
    customers,
    customerPayroll,
    customerIdentity,
    customerPaymentMethod,
    loans,
    microLoans,
    commodityLoans,
    tenureChanges,
    deductions,
    repayments,
    repaymentBreakdowns,
    paymentInflows,
    payrollUploads,
    payrollPeriods,
    ledgerAuditLogs,
    customerNotifications,
    adminUsers,
    commodities,
    settings: settingsText,
  };
}

function printReport(label: string, report: Report): void {
  console.log(`\n--- ${label} ---`);
  console.log('CUSTOMER users:', report.customers);
  console.log('  payroll / identity / payment method:', report.customerPayroll, '/', report.customerIdentity, '/', report.customerPaymentMethod);
  console.log('  notifications:', report.customerNotifications);
  console.log('Loans:', report.loans);
  console.log('  MicroLoans:', report.microLoans);
  console.log('  CommodityLoans:', report.commodityLoans);
  console.log('  TenureChanges:', report.tenureChanges);
  console.log('  Deductions:', report.deductions);
  console.log('  Repayments / breakdown rows:', report.repayments, '/', report.repaymentBreakdowns);
  console.log('PaymentInflows (payroll rows + liquidations, matched or not):', report.paymentInflows);
  console.log('PayrollUploads:', report.payrollUploads);
  console.log('PayrollPeriods:', report.payrollPeriods);
  console.log('AuditLog rows about ledger entities and customers:', report.ledgerAuditLogs);
  console.log('Kept (must be unchanged after):');
  console.log('  ADMIN users (all roles, incl. SYSTEM):', report.adminUsers);
  console.log('  Commodities:', report.commodities);
  console.log('  Settings:', report.settings);
}

async function storagePlan(customerIds: string[]): Promise<{ bucket: string; paths: string[] }[] | string> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return 'SUPABASE_URL / SUPABASE_SERVICE_KEY unset: stored files will not be removed';
  const storage = createClient(url, key, { auth: { persistSession: false } }).storage;

  // Lists a folder recursively (Supabase lists one level; folders come back without an id).
  const walk = async (bucket: string, prefix: string): Promise<string[]> => {
    const files: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.from(bucket).list(prefix, { limit: 1000, offset });
      if (error) {
        if (/not found/i.test(error.message)) return files;
        throw new Error(`Listing ${bucket}/${prefix} failed: ${error.message}`);
      }
      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) files.push(path);
        else files.push(...(await walk(bucket, path)));
      }
      if (!data || data.length < 1000) return files;
    }
  };

  const plan: { bucket: string; paths: string[] }[] = [];
  for (const bucket of LEDGER_BUCKETS) plan.push({ bucket, paths: await walk(bucket, '') });
  const exportsPaths: string[] = [];
  for (const id of customerIds) exportsPaths.push(...(await walk(EXPORTS_BUCKET, id)));
  plan.push({ bucket: EXPORTS_BUCKET, paths: exportsPaths });
  return plan;
}

async function removeFiles(plan: { bucket: string; paths: string[] }[]): Promise<void> {
  const storage = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_KEY as string, {
    auth: { persistSession: false },
  }).storage;
  for (const { bucket, paths } of plan) {
    for (const batch of chunks(paths, 100)) {
      const { error } = await storage.from(bucket).remove(batch);
      if (error) throw new Error(`Removing files from ${bucket} failed: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const execute = args.includes('--yes-nuke');
  const force = args.includes('--force');

  const customers = await prisma.user.findMany({
    where: { type: 'CUSTOMER' },
    select: { id: true, email: true, phoneNumber: true },
  });
  const customerIds = customers.map((c) => c.id);

  // Pre-flight guards: account types must be consistent before anything is deleted by type.
  const [adminRowsOnCustomers, customerRowsOnAdmins] = await Promise.all([
    prisma.admin.count({ where: { user: { type: 'CUSTOMER' } } }),
    prisma.customer.count({ where: { user: { type: 'ADMIN' } } }),
  ]);
  if (adminRowsOnCustomers > 0 || customerRowsOnAdmins > 0) {
    throw new Error(
      `${adminRowsOnCustomers} CUSTOMER user(s) have an Admin row and ${customerRowsOnAdmins} ADMIN user(s) have a ` +
        'Customer row — investigate before nuking.',
    );
  }

  const before = await gatherReport(customerIds);
  printReport('BEFORE', before);
  const plan = await storagePlan(customerIds);
  if (typeof plan === 'string') console.log(`\nStored files: ${plan}`);
  else {
    console.log('\nStored files to remove:');
    for (const { bucket, paths } of plan) console.log(`  ${bucket}: ${paths.length}`);
  }

  if (!execute) {
    console.log('\nDry run only — no writes made. Pass --yes-nuke to execute.');
    return;
  }

  console.log(`\nTarget database: ${redactDbUrl(process.env.DATABASE_URL)}`);
  console.log(`Target storage: ${process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : '(unset)'}`);

  if (!force) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('\nType NUKE to permanently delete the data above: ');
    rl.close();
    if (answer !== 'NUKE') {
      console.log('Confirmation did not match "NUKE". Aborting — no writes made.');
      return;
    }
  }

  console.log('\nDeleting...');
  // Verification rows (email/SMS codes, magic links, 2FA sign-ins) naming a customer.
  const identifiers = customers.flatMap((c) => [c.email, c.phoneNumber].filter((v): v is string => !!v));
  await prisma.$transaction([
    prisma.auditLog.deleteMany({
      where: {
        OR: [{ entityType: { in: LEDGER_ENTITY_TYPES } }, { entityType: 'USER', entityId: { in: customerIds } }],
      },
    }),
    prisma.repaymentBreakdown.deleteMany({}),
    prisma.repayment.deleteMany({}),
    prisma.deduction.deleteMany({}),
    prisma.tenureChange.deleteMany({}),
    prisma.commodityLoan.deleteMany({}),
    prisma.microLoan.deleteMany({}),
    prisma.paymentInflow.deleteMany({}),
    prisma.payrollUpload.deleteMany({}),
    prisma.loan.deleteMany({}),
    prisma.payrollPeriod.deleteMany({}),
    ...chunks(identifiers).map((batch) =>
      prisma.verification.deleteMany({
        where: { OR: batch.map((value) => ({ identifier: { contains: value } })) },
      }),
    ),
    ...chunks(customerIds).map((batch) => prisma.verification.deleteMany({ where: { value: { in: batch } } })),
    // Cascades: Customer (identity, payment method, payroll), notifications, sessions, accounts,
    // two-factor, passkeys.
    prisma.user.deleteMany({ where: { type: 'CUSTOMER' } }),
  ]);

  if (typeof plan !== 'string') {
    console.log('Removing stored files...');
    await removeFiles(plan);
  }

  const after = await gatherReport(customerIds);
  printReport('AFTER', after);

  console.log('\nADMIN users unchanged:', after.adminUsers === before.adminUsers);
  console.log('Commodities unchanged:', after.commodities === before.commodities);
  console.log('Settings unchanged:', after.settings === before.settings);
  console.log(
    'Customer sessions are gone from the database. Copies better-auth cached in Redis expire on their own ' +
      '(at most 7 days); until then the API answers them 401, because AccessGuard reads the user from the database.',
  );
  console.log('\nDone.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
