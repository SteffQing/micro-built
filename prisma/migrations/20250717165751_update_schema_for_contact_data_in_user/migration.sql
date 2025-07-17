/*
  Warnings:

  - You are about to drop the column `contact` on the `UserIdentity` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `UserIdentity` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `UserIdentity` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `UserIdentity` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[contact]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserIdentity_contact_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contact" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserIdentity" DROP COLUMN "contact",
DROP COLUMN "firstName",
DROP COLUMN "lastName",
DROP COLUMN "verified";

-- CreateIndex
CREATE UNIQUE INDEX "User_contact_key" ON "User"("contact");
