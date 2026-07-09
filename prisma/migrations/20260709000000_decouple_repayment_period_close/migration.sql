CREATE TYPE "RepaymentSource" AS ENUM ('PAYROLL', 'LIQUIDATION', 'OVERFLOW', 'MANUAL');

ALTER TABLE "Repayment"
ADD COLUMN "source" "RepaymentSource" NOT NULL DEFAULT 'PAYROLL';

UPDATE "Repayment"
SET "source" = CASE
  WHEN "liquidationRequestId" IS NOT NULL THEN 'LIQUIDATION'::"RepaymentSource"
  WHEN "status" = 'MANUAL_RESOLUTION' AND "userId" IS NOT NULL THEN 'OVERFLOW'::"RepaymentSource"
  WHEN "status" = 'MANUAL_RESOLUTION' AND "userId" IS NULL THEN 'MANUAL'::"RepaymentSource"
  ELSE 'PAYROLL'::"RepaymentSource"
END;

CREATE TABLE "RepaymentUpload" (
  "id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RepaymentUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RepaymentUpload_fileHash_key" ON "RepaymentUpload"("fileHash");
CREATE INDEX "RepaymentUpload_period_idx" ON "RepaymentUpload"("period");
CREATE INDEX "RepaymentUpload_uploadedBy_idx" ON "RepaymentUpload"("uploadedBy");

ALTER TABLE "RepaymentUpload"
ADD CONSTRAINT "RepaymentUpload_uploadedBy_fkey"
FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX repayment_payroll_period_uq
ON "Repayment" ("loanId", "period")
WHERE "source" = 'PAYROLL';
