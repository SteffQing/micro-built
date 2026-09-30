-- Invariants schema.prisma cannot express. Idempotent: anything already
-- in place is skipped, so it is safe to run after every deploy.
--
--   pnpm db:invariants   (run by `pnpm db:deploy` after migrations)

-- One live loan per customer.
CREATE UNIQUE INDEX IF NOT EXISTS "Loan_one_active_per_borrower"
  ON "Loan" ("borrowerId")
  WHERE "status" IN ('PENDING', 'APPROVED', 'DISBURSED');

-- At most one recomputable deduction per loan.
CREATE UNIQUE INDEX IF NOT EXISTS "Deduction_one_open_per_loan"
  ON "Deduction" ("loanId")
  WHERE "status" = 'OPEN';

-- Re-uploading a payroll return cannot double count.
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentInflow_one_payroll_row_per_period"
  ON "PaymentInflow" ("externalUserId", "periodId")
  WHERE "source" = 'PAYROLL';

-- Two admins deciding at once can't leave a loan with two pending changes.
CREATE UNIQUE INDEX IF NOT EXISTS "TenureChange_one_pending_per_loan"
  ON "TenureChange" ("loanId")
  WHERE "status" = 'PENDING';

-- v1 contract rule, gone since better-auth made email required (v2). Dropping
-- the contact column already removed it; this covers any database that kept it.
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "User_email_or_contact";

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so check the catalogue.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Settings_singleton') THEN
    ALTER TABLE "Settings" ADD CONSTRAINT "Settings_singleton" CHECK ("id" = 1);
  END IF;

  -- Every liquidation is backed by proof of payment.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentInflow_liquidation_has_proof') THEN
    ALTER TABLE "PaymentInflow" ADD CONSTRAINT "PaymentInflow_liquidation_has_proof"
      CHECK ("source" <> 'LIQUIDATION' OR "proofPath" IS NOT NULL);
  END IF;

  -- Ledger rows only ever add money: owed and repaid never decrease.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MicroLoan_amount_positive') THEN
    ALTER TABLE "MicroLoan" ADD CONSTRAINT "MicroLoan_amount_positive" CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Repayment_amount_positive') THEN
    ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_amount_positive" CHECK ("amount" > 0);
  END IF;

  -- 0 is the STOP row of a repaid loan.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deduction_expected_not_negative') THEN
    ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_expected_not_negative" CHECK ("expected" >= 0);
  END IF;
END $$;
