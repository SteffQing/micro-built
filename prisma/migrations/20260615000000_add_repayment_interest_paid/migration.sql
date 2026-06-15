-- Track the interest portion collected per repayment so Interest Received can be
-- reported by period. Historical rows default to 0 (no backfill).
ALTER TABLE "Repayment" ADD COLUMN "interestPaid" DECIMAL(10,2) NOT NULL DEFAULT 0;
