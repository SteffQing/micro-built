/*
  Warnings:

  - A unique constraint covering the columns `[officialPeriod]` on the table `PayrollSchedule` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "PayrollScheduleStatus" ADD VALUE 'SUPERSEDED';

-- AlterTable
ALTER TABLE "PayrollSchedule" ADD COLUMN     "officialPeriod" TIMESTAMP(3),
ADD COLUMN     "publicationNote" TEXT,
ADD COLUMN     "publishedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PayrollSchedule_officialPeriod_key" ON "PayrollSchedule"("officialPeriod");
