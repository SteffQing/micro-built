-- The nine-column export is now unconditional: no batch, however old, may
-- re-emit ACTION, REASON, the balance breakdown or the internal metadata
-- sheet. That makes the per-batch layout flag dead state, so drop it.
--
-- Consequence, accepted deliberately: a batch whose artifactHash was stored
-- under the wider layout can no longer reproduce those bytes, so re-emailing
-- it fails loudly with "cannot be reproduced exactly" instead of quietly
-- sending the confidential columns again. Delete such a batch and prepare the
-- month afresh (prisma/maintenance/reset-payroll-variations.js).
ALTER TABLE "PayrollVariationBatch" DROP COLUMN IF EXISTS "artifactLayout";
