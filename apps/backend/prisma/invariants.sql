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

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so check the catalogue.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_email_or_contact') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_email_or_contact"
      CHECK ("email" IS NOT NULL OR "contact" IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Settings_singleton') THEN
    ALTER TABLE "Settings" ADD CONSTRAINT "Settings_singleton" CHECK ("id" = 1);
  END IF;
END $$;
