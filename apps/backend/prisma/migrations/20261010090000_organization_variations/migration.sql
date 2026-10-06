-- PLAN_V2 Stage A: variations and vouchers per organization.
--
-- Runs only on a database with no payroll state left to carry: no voucher (PayrollUpload) rows, no submitted or
-- closed month, no AWAITING deduction (it would belong to no variation), no audit row using an enum value dropped
-- below. scripts/maintenance/reset-september-2026.ts got the live database there; a fresh database already is.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PayrollUpload") THEN
    RAISE EXCEPTION 'PLAN_V2: PayrollUpload has rows; run scripts/maintenance/reset-september-2026.ts first';
  END IF;
  IF EXISTS (SELECT 1 FROM "PayrollPeriod" WHERE "variationSubmittedAt" IS NOT NULL OR "closedAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'PLAN_V2: a month is submitted or closed; run scripts/maintenance/reset-september-2026.ts first';
  END IF;
  IF EXISTS (SELECT 1 FROM "Deduction" WHERE "status" = 'AWAITING') THEN
    RAISE EXCEPTION 'PLAN_V2: AWAITING deductions would belong to no variation; run the reset first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "AuditLog"
    WHERE "action"::text IN ('VARIATION_SUBMITTED', 'VARIATION_REVERTED', 'PERIOD_CLOSED', 'PAYROLL_UPLOADED')
       OR "entityType"::text IN ('PAYROLL_PERIOD', 'PAYROLL_UPLOAD')
  ) THEN
    RAISE EXCEPTION 'PLAN_V2: audit rows use enum values this migration drops; run the reset first';
  END IF;
END $$;

-- Audit enums: values for submit/close/upload go, the variation/voucher ones come in.
BEGIN;
CREATE TYPE "AuditAction_new" AS ENUM ('LOAN_APPROVED', 'LOAN_REJECTED', 'LOAN_DISBURSED', 'TOPUP_APPROVED', 'TOPUP_REJECTED', 'TOPUP_DISBURSED', 'PENALTY_APPLIED', 'TENURE_CHANGE_PROPOSED', 'TENURE_CHANGE_APPROVED', 'TENURE_CHANGE_REJECTED', 'PAYMENT_INFLOW_APPROVED', 'PAYMENT_INFLOW_REJECTED', 'VARIATION_GENERATED', 'VOUCHER_UPLOADED', 'VOUCHER_REVERTED', 'NO_PAYROLL', 'NO_PAYROLL_REVERTED', 'COMMODITY_APPROVED', 'COMMODITY_REJECTED', 'CUSTOMER_STATUS_CHANGED', 'CUSTOMER_OFFICER_CHANGED', 'ADMIN_INVITED', 'ADMIN_REMOVED', 'CHANGE_REQUEST_APPROVED', 'CHANGE_REQUEST_REJECTED', 'CHANGE_REQUEST_PROPOSED', 'SETTINGS_UPDATED', 'MAINTENANCE_TOGGLED', 'COMMODITY_ADDED', 'COMMODITY_UPDATED', 'COMMODITY_DELETED', 'ADMIN_ROLE_CHANGED', 'SIGN_IN_RESET', 'CUSTOMER_ONBOARDED', 'CUSTOMERS_IMPORTED', 'DATA_EXPORTED', 'DOCUMENT_GENERATED', 'ORGANIZATIONS_MERGED');
ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "public"."AuditAction_old";
COMMIT;

BEGIN;
CREATE TYPE "AuditEntityType_new" AS ENUM ('LOAN', 'MICRO_LOAN', 'TENURE_CHANGE', 'PAYMENT_INFLOW', 'VARIATION', 'COMMODITY_LOAN', 'USER', 'VOUCHER', 'CHANGE_REQUEST', 'SETTINGS', 'COMMODITY', 'FILE', 'ORGANIZATION');
ALTER TABLE "AuditLog" ALTER COLUMN "entityType" TYPE "AuditEntityType_new" USING ("entityType"::text::"AuditEntityType_new");
ALTER TYPE "AuditEntityType" RENAME TO "AuditEntityType_old";
ALTER TYPE "AuditEntityType_new" RENAME TO "AuditEntityType";
DROP TYPE "public"."AuditEntityType_old";
COMMIT;

