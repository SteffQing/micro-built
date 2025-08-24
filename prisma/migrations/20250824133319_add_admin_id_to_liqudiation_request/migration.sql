/*
  Warnings:

  - Added the required column `adminId` to the `LiquidationRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LiquidationRequest" ADD COLUMN     "adminId" TEXT NOT NULL;
