/*
  Warnings:

  - You are about to drop the column `repaymentRate` on the `UserPayroll` table. All the data in the column will be lost.
  - Added the required column `landmarkOrBusStop` to the `UserIdentity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maritalStatus` to the `UserIdentity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nextOfKinAddress` to the `UserIdentity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nextOfKinRelationship` to the `UserIdentity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employer` to the `UserPayroll` table without a default value. This is not possible if the table is not empty.
  - Added the required column `forceNumber` to the `UserPayroll` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('Single', 'Married', 'Divorced', 'Widowed');

-- CreateEnum
CREATE TYPE "Relationship" AS ENUM ('Spouse', 'Parent', 'Child', 'Sibling', 'Other');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "repaymentRate" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "UserIdentity" ADD COLUMN     "landmarkOrBusStop" TEXT NOT NULL,
ADD COLUMN     "maritalStatus" "MaritalStatus" NOT NULL,
ADD COLUMN     "nextOfKinAddress" TEXT NOT NULL,
ADD COLUMN     "nextOfKinRelationship" "Relationship" NOT NULL;

-- AlterTable
ALTER TABLE "UserPayroll" DROP COLUMN "repaymentRate",
ADD COLUMN     "employer" TEXT NOT NULL,
ADD COLUMN     "forceNumber" TEXT NOT NULL;
