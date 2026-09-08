// Deletes payroll variation batches (and their instruction rows) so a month can
// be prepared again from scratch.
//
// Why this is needed: a SENT batch is what the system diffs against. While one
// exists for a period, re-previewing that period reports every customer as
// "unchanged" and produces an empty file — there is no way to regenerate the
// same instructions through the UI.
//
// Leaves alone by design:
//   - PayrollSchedule / RepaymentInstallment, unless --unfreeze names that
//     period. Otherwise the internal monthly snapshot stays PUBLISHED, the
//     month remains frozen, and a re-prepared official variation reuses the
//     exact same figures (reuseOfficial).
//   - PayrollVariationState (the submission baseline) unless --reset-baseline
//     is passed. Re-initializing is a one-time action with no undo in the app.
//   - Files already uploaded to Supabase. Deleting a batch orphans its
//     artifact; remove it from storage by hand if it matters.
//
// --unfreeze "MONTH YYYY" reopens a frozen month: its published schedules go
// to CANCELLED with officialPeriod cleared, and instalments still merely
// PUBLISHED go back to PLANNED (PARTIAL/PAID/MISSED are never rewound). That
// makes firstOpenPeriod() treat the month as open again.
//
//   IMPORTANT — what unfreezing does NOT do: a plan that was already rebuilt
//   while the month was frozen (a liquidation, top-up or tenure change) chose
//   its effective month at the time it was applied and keeps it. Reopening the
//   month afterwards does not pull that plan backwards. Unfreeze first, then
//   apply the change, if you need it to land in that month.
//
// Irreversible. A batch marked SENT is the audit record of a payroll
// submission — only delete one you are certain was never acted on. Take a DB
// snapshot first.
//
// Run (needs DATABASE_URL in env — PrismaClient does not auto-load .env):
//   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d "'\"")"
//   node prisma/maintenance/reset-payroll-variations.js                      # dry run, no writes
//   node prisma/maintenance/reset-payroll-variations.js --batch VAR-XXXX     # scope to one batch
//   node prisma/maintenance/reset-payroll-variations.js --yes-reset          # executes, asks you to type RESET
//   node prisma/maintenance/reset-payroll-variations.js --yes-reset --force  # executes, skips the prompt
//   node prisma/maintenance/reset-payroll-variations.js --yes-reset --reset-baseline
//   node prisma/maintenance/reset-payroll-variations.js --unfreeze "SEPTEMBER 2026" --unfreeze-only --yes-reset
const readline = require('readline');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function redactDbUrl(url) {
  if (!url) return '(unset)';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

function promptForConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function periodLabel(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  })
    .format(date)
    .toUpperCase();
}

// Mirrors canonicalPeriod() in src/obligations/repayment-plan.logic.ts: the
// first instant of the month in Africa/Lagos, stored as UTC.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
function canonicalPeriod(value) {
  const lagos = new Date(value.getTime() + LAGOS_OFFSET_MS);
  return new Date(
    Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1) - LAGOS_OFFSET_MS,
  );
}
function parsePeriod(text) {
  const [monthStr, yearStr] = text.trim().split(' ');
  const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
  const year = parseInt(yearStr, 10);
  if (isNaN(monthIndex) || isNaN(year)) {
    throw new Error(`Invalid period format: "${text}". Expected "MONTH YYYY".`);
  }
  return canonicalPeriod(new Date(Date.UTC(year, monthIndex, 1)));
}

