/*
  Warnings:

  - You are about to drop the column `dueDate` on the `Loan` table. All the data in the column will be lost.
  - Added the required column `repayable` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `repaid` to the `Repayment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Loan" DROP COLUMN "dueDate",
ADD COLUMN     "extension" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "repayable" DECIMAL(10,2) NOT NULL;

-- AlterTable
ALTER TABLE "Repayment" ADD COLUMN     "repaid" DECIMAL(10,2) NOT NULL;
