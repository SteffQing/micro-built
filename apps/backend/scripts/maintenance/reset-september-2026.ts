// One-off (PLAN_V2 Stage A, step 1): clears the SEPTEMBER 2026 payroll test data so per-organization variations start
// fresh. Runs on the schema *before* the PLAN_V2 migration, which refuses to run until this has. In one transaction:
//   - deletes the payroll uploads and their PAYROLL inflows, repayments and breakdowns (liquidations and imports stay);
//   - leaves every running loan with exactly one OPEN deduction, in its disbursement month (PLAN_V2 R1 with nothing
//     frozen), at the formula's amount; every other deduction is deleted;
//   - clears every month's variation submission and close;
//   - puts every payroll record in NPF (the uploads wrote command names over the organization);
//   - deletes the audit rows naming PAYROLL_PERIOD / PAYROLL_UPLOAD and the variation/close/upload actions, whose enum
//     values the migration drops.
// Then it removes the stored upload sheets and variation files.
//
// Before writing anything it saves every row it deletes or changes, and the stored files (base64), as JSON under
// ~/microbuilt-backups/: the way back.
//
// Run from apps/backend (DATABASE_URL / SUPABASE_URL / SUPABASE_SERVICE_KEY from the environment or .env):
//   pnpm exec tsx scripts/maintenance/reset-september-2026.ts           # dry run: prints the plan, writes nothing
//   pnpm exec tsx scripts/maintenance/reset-september-2026.ts --apply   # saves the backup, then applies
import { Prisma, PrismaClient, type AuditAction, type AuditEntityType, type Month } from '@prisma/client';
import { MONTHS, toYm } from '@microbuilt/shared';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { loanBalancesMany } from '../../src/ledger/balances';
import { openExpected } from '../../src/ledger/ledger.math';

const envFile = resolve(__dirname, '..', '..', '.env');
if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);

const prisma = new PrismaClient();

const ORGANIZATION = 'NPF';
const UPLOADS_BUCKET = 'payroll-uploads';
const VARIATIONS_BUCKET = 'variations';
const DROPPED_ENTITY_TYPES: AuditEntityType[] = ['PAYROLL_PERIOD', 'PAYROLL_UPLOAD'];
const DROPPED_ACTIONS: AuditAction[] = ['VARIATION_SUBMITTED', 'VARIATION_REVERTED', 'PERIOD_CLOSED', 'PAYROLL_UPLOADED'];
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

function lagosMonth(date: Date): { year: number; month: Month } {
  const lagos = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return { year: lagos.getUTCFullYear(), month: MONTHS[lagos.getUTCMonth()] as Month };
}

function redactDbUrl(url: string | undefined): string {
  if (!url) return '(unset)';
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

function storage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY unset');
  return createClient(url, key, { auth: { persistSession: false } }).storage;
}

async function listAll(bucket: string, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  const { data, error } = await storage().from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`Listing ${bucket}/${prefix} failed: ${error.message}`);
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) files.push(path);
    else files.push(...(await listAll(bucket, path)));
  }
  return files;
}

