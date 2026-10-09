-- Callouts are for customers only: no audience to choose.
ALTER TABLE "Callout" DROP CONSTRAINT IF EXISTS "Callout_published_has_audience";
ALTER TABLE "Callout" DROP COLUMN "audience";
DROP TYPE "CalloutAudience";
