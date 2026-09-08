-- Lets a super admin abandon a prepared variation that was never submitted.
--
-- Preparing an official variation freezes the whole month, and until now the
-- only way out was "Confirm submitted". A preparation that bounced, or was
-- made by mistake, left the month committed with no in-app way back.
--
-- DISCARDED rows are kept for audit but are never read as instructions payroll
-- has received (buildPreview only diffs against SENT), and they release the
-- "one prepared variation at a time" partial unique index.
ALTER TYPE "PayrollVariationStatus" ADD VALUE IF NOT EXISTS 'DISCARDED';

ALTER TABLE "PayrollVariationBatch"
    ADD COLUMN "discardedAt" TIMESTAMP(3),
    ADD COLUMN "discardedBy" TEXT,
    ADD COLUMN "discardReason" TEXT;
