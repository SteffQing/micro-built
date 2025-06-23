/*
  Warnings:

  - You are about to drop the column `contact` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[contact]` on the table `UserIdentity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `contact` to the `UserIdentity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `UserIdentity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `UserIdentity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `UserIdentity` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('Female', 'Male');

-- DropIndex
DROP INDEX "User_contact_key";

-- DropIndex
DROP INDEX "User_id_key";

-- DropIndex
DROP INDEX "UserIdentity_userId_key";

-- DropIndex
DROP INDEX "UserPaymentMethod_userId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "contact",
DROP COLUMN "name",
ADD COLUMN     "avatar" TEXT;

-- AlterTable
ALTER TABLE "UserIdentity" ADD COLUMN     "contact" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "gender" "Gender" NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_contact_key" ON "UserIdentity"("contact");
