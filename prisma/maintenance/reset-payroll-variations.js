// Deletes payroll variation batches (and their instruction rows) so a month can
// be prepared again from scratch.
//
// Why this is needed: a SENT batch is what the system diffs against. While one
// exists for a period, re-previewing that period reports every customer as
// "unchanged" and produces an empty file — there is no way to regenerate the
// same instructions through the UI.
//
// Leaves alone by design:
//   - PayrollSchedule / RepaymentInstallment. The internal monthly snapshot
//     stays PUBLISHED, so the month remains frozen and a re-prepared official
//     variation reuses the exact same figures (reuseOfficial). Undoing the
//     freeze is a separate, much deeper revert.
//   - PayrollVariationState (the submission baseline) unless --reset-baseline
//     is passed. Re-initializing is a one-time action with no undo in the app.
//   - Files already uploaded to Supabase. Deleting a batch orphans its
//     artifact; remove it from storage by hand if it matters.
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

  const where = batchId ? { id: batchId } : {};
  const batches = await prisma.payrollVariationBatch.findMany({
    where,
    orderBy: [{ period: 'desc' }, { version: 'desc' }],
    include: { _count: { select: { rows: true } } },
  });

  if (batches.length === 0) {
    console.log(
      batchId
        ? `No variation batch found with id ${batchId}. Nothing to do.`
        : 'No variation batches found. Nothing to do.',
    );
    await prisma.$disconnect();
    return;
  }

  console.log(`\nVariation batches to delete (${batches.length}):`);
  for (const batch of batches) {
    console.log(
      `  ${batch.id}  ${periodLabel(batch.period)}  v${batch.version}  ${batch.kind}/${batch.status}  ` +
        `${batch._count.rows} rows  internalSchedule=${batch.internalScheduleId ?? '-'}`,
    );
    if (batch.artifactUrl)
      console.log(`      orphans artifact: ${batch.artifactUrl}`);
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

  // The internal snapshot stays published, so the month stays frozen and a
  // re-prepared official variation reuses these exact figures.
  const frozen = await prisma.payrollSchedule.findMany({
    where: {
      id: { in: batches.map((b) => b.internalScheduleId).filter(Boolean) },
    },
    select: {
      id: true,
      period: true,
      version: true,
      status: true,
      rowCount: true,
    },
  });
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
      '\nType RESET to permanently delete the batches above: ',
    );
    if (answer !== 'RESET') {
      console.log(
        'Confirmation did not match "RESET". Aborting — no writes made.',
      );
      await prisma.$disconnect();
      return;
    }
  }

  console.log('\nDeleting...');
  const ids = batches.map((b) => b.id);
  const result = await prisma.$transaction(async (tx) => {
    // Rows first: the batch relation is ON DELETE RESTRICT.
    const rows = await tx.payrollVariationRow.deleteMany({
      where: { batchId: { in: ids } },
    });
    const deleted = await tx.payrollVariationBatch.deleteMany({
      where: { id: { in: ids } },
    });
    let baseline = 0;
    if (resetBaseline) {
      baseline = (
        await tx.payrollVariationState.deleteMany({ where: { id: 'FG' } })
      ).count;
    }
    return { rows: rows.count, batches: deleted.count, baseline };
  });

  console.log(`  instruction rows deleted: ${result.rows}`);
  console.log(`  batches deleted:          ${result.batches}`);
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
