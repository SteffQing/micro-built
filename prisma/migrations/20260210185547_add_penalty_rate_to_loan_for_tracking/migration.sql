/*
  Warnings:

  - You are about to drop the column `verified` on the `UserIdentity` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "penaltyRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "repayable" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "flagReason" TEXT;

-- AlterTable
ALTER TABLE "UserIdentity" DROP COLUMN "verified";
