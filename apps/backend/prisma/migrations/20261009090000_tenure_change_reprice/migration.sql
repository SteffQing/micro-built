-- AlterTable
ALTER TABLE "TenureChange" ADD COLUMN     "interestAdded" DECIMAL(18,2),
ADD COLUMN     "reprice" BOOLEAN NOT NULL DEFAULT false;