ALTER TYPE "ChangeRequestKind" ADD VALUE 'ORGANIZATION';

-- Period: the calendar month, today's PayrollPeriod renamed with its ids, so the foreign keys from Deduction and
-- PaymentInflow (and the PAYROLL-inflow index in invariants.sql) keep working.
ALTER TABLE "PayrollPeriod" RENAME TO "Period";
ALTER TABLE "Period" RENAME CONSTRAINT "PayrollPeriod_pkey" TO "Period_pkey";
ALTER INDEX "PayrollPeriod_year_month_key" RENAME TO "Period_year_month_key";
ALTER TABLE "Period" DROP COLUMN "variationSubmittedAt",
DROP COLUMN "variationFilePath",
DROP COLUMN "closedAt";

-- PayrollUpload is empty (checked above): dropped, and Voucher created fresh.
ALTER TABLE "PaymentInflow" DROP CONSTRAINT "PaymentInflow_uploadId_fkey";
ALTER TABLE "PaymentInflow" DROP COLUMN "uploadId",
ADD COLUMN "voucherId" TEXT;
DROP TABLE "PayrollUpload";

-- Organizations from the names on payroll records, matched on the normalized name; the most used spelling wins.
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_normalizedName_key" ON "Organization"("normalizedName");

INSERT INTO "Organization" ("id", "name", "normalizedName")
SELECT gen_random_uuid()::text, spelling, normalized
FROM (
  SELECT DISTINCT ON (normalized) normalized, spelling
  FROM (
    SELECT lower(regexp_replace(btrim("organization"), '\s+', ' ', 'g')) AS normalized,
           regexp_replace(btrim("organization"), '\s+', ' ', 'g') AS spelling,
           count(*) AS uses
    FROM "CustomerPayroll"
    GROUP BY 1, 2
  ) spellings
  ORDER BY normalized, uses DESC, spelling
) chosen;

ALTER TABLE "CustomerPayroll" ADD COLUMN "organizationId" TEXT;
UPDATE "CustomerPayroll" cp
SET "organizationId" = o."id"
FROM "Organization" o
WHERE o."normalizedName" = lower(regexp_replace(btrim(cp."organization"), '\s+', ' ', 'g'));
ALTER TABLE "CustomerPayroll" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "CustomerPayroll" DROP COLUMN "organization";
CREATE INDEX "CustomerPayroll_organizationId_idx" ON "CustomerPayroll"("organizationId");
ALTER TABLE "CustomerPayroll" ADD CONSTRAINT "CustomerPayroll_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Variation: one organization's month.
CREATE TABLE "Variation" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "filePath" TEXT NOT NULL,
    "noPayrollReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Variation_organizationId_idx" ON "Variation"("organizationId");
CREATE UNIQUE INDEX "Variation_periodId_organizationId_key" ON "Variation"("periodId", "organizationId");
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Voucher: one organization's repayment file for a month, one per variation.
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Voucher_variationId_key" ON "Voucher"("variationId");
CREATE UNIQUE INDEX "Voucher_fileHash_key" ON "Voucher"("fileHash");
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Admin"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PaymentInflow_voucherId_idx" ON "PaymentInflow"("voucherId");
ALTER TABLE "PaymentInflow" ADD CONSTRAINT "PaymentInflow_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- What a variation froze, and what its lock charged or proposed (a revert or a rematch undoes them).
ALTER TABLE "Deduction" ADD COLUMN "variationId" TEXT;
CREATE INDEX "Deduction_variationId_status_idx" ON "Deduction"("variationId", "status");
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MicroLoan" ADD COLUMN "variationId" TEXT;
ALTER TABLE "MicroLoan" ADD CONSTRAINT "MicroLoan_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenureChange" ADD COLUMN "variationId" TEXT;
ALTER TABLE "TenureChange" ADD CONSTRAINT "TenureChange_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
