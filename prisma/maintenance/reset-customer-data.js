// Nukes all CUSTOMER-role user data (loans, repayments, liquidation requests,
// commodity loans, notifications) and resets the numeric Config counters
// (TOTAL_DISBURSED, TOTAL_REPAID, TOTAL_BORROWED, BALANCE_OUTSTANDING,
// INTEREST_RATE_REVENUE, MANAGEMENT_FEE_REVENUE, PENALTY_FEE_REVENUE) back to 0.
// Also clears LAST_REPAYMENT_DATE — it's a repayment-processing idempotency
// marker, not a system setting, and leaving it stale after wiping repayment
// history would cause the next repayment upload for that period to be
// silently skipped as "already processed".
//
// Never touches: ADMIN/MARKETER/SUPER_ADMIN users, or the system-setting
// Config keys (INTEREST_RATE, MANAGEMENT_FEE_RATE, PENALTY_FEE_RATE,
// IN_MAINTENANCE, COMMODITY_CATEGORIES).
//
// Irreversible. No soft-delete, no audit trail. Take a DB snapshot/backup
// before running. Recommended: toggle IN_MAINTENANCE on (via the admin
// endpoint) and confirm the `repayments` BullMQ queue is idle before running,
// so nothing races the deletes or double-touches the same Config counters
// this script zeroes.
//
// Run (needs DATABASE_URL in env — PrismaClient does not auto-load .env):
//   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d "'\"")"
//   node prisma/maintenance/reset-customer-data.js                # dry run, no writes
//   node prisma/maintenance/reset-customer-data.js --yes-nuke      # executes, asks you to type NUKE
//   node prisma/maintenance/reset-customer-data.js --yes-nuke --force   # executes, skips the prompt
//                                                                        # (disposable/non-interactive envs only — never prod)
const readline = require('readline');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COUNTER_KEYS = [
  'TOTAL_DISBURSED',
  'TOTAL_REPAID',
  'TOTAL_BORROWED',
  'BALANCE_OUTSTANDING',
  'INTEREST_RATE_REVENUE',
  'MANAGEMENT_FEE_REVENUE',
  'PENALTY_FEE_REVENUE',
];

const NON_CUSTOMER_ROLES = ['ADMIN', 'MARKETER', 'SUPER_ADMIN'];

function redactDbUrl(url) {
  if (!url) return '(unset)';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

async function gatherReport(customerIds, loanIds, liquidationIds) {
  const [
    customers,
    loans,
    repayments,
    commodityLoans,
    liquidations,
    notifications,
    nonCustomerUsers,
    configRows,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.loan.count({ where: { borrowerId: { in: customerIds } } }),
    prisma.repayment.count({
      where: {
        OR: [
          { userId: { in: customerIds } },
          { loanId: { in: loanIds } },
          { liquidationRequestId: { in: liquidationIds } },
        ],
      },
    }),
    prisma.commodityLoan.count({ where: { borrowerId: { in: customerIds } } }),
    prisma.liquidationRequest.count({ where: { customerId: { in: customerIds } } }),
    prisma.notification.count({ where: { userId: { in: customerIds } } }),
    prisma.user.count({ where: { role: { in: NON_CUSTOMER_ROLES } } }),
    prisma.config.findMany({
      where: {
        key: {
          in: [
            ...COUNTER_KEYS,
            'LAST_REPAYMENT_DATE',
            'INTEREST_RATE',
            'MANAGEMENT_FEE_RATE',
            'PENALTY_FEE_RATE',
            'IN_MAINTENANCE',
            'COMMODITY_CATEGORIES',
          ],
        },
      },
    }),
  ]);

  const configMap = Object.fromEntries(configRows.map((c) => [c.key, c.value]));

  return {
    customers,
    loans,
    repayments,
    commodityLoans,
    liquidations,
    notifications,
    nonCustomerUsers,
    configMap,
  };
}

function printReport(label, report) {
  console.log(`\n--- ${label} ---`);
  console.log('CUSTOMER users:', report.customers);
  console.log('Loans (customer-owned):', report.loans);
  console.log('Repayments (customer-linked):', report.repayments);
  console.log('CommodityLoans (customer-owned):', report.commodityLoans);
  console.log('LiquidationRequests (customer-owned):', report.liquidations);
  console.log('Notifications (customer-owned):', report.notifications);
  console.log('Non-customer users (ADMIN/MARKETER/SUPER_ADMIN):', report.nonCustomerUsers);
  console.log('Counter Config values:');
  for (const key of COUNTER_KEYS) {
    console.log(`  ${key}: ${report.configMap[key] ?? '(unset)'}`);
  }
  console.log(`  LAST_REPAYMENT_DATE: ${report.configMap.LAST_REPAYMENT_DATE ?? '(unset)'}`);
  console.log('System-setting Config values (must be unchanged after):');
  for (const key of ['INTEREST_RATE', 'MANAGEMENT_FEE_RATE', 'PENALTY_FEE_RATE', 'IN_MAINTENANCE', 'COMMODITY_CATEGORIES']) {
    console.log(`  ${key}: ${report.configMap[key] ?? '(unset)'}`);
  }
}

