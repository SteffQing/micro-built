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

-- One pending change request per user and kind: a later edit folds into it.
CREATE UNIQUE INDEX IF NOT EXISTS "ChangeRequest_one_pending_per_kind"
  ON "ChangeRequest" ("userId", "kind")
  WHERE "status" = 'PENDING';

-- A loan's stored totals always equal its rows, checked when the transaction commits (so a ledger call may write the
-- loan and its rows in any order): owed = Σ DISBURSED microloans, repaid = Σ repayments = Σ their breakdowns,
-- repaid ≤ owed. The ledger asserts the same in code (assertLedgerInvariants); this also stops scripts and hand edits.
CREATE OR REPLACE FUNCTION ledger_assert_loan_totals(loan_id text) RETURNS void AS $$
DECLARE
  t record;
BEGIN
  SELECT l."owed", l."repaid",
    (SELECT COALESCE(SUM(m."amount"), 0) FROM "MicroLoan" m WHERE m."loanId" = l."id" AND m."status" = 'DISBURSED') AS booked,
    (SELECT COALESCE(SUM(r."amount"), 0) FROM "Repayment" r WHERE r."loanId" = l."id") AS paid,
    (SELECT COALESCE(SUM(b."amount"), 0) FROM "RepaymentBreakdown" b
       JOIN "Repayment" r ON r."id" = b."repaymentId" WHERE r."loanId" = l."id") AS splits
  INTO t FROM "Loan" l WHERE l."id" = loan_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF t."owed" <> t.booked OR t."repaid" <> t.paid OR t.paid <> t.splits OR t."repaid" > t."owed" THEN
    RAISE EXCEPTION 'Ledger totals broken on loan %: owed % (microloans %), repaid % (repayments %, breakdowns %)',
      loan_id, t."owed", t.booked, t."repaid", t.paid, t.splits
      USING ERRCODE = 'check_violation';
  END IF;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ledger_totals_on_loan() RETURNS trigger AS $$
BEGIN
  PERFORM ledger_assert_loan_totals(NEW."id");
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ledger_totals_on_row() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'DELETE' THEN PERFORM ledger_assert_loan_totals(NEW."loanId"); END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD."loanId" IS DISTINCT FROM NEW."loanId") THEN
    PERFORM ledger_assert_loan_totals(OLD."loanId");
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ledger_totals_on_breakdown() RETURNS trigger AS $$
DECLARE
  loan_id text;
BEGIN
  FOR loan_id IN
    SELECT r."loanId" FROM "Repayment" r
    WHERE r."id" IN (
      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW."repaymentId" END,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."repaymentId" END
    )
  LOOP
    PERFORM ledger_assert_loan_totals(loan_id);
  END LOOP;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Loan_totals_match_rows" ON "Loan";
CREATE CONSTRAINT TRIGGER "Loan_totals_match_rows"
  AFTER INSERT OR UPDATE OF "owed", "repaid" ON "Loan"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_totals_on_loan();

DROP TRIGGER IF EXISTS "MicroLoan_totals_match_loan" ON "MicroLoan";
CREATE CONSTRAINT TRIGGER "MicroLoan_totals_match_loan"
  AFTER INSERT OR UPDATE OR DELETE ON "MicroLoan"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_totals_on_row();

DROP TRIGGER IF EXISTS "Repayment_totals_match_loan" ON "Repayment";
CREATE CONSTRAINT TRIGGER "Repayment_totals_match_loan"
  AFTER INSERT OR UPDATE OR DELETE ON "Repayment"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_totals_on_row();

DROP TRIGGER IF EXISTS "RepaymentBreakdown_totals_match_loan" ON "RepaymentBreakdown";
CREATE CONSTRAINT TRIGGER "RepaymentBreakdown_totals_match_loan"
  AFTER INSERT OR UPDATE OR DELETE ON "RepaymentBreakdown"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_totals_on_breakdown();

-- Callouts (the sidebar's short content pieces): at most one pinned, and only a published one; a published one is for
-- someone; priority is low, normal or high; the text stays short enough for the sidebar.
CREATE UNIQUE INDEX IF NOT EXISTS "Callout_one_pinned"
  ON "Callout" ((true))
  WHERE "pinned";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Callout_pinned_is_published') THEN
    ALTER TABLE "Callout" ADD CONSTRAINT "Callout_pinned_is_published"
      CHECK (NOT "pinned" OR "status" = 'PUBLISHED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Callout_published_has_audience') THEN
    ALTER TABLE "Callout" ADD CONSTRAINT "Callout_published_has_audience"
      CHECK ("status" <> 'PUBLISHED' OR cardinality("audience") > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Callout_priority_range') THEN
    ALTER TABLE "Callout" ADD CONSTRAINT "Callout_priority_range" CHECK ("priority" BETWEEN 0 AND 2);
  END IF;
  -- The card is one fixed height: two lines of title, four of body. (Replaces the first, roomier limits.)
  ALTER TABLE "Callout" DROP CONSTRAINT IF EXISTS "Callout_text_fits";
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Callout_text_fits_card') THEN
    ALTER TABLE "Callout" ADD CONSTRAINT "Callout_text_fits_card" CHECK (
      char_length(btrim("title")) BETWEEN 1 AND 60
      AND char_length(btrim("body")) BETWEEN 1 AND 160
      AND ("highlight" IS NULL OR char_length(btrim("highlight")) BETWEEN 1 AND 24)
    );
  END IF;
END $$;
