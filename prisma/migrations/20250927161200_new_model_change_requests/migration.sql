/*
  Warnings:

  - You are about to drop the column `documents` on the `UserIdentity` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserIdentity" DROP COLUMN "documents";

-- AlterTable
ALTER TABLE "UserPayroll" ALTER COLUMN "netPay" SET DEFAULT 0,
ALTER COLUMN "grade" DROP NOT NULL,
ALTER COLUMN "step" DROP NOT NULL;
