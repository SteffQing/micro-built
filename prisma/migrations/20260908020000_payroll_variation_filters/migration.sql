-- Keep existing artifacts byte-identical by leaving their filter unspecified.
ALTER TABLE "PayrollVariationBatch" ADD COLUMN "changeFilter" TEXT,
    ADD COLUMN "excludedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PayrollVariationRow" ADD COLUMN "changeTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PayrollVariationBatch" ADD CONSTRAINT "PayrollVariationBatch_changeFilter_check"
    CHECK ("changeFilter" IS NULL OR "changeFilter" IN ('ALL', 'NEW_LOAN', 'TOPUP', 'LIQUIDATION', 'TENURE_CHANGE', 'COMBINED'));
ALTER TABLE "PayrollVariationBatch" ADD CONSTRAINT "PayrollVariationBatch_excludedCount_check" CHECK ("excludedCount" >= 0);
