/*
  Warnings:

  - You are about to drop the column `verified` on the `UserIdentity` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "flagReason" TEXT;

-- AlterTable
ALTER TABLE "UserIdentity" DROP COLUMN "verified";
