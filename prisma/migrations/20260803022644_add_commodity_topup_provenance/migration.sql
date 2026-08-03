-- AlterTable
ALTER TABLE "CommodityLoan" ADD COLUMN     "targetObligationId" TEXT,
ADD COLUMN     "type" "LoanType" NOT NULL DEFAULT 'New';

-- CreateIndex
CREATE INDEX "CommodityLoan_targetObligationId_idx" ON "CommodityLoan"("targetObligationId");

-- AddForeignKey
ALTER TABLE "CommodityLoan" ADD CONSTRAINT "CommodityLoan_targetObligationId_fkey" FOREIGN KEY ("targetObligationId") REFERENCES "RepaymentObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
