/*
  Warnings:

  - You are about to drop the column `employer` on the `UserPayroll` table. All the data in the column will be lost.
  - You are about to drop the column `forceNumber` on the `UserPayroll` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Repayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `UserPayroll` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Repayment" DROP CONSTRAINT "Repayment_loanId_fkey";

-- DropForeignKey
ALTER TABLE "Repayment" DROP CONSTRAINT "Repayment_userId_fkey";

-- AlterTable
ALTER TABLE "Repayment" ADD COLUMN     "failureNote" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "expectedAmount" SET DEFAULT 0,
ALTER COLUMN "repaidAmount" SET DEFAULT 0,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "loanId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserPayroll" DROP COLUMN "employer",
DROP COLUMN "forceNumber",
ADD COLUMN     "employeeGross" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("externalId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
