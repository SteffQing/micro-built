/*
  Warnings:

  - A unique constraint covering the columns `[installmentId]` on the table `Repayment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ObligationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'SETTLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanReason" AS ENUM ('INITIAL_DISBURSEMENT', 'TOPUP', 'DEFAULT_EXTENSION', 'OVERPAYMENT', 'MANUAL_TENURE_CHANGE', 'MANUAL_RESTRUCTURE', 'LIQUIDATION', 'REVERSAL', 'MIGRATION_BASELINE');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PLANNED', 'PUBLISHED', 'PARTIAL', 'PAID', 'MISSED', 'WAIVED', 'SUPERSEDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayrollScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ACKNOWLEDGED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('RECEIVED', 'MATCHED', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'UNMATCHED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AllocationComponent" AS ENUM ('PENALTY', 'INTEREST', 'PRINCIPAL', 'CREDIT');

-- CreateEnum
CREATE TYPE "PenaltyEntryType" AS ENUM ('ASSESSMENT', 'PAYMENT', 'WAIVER', 'REVERSAL');

-- CreateEnum
CREATE TYPE "TenureChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM', 'PAYROLL');

-- AlterTable
ALTER TABLE "LiquidationRequest" ADD COLUMN     "obligationId" TEXT,
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Loan" ALTER COLUMN "principal" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "penalty" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "repaid" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "repayable" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "penaltyRepaid" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Repayment" ADD COLUMN     "installmentId" TEXT,
ADD COLUMN     "obligationId" TEXT,
ADD COLUMN     "receiptId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "expectedAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "repaidAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "penaltyCharge" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "interestPaid" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "UserPayroll" ALTER COLUMN "netPay" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "employeeGross" SET DATA TYPE DECIMAL(18,2);

-- CreateTable
CREATE TABLE "RepaymentObligation" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "status" "ObligationStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "currentPlanId" TEXT,
    "contractualOutstanding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penaltyOutstanding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepaymentObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObligationAdvance" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "joinedByEventId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "ObligationAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObligationEvent" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "EventActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "causationId" TEXT,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "policyVersion" TEXT,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,

    CONSTRAINT "ObligationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepaymentPlan" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" "PlanReason" NOT NULL,
    "policyName" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "inputEventSequence" BIGINT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "effectiveFromPeriod" TIMESTAMP(3) NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "scheduledBalance" DECIMAL(18,2) NOT NULL,
    "penaltyBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "scheduledMonthly" DECIMAL(18,2) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "RepaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepaymentInstallment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "scheduledAmount" DECIMAL(18,2) NOT NULL,
    "penaltyDue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalExpected" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "waivedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PLANNED',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepaymentInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollSchedule" (
    "id" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PayrollScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "artifactUrl" TEXT,
    "artifactHash" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "supersedesScheduleId" TEXT,

    CONSTRAINT "PayrollSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollScheduleRow" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "contractualOutstanding" DECIMAL(18,2) NOT NULL,
    "penaltyOutstanding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalOutstanding" DECIMAL(18,2) NOT NULL,
    "termRemaining" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "rowHash" TEXT NOT NULL,

    CONSTRAINT "PayrollScheduleRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT,
    "scheduleRowId" TEXT,
    "source" "RepaymentSource" NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "externalReference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "installmentId" TEXT,
    "loanId" TEXT,
    "component" "AllocationComponent" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversesAllocationId" TEXT,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenaltyEntry" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "installmentId" TEXT,
    "eventId" TEXT NOT NULL,
    "entryType" "PenaltyEntryType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "reversesEntryId" TEXT,

    CONSTRAINT "PenaltyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenureChangeRequest" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "status" "TenureChangeStatus" NOT NULL DEFAULT 'PENDING',
    "requestedTermMonths" INTEGER NOT NULL,
    "previousTermMonths" INTEGER NOT NULL,
    "previousMonthly" DECIMAL(18,2) NOT NULL,
    "proposedMonthly" DECIMAL(18,2) NOT NULL,
    "balanceSnapshot" DECIMAL(18,2) NOT NULL,
    "effectiveFromPeriod" TIMESTAMP(3) NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "note" TEXT,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    "expectedObligationVersion" INTEGER NOT NULL,
    "previewHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "TenureChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepaymentObligation_currentPlanId_key" ON "RepaymentObligation"("currentPlanId");

-- CreateIndex
CREATE INDEX "RepaymentObligation_status_idx" ON "RepaymentObligation"("status");

-- CreateIndex
CREATE INDEX "RepaymentObligation_borrowerId_status_openedAt_idx" ON "RepaymentObligation"("borrowerId", "status", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ObligationAdvance_loanId_key" ON "ObligationAdvance"("loanId");

-- CreateIndex
CREATE INDEX "ObligationAdvance_obligationId_joinedAt_idx" ON "ObligationAdvance"("obligationId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ObligationEvent_idempotencyKey_key" ON "ObligationEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ObligationEvent_obligationId_effectiveAt_idx" ON "ObligationEvent"("obligationId", "effectiveAt");

-- CreateIndex
CREATE INDEX "ObligationEvent_correlationId_idx" ON "ObligationEvent"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "ObligationEvent_obligationId_sequence_key" ON "ObligationEvent"("obligationId", "sequence");

-- CreateIndex
CREATE INDEX "RepaymentPlan_obligationId_status_effectiveFromPeriod_idx" ON "RepaymentPlan"("obligationId", "status", "effectiveFromPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "RepaymentPlan_obligationId_version_key" ON "RepaymentPlan"("obligationId", "version");

-- CreateIndex
CREATE INDEX "RepaymentInstallment_obligationId_period_status_idx" ON "RepaymentInstallment"("obligationId", "period", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RepaymentInstallment_planId_sequence_key" ON "RepaymentInstallment"("planId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RepaymentInstallment_planId_period_key" ON "RepaymentInstallment"("planId", "period");

-- CreateIndex
CREATE INDEX "PayrollSchedule_period_status_idx" ON "PayrollSchedule"("period", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollSchedule_period_version_key" ON "PayrollSchedule"("period", "version");

-- CreateIndex
CREATE INDEX "PayrollScheduleRow_obligationId_idx" ON "PayrollScheduleRow"("obligationId");

-- CreateIndex
CREATE INDEX "PayrollScheduleRow_externalId_idx" ON "PayrollScheduleRow"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollScheduleRow_scheduleId_installmentId_key" ON "PayrollScheduleRow"("scheduleId", "installmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollScheduleRow_scheduleId_borrowerId_key" ON "PayrollScheduleRow"("scheduleId", "borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_idempotencyKey_key" ON "PaymentReceipt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentReceipt_obligationId_period_idx" ON "PaymentReceipt"("obligationId", "period");

-- CreateIndex
CREATE INDEX "PaymentReceipt_externalReference_idx" ON "PaymentReceipt"("externalReference");

-- CreateIndex
CREATE INDEX "PaymentAllocation_obligationId_installmentId_idx" ON "PaymentAllocation"("obligationId", "installmentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_loanId_idx" ON "PaymentAllocation"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_receiptId_sequence_key" ON "PaymentAllocation"("receiptId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "PenaltyEntry_eventId_key" ON "PenaltyEntry"("eventId");

-- CreateIndex
CREATE INDEX "PenaltyEntry_obligationId_effectiveAt_idx" ON "PenaltyEntry"("obligationId", "effectiveAt");

-- CreateIndex
CREATE INDEX "TenureChangeRequest_obligationId_status_idx" ON "TenureChangeRequest"("obligationId", "status");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_createdAt_idx" ON "OutboxEvent"("publishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "LiquidationRequest_obligationId_idx" ON "LiquidationRequest"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "Repayment_installmentId_key" ON "Repayment"("installmentId");

-- CreateIndex
CREATE INDEX "Repayment_obligationId_period_idx" ON "Repayment"("obligationId", "period");

-- CreateIndex
CREATE INDEX "Repayment_receiptId_idx" ON "Repayment"("receiptId");

-- AddForeignKey
ALTER TABLE "RepaymentObligation" ADD CONSTRAINT "RepaymentObligation_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepaymentObligation" ADD CONSTRAINT "RepaymentObligation_currentPlanId_fkey" FOREIGN KEY ("currentPlanId") REFERENCES "RepaymentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationAdvance" ADD CONSTRAINT "ObligationAdvance_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RepaymentObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationAdvance" ADD CONSTRAINT "ObligationAdvance_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationAdvance" ADD CONSTRAINT "ObligationAdvance_joinedByEventId_fkey" FOREIGN KEY ("joinedByEventId") REFERENCES "ObligationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationEvent" ADD CONSTRAINT "ObligationEvent_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RepaymentObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepaymentPlan" ADD CONSTRAINT "RepaymentPlan_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RepaymentObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepaymentInstallment" ADD CONSTRAINT "RepaymentInstallment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RepaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepaymentInstallment" ADD CONSTRAINT "RepaymentInstallment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RepaymentObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSchedule" ADD CONSTRAINT "PayrollSchedule_supersedesScheduleId_fkey" FOREIGN KEY ("supersedesScheduleId") REFERENCES "PayrollSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollScheduleRow" ADD CONSTRAINT "PayrollScheduleRow_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "PayrollSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollScheduleRow" ADD CONSTRAINT "PayrollScheduleRow_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "RepaymentInstallment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollScheduleRow" ADD CONSTRAINT "PayrollScheduleRow_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RepaymentObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollScheduleRow" ADD CONSTRAINT "PayrollScheduleRow_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RepaymentObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_scheduleRowId_fkey" FOREIGN KEY ("scheduleRowId") REFERENCES "PayrollScheduleRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PaymentReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RepaymentObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "RepaymentInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ObligationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_reversesAllocationId_fkey" FOREIGN KEY ("reversesAllocationId") REFERENCES "PaymentAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyEntry" ADD CONSTRAINT "PenaltyEntry_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RepaymentObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyEntry" ADD CONSTRAINT "PenaltyEntry_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "RepaymentInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyEntry" ADD CONSTRAINT "PenaltyEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ObligationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyEntry" ADD CONSTRAINT "PenaltyEntry_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "PenaltyEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenureChangeRequest" ADD CONSTRAINT "TenureChangeRequest_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RepaymentObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RepaymentObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "RepaymentInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PaymentReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidationRequest" ADD CONSTRAINT "LiquidationRequest_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RepaymentObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
