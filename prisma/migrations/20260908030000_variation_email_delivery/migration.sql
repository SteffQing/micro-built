-- Delivery truth for variation emails.
-- "emailedAt" only records that the provider accepted the send. A misspelled
-- domain is accepted and then hard-bounces asynchronously, so an operator could
-- confirm a payroll submission that never arrived. These columns let the Resend
-- webhook record what actually happened.
ALTER TABLE "PayrollVariationBatch" ADD COLUMN "emailMessageId" TEXT,
    ADD COLUMN "emailDeliveredAt" TIMESTAMP(3);

CREATE INDEX "PayrollVariationBatch_emailMessageId_idx" ON "PayrollVariationBatch"("emailMessageId");
