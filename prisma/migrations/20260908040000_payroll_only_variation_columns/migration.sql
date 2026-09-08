-- The emailed variation file returns to exactly the nine columns payroll has
-- always received. ACTION, REASON, CONTRACTUAL BALANCE and PENALTY BALANCE
-- exposed internal decisions about customers and are dropped from the export.
--
-- Artifacts already generated were built with the wider layout and their hash
-- is stored, so re-emailing a saved submission must still reproduce the exact
-- original bytes. Stamp those rows so they keep rendering their own layout.
ALTER TABLE "PayrollVariationBatch"
    ADD COLUMN "artifactLayout" TEXT NOT NULL DEFAULT 'PAYROLL';

UPDATE "PayrollVariationBatch"
    SET "artifactLayout" = 'DETAILED'
    WHERE "artifactHash" IS NOT NULL;

ALTER TABLE "PayrollVariationBatch" ADD CONSTRAINT "PayrollVariationBatch_artifactLayout_check"
    CHECK ("artifactLayout" IN ('PAYROLL', 'DETAILED'));
