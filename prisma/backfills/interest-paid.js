// One-time backfill for Repayment.interestPaid on rows that predate the column.
// Approximation: interest portion = (repaidAmount - penaltyCharge) * (repayable - principal)/repayable
// (exact for zero-penalty repayments). Idempotent: only touches rows where interestPaid = 0.
// Run (needs DATABASE_URL in env — PrismaClient does not auto-load .env):
//   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d "'\"")"
//   node prisma/backfills/interest-paid.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const [{ n }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM "Repayment"
    WHERE "loanId" IS NOT NULL AND "status" IN ('FULFILLED','PARTIAL') AND "interestPaid" = 0
  `;
  console.log('candidate rows:', n);

  const updated = await prisma.$executeRaw`
    UPDATE "Repayment" r
    SET "interestPaid" = GREATEST(0, r."repaidAmount" - r."penaltyCharge")
      * (CASE WHEN l."repayable" > 0 THEN (l."repayable" - l."principal") / l."repayable" ELSE 0 END)
    FROM "Loan" l
    WHERE r."loanId" = l."id"
      AND r."status" IN ('FULFILLED','PARTIAL')
      AND r."interestPaid" = 0
  `;
  console.log('rows updated:', updated);

  const [{ total }] = await prisma.$queryRaw`
    SELECT COALESCE(SUM("interestPaid"),0)::text AS total FROM "Repayment"
  `;
  const counter = await prisma.config.findUnique({
    where: { key: 'INTEREST_RATE_REVENUE' },
  });
  console.log('Σ interestPaid (backfilled):', total);
  console.log('INTEREST_RATE_REVENUE counter (all-time received):', counter?.value ?? '(unset)');

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
