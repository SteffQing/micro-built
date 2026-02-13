/*
  Warnings:

  - You are about to drop the column `penaltyRate` on the `Loan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Loan" DROP COLUMN "penaltyRate",
ADD COLUMN     "penaltyRepaid" DECIMAL(10,2) NOT NULL DEFAULT 0;
