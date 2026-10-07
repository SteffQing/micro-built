-- CreateEnum
CREATE TYPE "CalloutKind" AS ENUM ('EDUCATION', 'INSIGHT', 'PRODUCT', 'ANNOUNCEMENT', 'STATISTIC', 'BRAND');

-- CreateEnum
CREATE TYPE "CalloutAudience" AS ENUM ('CUSTOMER', 'MARKETER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "CalloutStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CALLOUT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CALLOUT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CALLOUT_DELETED';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'CALLOUT';

-- CreateTable
CREATE TABLE "Callout" (
    "id" TEXT NOT NULL,
    "kind" "CalloutKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "highlight" TEXT,
    "audience" "CalloutAudience"[],
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" "CalloutStatus" NOT NULL DEFAULT 'DRAFT',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Callout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Callout_status_priority_idx" ON "Callout"("status", "priority");

-- AddForeignKey
ALTER TABLE "Callout" ADD CONSTRAINT "Callout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

