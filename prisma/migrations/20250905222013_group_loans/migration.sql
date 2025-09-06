-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "activeLoanId" TEXT;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_activeLoanId_fkey" FOREIGN KEY ("activeLoanId") REFERENCES "ActiveLoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
