/*
  Warnings:

  - You are about to drop the column `penalize` on the `LiquidationRequest` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `Loan` table. All the data in the column will be lost.
  - You are about to drop the column `extension` on the `Loan` table. All the data in the column will be lost.
  - You are about to drop the column `loanTenure` on the `Loan` table. All the data in the column will be lost.
  - You are about to drop the column `penaltyAmount` on the `Loan` table. All the data in the column will be lost.
  - Added the required column `amountBorrowed` to the `Loan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LiquidationRequest" DROP COLUMN "penalize";

-- AlterTable
ALTER TABLE "Loan" DROP COLUMN "amount",
DROP COLUMN "extension",
DROP COLUMN "loanTenure",
DROP COLUMN "penaltyAmount",
ADD COLUMN     "amountBorrowed" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "tenure" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ActiveLoan" (
    "id" TEXT NOT NULL,
    "amountRepayable" DECIMAL(10,2) NOT NULL,
    "amountRepaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "penaltyAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "disbursementDate" TIMESTAMP(3) NOT NULL,
    "tenure" INTEGER NOT NULL,
    "isNew" BOOLEAN NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiveLoan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActiveLoan_userId_key" ON "ActiveLoan"("userId");

-- CreateIndex
CREATE INDEX "Repayment_userId_loanId_period_idx" ON "Repayment"("userId", "loanId", "period");

-- AddForeignKey
ALTER TABLE "ActiveLoan" ADD CONSTRAINT "ActiveLoan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
