/*
  Warnings:

  - Added the required column `description` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LiquidationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "Repayment" DROP CONSTRAINT "Repayment_userId_fkey";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "callToActionUrl" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Repayment" ADD COLUMN     "resolutionNote" TEXT;

-- CreateTable
CREATE TABLE "LiquidationRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "LiquidationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "LiquidationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidationRequestLoan" (
    "id" TEXT NOT NULL,
    "liquidationRequestId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amountAllocated" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "LiquidationRequestLoan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidationRequest" ADD CONSTRAINT "LiquidationRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidationRequestLoan" ADD CONSTRAINT "LiquidationRequestLoan_liquidationRequestId_fkey" FOREIGN KEY ("liquidationRequestId") REFERENCES "LiquidationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidationRequestLoan" ADD CONSTRAINT "LiquidationRequestLoan_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
