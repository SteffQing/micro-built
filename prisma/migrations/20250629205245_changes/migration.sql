/*
  Warnings:

  - You are about to drop the column `managementFee` on the `Loan` table. All the data in the column will be lost.
  - Made the column `userId` on table `CommodityLoan` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `managementFeeRate` to the `Loan` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CommodityLoan" DROP CONSTRAINT "CommodityLoan_userId_fkey";

-- AlterTable
ALTER TABLE "CommodityLoan" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Loan" DROP COLUMN "managementFee",
ADD COLUMN     "managementFeeRate" DECIMAL(5,4) NOT NULL;

-- AlterTable
ALTER TABLE "UserPayroll" ADD COLUMN     "repaymentRate" INTEGER NOT NULL DEFAULT 100;

-- AddForeignKey
ALTER TABLE "CommodityLoan" ADD CONSTRAINT "CommodityLoan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
