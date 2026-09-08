-- CreateEnum
CREATE TYPE "PayrollVariationStatus" AS ENUM ('DRAFT', 'PREPARED', 'SENT');

-- CreateEnum
CREATE TYPE "PayrollVariationAction" AS ENUM ('START', 'AMEND', 'STOP');

-- AlterTable
ALTER TABLE "RepaymentObligation" ADD COLUMN     "payrollStopFromPeriod" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PayrollVariationState" (
    "id" TEXT NOT NULL,
    "initializedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initializedBy" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "baselineBatchId" TEXT,

    CONSTRAINT "PayrollVariationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollVariationBatch" (
    "id" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'VARIATION',
    "status" "PayrollVariationStatus" NOT NULL DEFAULT 'DRAFT',
    "previewHash" TEXT NOT NULL,
    "preparedBy" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "sentBy" TEXT,
    "submissionReference" TEXT,
    "emailedAt" TIMESTAMP(3),
    "emailError" TEXT,
    "artifactUrl" TEXT,
    "artifactHash" TEXT,
    "internalScheduleId" TEXT,
    "sourceScheduleId" TEXT,

    CONSTRAINT "PayrollVariationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollVariationRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "installmentId" TEXT,
    "planId" TEXT,
    "previousRowId" TEXT,
    "action" "PayrollVariationAction" NOT NULL,
    "reasons" TEXT[],
    "sourceEventIds" TEXT[],
    "externalId" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "previousAmount" DECIMAL(18,2),
    "amount" DECIMAL(18,2) NOT NULL,
    "contractualOutstanding" DECIMAL(18,2) NOT NULL,
    "penaltyOutstanding" DECIMAL(18,2) NOT NULL,
    "totalOutstanding" DECIMAL(18,2) NOT NULL,
    "termRemaining" INTEGER NOT NULL,
    "effectiveFromPeriod" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "instructionHash" TEXT NOT NULL,

    CONSTRAINT "PayrollVariationRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollVariationBatch_sourceScheduleId_key" ON "PayrollVariationBatch"("sourceScheduleId");

-- CreateIndex
CREATE INDEX "PayrollVariationBatch_status_period_idx" ON "PayrollVariationBatch"("status", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollVariationBatch_period_version_key" ON "PayrollVariationBatch"("period", "version");

-- CreateIndex
CREATE INDEX "PayrollVariationRow_borrowerId_effectiveFromPeriod_idx" ON "PayrollVariationRow"("borrowerId", "effectiveFromPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollVariationRow_batchId_borrowerId_key" ON "PayrollVariationRow"("batchId", "borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollVariationRow_batchId_externalId_key" ON "PayrollVariationRow"("batchId", "externalId");

-- AddForeignKey
ALTER TABLE "PayrollVariationBatch" ADD CONSTRAINT "PayrollVariationBatch_internalScheduleId_fkey" FOREIGN KEY ("internalScheduleId") REFERENCES "PayrollSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollVariationRow" ADD CONSTRAINT "PayrollVariationRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayrollVariationBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only one unresolved official file may be in flight at a time.
CREATE UNIQUE INDEX "PayrollVariationBatch_one_prepared" ON "PayrollVariationBatch" ((true)) WHERE "status" = 'PREPARED';
