/*
  Warnings:

  - The values [ASSET] on the enum `LoanType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `interestRate` on the `Loan` table. All the data in the column will be lost.
  - You are about to drop the column `lateFeeRate` on the `Loan` table. All the data in the column will be lost.
  - You are about to drop the column `revenue` on the `Loan` table. All the data in the column will be lost.
  - You are about to drop the column `method` on the `Repayment` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `Repayment` table. All the data in the column will be lost.
  - You are about to drop the column `reference` on the `Repayment` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Repayment` table. All the data in the column will be lost.
  - The primary key for the `UserIdentity` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `firstName` on the `UserIdentity` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `UserIdentity` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `UserIdentity` table. All the data in the column will be lost.
  - You are about to drop the `Settings` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[externalId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `loanTenure` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `command` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `grade` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `netPay` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodInDT` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `step` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Made the column `userId` on table `UserIdentity` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LoanType_new" AS ENUM ('CASH', 'COMMODITY');
ALTER TABLE "Loan" ALTER COLUMN "loanType" DROP DEFAULT;
ALTER TABLE "Loan" ALTER COLUMN "loanType" TYPE "LoanType_new" USING ("loanType"::text::"LoanType_new");
ALTER TYPE "LoanType" RENAME TO "LoanType_old";
ALTER TYPE "LoanType_new" RENAME TO "LoanType";
DROP TYPE "LoanType_old";
ALTER TABLE "Loan" ALTER COLUMN "loanType" SET DEFAULT 'CASH';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'VIEW_ADMIN';

-- DropForeignKey
ALTER TABLE "Settings" DROP CONSTRAINT "Settings_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserIdentity" DROP CONSTRAINT "UserIdentity_userId_fkey";

-- AlterTable
ALTER TABLE "Loan" DROP COLUMN "interestRate",
DROP COLUMN "lateFeeRate",
DROP COLUMN "revenue",
ADD COLUMN     "loanTenure" INTEGER NOT NULL,
ALTER COLUMN "dueDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Repayment" DROP COLUMN "method",
DROP COLUMN "paidAt",
DROP COLUMN "reference",
DROP COLUMN "status",
ADD COLUMN     "command" TEXT NOT NULL,
ADD COLUMN     "grade" TEXT NOT NULL,
ADD COLUMN     "netPay" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "period" TEXT NOT NULL,
ADD COLUMN     "periodInDT" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "step" INTEGER NOT NULL,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "UserIdentity" DROP CONSTRAINT "UserIdentity_pkey",
DROP COLUMN "firstName",
DROP COLUMN "id",
DROP COLUMN "lastName",
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "dateOfBirth" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET NOT NULL,
ADD CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("userId");

-- DropTable
DROP TABLE "Settings";

-- CreateTable
CREATE TABLE "UserPaymentMethod" (
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,

    CONSTRAINT "UserPaymentMethod_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPaymentMethod_userId_key" ON "UserPaymentMethod"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPaymentMethod" ADD CONSTRAINT "UserPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("externalId") ON DELETE SET NULL ON UPDATE CASCADE;