(async () => {
  const args = process.argv.slice(2);
  const execute = args.includes('--yes-reset');
  const force = args.includes('--force');
  const resetBaseline = args.includes('--reset-baseline');
  const batchFlag = args.indexOf('--batch');
  const batchId = batchFlag === -1 ? null : args[batchFlag + 1];
  if (batchFlag !== -1 && !batchId) {
    throw new Error('--batch requires a batch id, e.g. --batch VAR-HY8RL8WZQ8');
  }
  const unfreezeFlag = args.indexOf('--unfreeze');
  const unfreezeText = unfreezeFlag === -1 ? null : args[unfreezeFlag + 1];
  if (unfreezeFlag !== -1 && (!unfreezeText || unfreezeText.startsWith('--'))) {
    throw new Error(
      '--unfreeze requires a period, e.g. --unfreeze "SEPTEMBER 2026"',
    );
  }
  const unfreezePeriod = unfreezeText ? parsePeriod(unfreezeText) : null;
  // Unfreezing is independent of clearing history: --unfreeze on its own only
  // reopens the month.
  const onlyUnfreeze =
    unfreezePeriod && batchFlag === -1 && args.includes('--unfreeze-only');

  let frozenSchedules = [];
  let installmentsToReopen = 0;
  if (unfreezePeriod) {
    frozenSchedules = await prisma.payrollSchedule.findMany({
      where: {
        period: unfreezePeriod,
        OR: [
          { officialPeriod: { not: null } },
          { status: { in: ['PUBLISHED', 'ACKNOWLEDGED', 'CLOSED'] } },
        ],
      },
      include: { rows: { select: { installmentId: true } } },
    });
    const installmentIds = frozenSchedules.flatMap((s) =>
      s.rows.map((r) => r.installmentId),
    );
    // Only reopen instalments still merely PUBLISHED. PARTIAL/PAID/MISSED carry
    // real payment activity and must never be rewound.
    installmentsToReopen = installmentIds.length
      ? await prisma.repaymentInstallment.count({
          where: { id: { in: installmentIds }, status: 'PUBLISHED' },
        })
      : 0;

    console.log(`\nUnfreeze ${periodLabel(unfreezePeriod)}:`);
    if (frozenSchedules.length === 0) {
      console.log('  Already open — no published schedule for this period.');
    } else {
      for (const schedule of frozenSchedules) {
        console.log(
          `  ${schedule.id}  v${schedule.version}  ${schedule.status}  ${schedule.rows.length} rows  -> CANCELLED, officialPeriod cleared`,
        );
      }
      console.log(
        `  instalments to reopen (PUBLISHED -> PLANNED): ${installmentsToReopen}`,
      );
      console.log(
        '  Note: this reopens the month for FUTURE changes. Plans already rebuilt\n' +
          '  against a later month keep that effective date — see the script header.',
      );
    }
  }

  const where = batchId ? { id: batchId } : {};
  const batches = onlyUnfreeze
    ? []
    : await prisma.payrollVariationBatch.findMany({
        where,
        orderBy: [{ period: 'desc' }, { version: 'desc' }],
        include: { _count: { select: { rows: true } } },
      });

  if (batches.length === 0 && !unfreezePeriod) {
    console.log(
      batchId
        ? `No variation batch found with id ${batchId}. Nothing to do.`
        : 'No variation batches found. Nothing to do.',
    );
    await prisma.$disconnect();
    return;
  }

  if (batches.length) {
    console.log(`\nVariation batches to delete (${batches.length}):`);
    for (const batch of batches) {
      console.log(
        `  ${batch.id}  ${periodLabel(batch.period)}  v${batch.version}  ${batch.kind}/${batch.status}  ` +
          `${batch._count.rows} rows  internalSchedule=${batch.internalScheduleId ?? '-'}`,
      );
      if (batch.artifactUrl)
        console.log(`      orphans artifact: ${batch.artifactUrl}`);
    }
  }

  const state = await prisma.payrollVariationState.findUnique({
    where: { id: 'FG' },
  });
  if (resetBaseline) {
    console.log(
      state
        ? `\nBaseline to delete: initialized ${state.initializedAt.toISOString()} by ${state.initializedBy}, reference "${state.reference}"`
        : '\nBaseline: none recorded (nothing to reset).',
    );
    console.log(
      '  After this you must re-run "Confirm the last submitted schedule" in the UI before any variation can be previewed.',
    );
  } else if (state) {
    console.log(
      `\nBaseline kept (reference "${state.reference}"). Pass --reset-baseline to clear it too.`,
    );
  }

  // Snapshots not covered by --unfreeze stay published, so those months stay
  // frozen and a re-prepared official variation reuses their exact figures.
  const untouchedIds = batches
    .map((b) => b.internalScheduleId)
    .filter(Boolean)
    .filter((id) => !frozenSchedules.some((s) => s.id === id));
  const frozen = untouchedIds.length
    ? await prisma.payrollSchedule.findMany({
        where: { id: { in: untouchedIds } },
        select: {
          id: true,
          period: true,
          version: true,
          status: true,
          rowCount: true,
        },
      })
    : [];
  if (frozen.length) {
    console.log(
      '\nLeft untouched (month stays frozen, figures reused on re-prepare):',
    );
    for (const schedule of frozen) {
      console.log(
        `  ${schedule.id}  ${periodLabel(schedule.period)}  v${schedule.version}  ${schedule.status}  ${schedule.rowCount} rows`,
      );
    }
  }

  if (!execute) {
    console.log(
      '\nDry run only — no writes made. Pass --yes-reset to execute.',
    );
    await prisma.$disconnect();
    return;
  }

  console.log(`\nTarget database: ${redactDbUrl(process.env.DATABASE_URL)}`);

  if (!force) {
    const answer = await promptForConfirmation(
      '\nType RESET to permanently apply the changes above: ',
    );
    if (answer !== 'RESET') {
      console.log(
        'Confirmation did not match "RESET". Aborting — no writes made.',
      );
      await prisma.$disconnect();
      return;
    }
  }

  console.log('\nApplying...');
  const ids = batches.map((b) => b.id);
  const result = await prisma.$transaction(async (tx) => {
    // Rows first: the batch relation is ON DELETE RESTRICT.
    const rows = ids.length
      ? (
          await tx.payrollVariationRow.deleteMany({
            where: { batchId: { in: ids } },
          })
        ).count
      : 0;
    const deleted = ids.length
      ? (
          await tx.payrollVariationBatch.deleteMany({
            where: { id: { in: ids } },
          })
        ).count
      : 0;
    let baseline = 0;
    if (resetBaseline) {
      baseline = (
        await tx.payrollVariationState.deleteMany({ where: { id: 'FG' } })
      ).count;
    }

    let reopened = 0;
    let cancelled = 0;
    if (frozenSchedules.length) {
      const installmentIds = frozenSchedules.flatMap((s) =>
        s.rows.map((r) => r.installmentId),
      );
      // PARTIAL/PAID/MISSED are left alone: they carry real payment activity.
      reopened = installmentIds.length
        ? (
            await tx.repaymentInstallment.updateMany({
              where: { id: { in: installmentIds }, status: 'PUBLISHED' },
              data: { status: 'PLANNED' },
            })
          ).count
        : 0;
      // CANCELLED (not SUPERSEDED — nothing replaced it) with officialPeriod
      // cleared is what makes firstOpenPeriod() treat the month as open again.
      cancelled = (
        await tx.payrollSchedule.updateMany({
          where: { id: { in: frozenSchedules.map((s) => s.id) } },
          data: {
            status: 'CANCELLED',
            officialPeriod: null,
            publishedAt: null,
            publishedBy: null,
          },
        })
      ).count;
    }
    return { rows, batches: deleted, baseline, reopened, cancelled };
  });

  console.log(`  instruction rows deleted: ${result.rows}`);
  console.log(`  batches deleted:          ${result.batches}`);
  if (unfreezePeriod) {
    console.log(`  schedules cancelled:      ${result.cancelled}`);
    console.log(`  instalments reopened:     ${result.reopened}`);
  }
  if (resetBaseline)
    console.log(`  baseline rows deleted:    ${result.baseline}`);
  console.log(
    '\nDone. Re-open the variation dialog and preview the month again.',
  );
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
