-- DropForeignKey
ALTER TABLE "Loan" DROP CONSTRAINT "Loan_activeLoanId_fkey";

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "closureDate" TIMESTAMP(3);