function promptForConfirmation(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

(async () => {
  const args = process.argv.slice(2);
  const execute = args.includes('--yes-nuke');
  const force = args.includes('--force');

  const customerIds = (
    await prisma.user.findMany({ where: { role: 'CUSTOMER' }, select: { id: true } })
  ).map((u) => u.id);

  if (customerIds.length === 0) {
    console.log('No CUSTOMER users found. Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  // Pre-flight FK guard: accountOfficerId should only ever point at an
  // ADMIN/MARKETER, never a CUSTOMER. Abort loudly instead of assuming.
  const strayOfficerRefs = await prisma.user.count({
    where: { accountOfficerId: { in: customerIds } },
  });
  if (strayOfficerRefs > 0) {
    throw new Error(
      `${strayOfficerRefs} user(s) reference a CUSTOMER via accountOfficerId — investigate before nuking.`,
    );
  }

  const loanIds = (
    await prisma.loan.findMany({ where: { borrowerId: { in: customerIds } }, select: { id: true } })
  ).map((l) => l.id);
  const liquidationIds = (
    await prisma.liquidationRequest.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true },
    })
  ).map((l) => l.id);

  const before = await gatherReport(customerIds, loanIds, liquidationIds);
  printReport('BEFORE', before);

  if (!execute) {
    console.log('\nDry run only — no writes made. Pass --yes-nuke to execute.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nTarget database: ${redactDbUrl(process.env.DATABASE_URL)}`);

  if (!force) {
    const answer = await promptForConfirmation('\nType NUKE to permanently delete the data above: ');
    if (answer !== 'NUKE') {
      console.log('Confirmation did not match "NUKE". Aborting — no writes made.');
      await prisma.$disconnect();
      return;
    }
  }

  console.log('\nDeleting...');

  await prisma.repayment.deleteMany({
    where: {
      OR: [
        { userId: { in: customerIds } },
        { loanId: { in: loanIds } },
        { liquidationRequestId: { in: liquidationIds } },
      ],
    },
  });
  await prisma.commodityLoan.deleteMany({ where: { borrowerId: { in: customerIds } } });
  await prisma.loan.deleteMany({ where: { borrowerId: { in: customerIds } } });
  await prisma.liquidationRequest.deleteMany({ where: { customerId: { in: customerIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: customerIds } } });
  await prisma.user.deleteMany({ where: { role: 'CUSTOMER' } });

  for (const key of COUNTER_KEYS) {
    await prisma.config.upsert({
      where: { key },
      update: { value: '0' },
      create: { key, value: '0' },
    });
  }
  await prisma.config.deleteMany({ where: { key: 'LAST_REPAYMENT_DATE' } });

  const after = await gatherReport([], [], []);
  // customer-scoped counts above are meaningless post-delete (customerIds is now
  // empty); re-count directly instead so AFTER reflects the true remaining state.
  after.customers = await prisma.user.count({ where: { role: 'CUSTOMER' } });
  after.loans = await prisma.loan.count({ where: { borrowerId: { in: customerIds } } });
  after.repayments = await prisma.repayment.count({
    where: {
      OR: [
        { userId: { in: customerIds } },
        { loanId: { in: loanIds } },
        { liquidationRequestId: { in: liquidationIds } },
      ],
    },
  });
  after.commodityLoans = await prisma.commodityLoan.count({ where: { borrowerId: { in: customerIds } } });
  after.liquidations = await prisma.liquidationRequest.count({ where: { customerId: { in: customerIds } } });
  after.notifications = await prisma.notification.count({ where: { userId: { in: customerIds } } });

  printReport('AFTER', after);

  const nonCustomerUnchanged = after.nonCustomerUsers === before.nonCustomerUsers;
  const systemSettingsUnchanged = ['INTEREST_RATE', 'MANAGEMENT_FEE_RATE', 'PENALTY_FEE_RATE', 'IN_MAINTENANCE', 'COMMODITY_CATEGORIES'].every(
    (key) => after.configMap[key] === before.configMap[key],
  );

  console.log('\nNon-customer users unchanged:', nonCustomerUnchanged);
  console.log('System-setting Config values unchanged:', systemSettingsUnchanged);
  console.log('\nDone.');

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
