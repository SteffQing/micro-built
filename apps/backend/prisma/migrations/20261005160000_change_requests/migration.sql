-- Changes to a customer's identity/payment method and to anyone's profile wait for an admin's
-- approval (ChangeRequest). Deciding one is audited.

-- CreateEnum
CREATE TYPE "ChangeRequestKind" AS ENUM ('IDENTITY', 'PAYMENT_METHOD', 'PROFILE');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CHANGE_REQUEST_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CHANGE_REQUEST_REJECTED';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'CHANGE_REQUEST';

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ChangeRequestKind" NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "proposed" JSONB NOT NULL,
    "previous" JSONB NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeRequest_status_kind_createdAt_idx" ON "ChangeRequest"("status", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeRequest_userId_createdAt_idx" ON "ChangeRequest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Admin"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

