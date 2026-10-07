-- Every callout but the pinned one is deleted 7 days after it's created (or last renewed). Existing ones get their
-- 7 days from when they were created.
ALTER TABLE "Callout" ADD COLUMN "expiresAt" TIMESTAMP(3);
UPDATE "Callout" SET "expiresAt" = "createdAt" + INTERVAL '7 days';
ALTER TABLE "Callout" ALTER COLUMN "expiresAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Callout_expiresAt_idx" ON "Callout"("expiresAt");
