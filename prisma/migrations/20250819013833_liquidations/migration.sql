/*
  Warnings:

  - You are about to drop the `LiquidationRequestLoan` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LiquidationRequestLoan" DROP CONSTRAINT "LiquidationRequestLoan_liquidationRequestId_fkey";

-- DropForeignKey
ALTER TABLE "LiquidationRequestLoan" DROP CONSTRAINT "LiquidationRequestLoan_loanId_fkey";

-- AlterTable
ALTER TABLE "LiquidationRequest" ADD COLUMN     "penalize" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Repayment" ADD COLUMN     "liquidationRequestId" TEXT;

-- DropTable
DROP TABLE "LiquidationRequestLoan";

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_liquidationRequestId_fkey" FOREIGN KEY ("liquidationRequestId") REFERENCES "LiquidationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