async function download(bucket: string, path: string): Promise<string> {
  const { data, error } = await storage().from(bucket).download(path);
  if (error || !data) throw new Error(`Downloading ${bucket}/${path} failed: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer()).toString('base64');
}

async function balancesTable(loanIds: string[]) {
  const balances = await loanBalancesMany(prisma, loanIds);
  return loanIds.map((loanId) => {
    const b = balances.get(loanId);
    return { loanId, owed: b?.owed.toFixed(2), repaid: b?.repaid.toFixed(2), outstanding: b?.outstanding.toFixed(2) };
  });
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  console.log(`Database: ${redactDbUrl(process.env.DATABASE_URL)}${apply ? '' : '  (dry run)'}`);

  const uploads = await prisma.payrollUpload.findMany({ include: { period: true } });
  const payrollInflows = await prisma.paymentInflow.findMany({
    where: { uploadId: { in: uploads.map((u) => u.id) } },
  });
  const inflowIds = payrollInflows.map((i) => i.id);
  const repayments = await prisma.repayment.findMany({ where: { paymentInflowId: { in: inflowIds } } });
  const breakdowns = await prisma.repaymentBreakdown.findMany({
    where: { repaymentId: { in: repayments.map((r) => r.id) } },
  });
  const periods = await prisma.payrollPeriod.findMany({ orderBy: [{ year: 'asc' }, { month: 'asc' }] });
  const loans = await prisma.loan.findMany({
    select: { id: true, status: true, disbursementDate: true },
    orderBy: { id: 'asc' },
  });
  const deductions = await prisma.deduction.findMany({ include: { period: true }, orderBy: { loanId: 'asc' } });
  const payrolls = await prisma.customerPayroll.findMany();
  const auditRows = await prisma.auditLog.findMany({
    where: { OR: [{ entityType: { in: DROPPED_ENTITY_TYPES } }, { action: { in: DROPPED_ACTIONS } }] },
  });

  // Each running loan keeps one OPEN deduction, in its disbursement month: the row already in that month if there is
  // one (it is reopened), else a new one. Every other deduction goes.
  const periodOf = new Map(periods.map((p) => [`${p.year}-${p.month}`, p]));
  const plan = loans
    .filter((loan) => loan.status === 'DISBURSED')
    .map((loan) => {
      if (!loan.disbursementDate) throw new Error(`Loan ${loan.id} is DISBURSED without a disbursement date`);
      const target = lagosMonth(loan.disbursementDate);
      const own = deductions.filter((d) => d.loanId === loan.id);
      const keep = own.find((d) => d.period.year === target.year && d.period.month === target.month) ?? null;
      return {
        loanId: loan.id,
        target,
        keep,
        drop: own.filter((d) => d !== keep),
      };
    });
  const closedLoanDeductions = deductions.filter((d) => !plan.some((p) => p.loanId === d.loanId));
  if (closedLoanDeductions.length) {
    throw new Error(`Deductions on loans that aren't DISBURSED: ${closedLoanDeductions.map((d) => d.id).join(', ')}`);
  }

  console.log(`\nUploads to delete: ${uploads.map((u) => `${u.filename} (${toYm(u.period)})`).join(', ') || 'none'}`);
  console.log(`  PAYROLL inflows / repayments / breakdowns: ${payrollInflows.length} / ${repayments.length} / ${breakdowns.length}`);
  console.log('\nDeductions, per loan (target = disbursement month):');
  for (const p of plan) {
    const dropped = p.drop.map((d) => `${d.period.month} ${d.status} ${d.expected.toFixed(2)}`).join(', ') || '-';
    const kept = p.keep ? `reopen ${p.keep.period.month} (${p.keep.status})` : `create ${p.target.month} ${p.target.year}`;
    console.log(`  ${p.loanId}: ${kept}; delete ${dropped}`);
  }
  const submitted = periods.filter((p) => p.variationSubmittedAt || p.closedAt || p.variationFilePath);
  console.log(`\nMonths to clear (submission/close): ${submitted.map((p) => toYm(p)).join(', ') || 'none'}`);
  const notNpf = payrolls.filter((p) => p.organization !== ORGANIZATION);
  console.log(`Payroll records to set to ${ORGANIZATION}: ${notNpf.length} (${[...new Set(notNpf.map((p) => p.organization))].join(', ')})`);
  console.log(`Audit rows to delete: ${auditRows.length}`);

  const uploadFiles = await listAll(UPLOADS_BUCKET);
  const variationFiles = await listAll(VARIATIONS_BUCKET);
  console.log(`Stored files to delete: ${UPLOADS_BUCKET} ${uploadFiles.length}, ${VARIATIONS_BUCKET} ${variationFiles.length}`);

  const loanIds = plan.map((p) => p.loanId);
  const before = await balancesTable(loanIds);
  console.log('\nBalances before:');
  console.table(before);

  if (!apply) {
    console.log('\nDry run: nothing written. Pass --apply to save the backup and apply.');
    return;
  }

  const dir = join(homedir(), 'microbuilt-backups');
  mkdirSync(dir, { recursive: true });
  const backupPath = join(dir, `reset-september-2026-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const files: Record<string, string> = {};
  for (const path of uploadFiles) files[`${UPLOADS_BUCKET}/${path}`] = await download(UPLOADS_BUCKET, path);
  for (const path of variationFiles) files[`${VARIATIONS_BUCKET}/${path}`] = await download(VARIATIONS_BUCKET, path);
  writeFileSync(
    backupPath,
    JSON.stringify(
      { database: redactDbUrl(process.env.DATABASE_URL), uploads, payrollInflows, repayments, breakdowns, periods, deductions, payrolls, auditRows, files, before },
      null,
      2,
    ),
  );
  console.log(`\nBackup written: ${backupPath}`);

  await prisma.$transaction(
    async (tx) => {
      await tx.repaymentBreakdown.deleteMany({ where: { id: { in: breakdowns.map((b) => b.id) } } });
      await tx.repayment.deleteMany({ where: { id: { in: repayments.map((r) => r.id) } } });
      await tx.paymentInflow.deleteMany({ where: { id: { in: inflowIds } } });
      await tx.payrollUpload.deleteMany({ where: { id: { in: uploads.map((u) => u.id) } } });

      // Deletes first: one OPEN per loan (Deduction_one_open_per_loan) holds at every step.
      await tx.deduction.deleteMany({ where: { id: { in: plan.flatMap((p) => p.drop.map((d) => d.id)) } } });
      for (const p of plan) {
        if (p.keep) {
          await tx.deduction.update({
            where: { id: p.keep.id },
            data: { status: 'OPEN', settledAt: null, penalizedAt: null },
          });
          continue;
        }
        const key = `${p.target.year}-${p.target.month}`;
        const period =
          periodOf.get(key) ??
          (await tx.payrollPeriod.create({ data: { year: p.target.year, month: p.target.month } }));
        periodOf.set(key, period);
        await tx.deduction.create({ data: { loanId: p.loanId, periodId: period.id, expected: 0 } });
      }
      const balances = await loanBalancesMany(tx, loanIds);
      for (const p of plan) {
        const b = balances.get(p.loanId);
        if (!b) throw new Error(`No balances for ${p.loanId}`);
        await tx.deduction.updateMany({
          where: { loanId: p.loanId, status: 'OPEN' },
          data: { expected: openExpected(b.outstanding, b.committed, b.remainingMonths, b.lastSent) },
        });
      }

      await tx.payrollPeriod.updateMany({
        data: { variationSubmittedAt: null, variationFilePath: null, closedAt: null },
      });
      await tx.customerPayroll.updateMany({ data: { organization: ORGANIZATION } });
      await tx.auditLog.deleteMany({ where: { id: { in: auditRows.map((a) => a.id) } } });
    },
    { timeout: 60_000 },
  );

  for (const [bucket, paths] of [
    [UPLOADS_BUCKET, uploadFiles],
    [VARIATIONS_BUCKET, variationFiles],
  ] as const) {
    if (!paths.length) continue;
    const { error } = await storage().from(bucket).remove([...paths]);
    if (error) throw new Error(`Removing files from ${bucket} failed: ${error.message} (the database part is done)`);
  }

  const after = await balancesTable(loanIds);
  console.log('\nBalances after:');
  console.table(after);
  const removed = new Map<string, Prisma.Decimal>();
  for (const r of repayments) removed.set(r.loanId, (removed.get(r.loanId) ?? new Prisma.Decimal(0)).plus(r.amount));
  const problems = before.flatMap((b, i) => {
    const a = after[i];
    const expectedRepaid = new Prisma.Decimal(b.repaid ?? 0).minus(removed.get(b.loanId) ?? 0);
    const out: string[] = [];
    if (a.owed !== b.owed) out.push(`${b.loanId}: owed moved ${b.owed} → ${a.owed}`);
    if (!expectedRepaid.equals(a.repaid ?? 0)) out.push(`${b.loanId}: repaid ${a.repaid}, expected ${expectedRepaid.toFixed(2)}`);
    return out;
  });
  const openCounts = await prisma.deduction.groupBy({ by: ['loanId'], where: { status: 'OPEN' }, _count: true });
  const others = await prisma.deduction.count({ where: { status: { not: 'OPEN' } } });
  if (openCounts.length !== loanIds.length || openCounts.some((c) => c._count !== 1)) problems.push('not one OPEN per loan');
  if (others) problems.push(`${others} non-OPEN deductions left`);
  console.log(problems.length ? `\nCHECK FAILED:\n  ${problems.join('\n  ')}` : '\nCheck: owed unchanged, repaid down by exactly the deleted repayments, one OPEN deduction per loan.');
  if (problems.length) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
