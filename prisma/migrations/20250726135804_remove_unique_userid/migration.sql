/*
  Warnings:

  - The values [ACCEPTED] on the enum `LoanStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[accountNumber]` on the table `UserPaymentMethod` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LoanStatus_new" AS ENUM ('PENDING', 'PREVIEW', 'REJECTED', 'APPROVED', 'DISBURSED', 'REPAID');
ALTER TABLE "Loan" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Loan" ALTER COLUMN "status" TYPE "LoanStatus_new" USING ("status"::text::"LoanStatus_new");
ALTER TYPE "LoanStatus" RENAME TO "LoanStatus_old";
ALTER TYPE "LoanStatus_new" RENAME TO "LoanStatus";
DROP TYPE "LoanStatus_old";
ALTER TABLE "Loan" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "UserIdentity" DROP CONSTRAINT "UserIdentity_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserPaymentMethod" DROP CONSTRAINT "UserPaymentMethod_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserPayroll" DROP CONSTRAINT "UserPayroll_userId_fkey";

-- DropIndex
DROP INDEX "CommodityLoan_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "UserPaymentMethod_accountNumber_key" ON "UserPaymentMethod"("accountNumber");

-- AddForeignKey
ALTER TABLE "UserPayroll" ADD CONSTRAINT "UserPayroll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("externalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPaymentMethod" ADD CONSTRAINT "UserPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
