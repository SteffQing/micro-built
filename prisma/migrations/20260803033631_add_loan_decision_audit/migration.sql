-- AlterTable
ALTER TABLE "CommodityLoan" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "rejectedById" TEXT;

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT;
