/*
  Warnings:

  - The values [OVERPAID] on the enum `RepaymentStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RepaymentStatus_new" AS ENUM ('AWAITING', 'PARTIAL', 'FULFILLED', 'FAILED', 'MANUAL_RESOLUTION');
ALTER TABLE "Repayment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Repayment" ALTER COLUMN "status" TYPE "RepaymentStatus_new" USING ("status"::text::"RepaymentStatus_new");
ALTER TYPE "RepaymentStatus" RENAME TO "RepaymentStatus_old";
ALTER TYPE "RepaymentStatus_new" RENAME TO "RepaymentStatus";
DROP TYPE "RepaymentStatus_old";
ALTER TABLE "Repayment" ALTER COLUMN "status" SET DEFAULT 'AWAITING';
COMMIT;

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "penaltyAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Repayment" ADD COLUMN     "penaltyCharge" DECIMAL(10,2) NOT NULL DEFAULT 0;
