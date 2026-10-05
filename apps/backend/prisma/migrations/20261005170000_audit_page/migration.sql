-- The super admins' audit page: structured detail on entries (meta), indexes for reading the log
-- by time and by actor, and the admin actions that weren't recorded before.

-- AlterEnum

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SETTINGS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MAINTENANCE_TOGGLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMODITY_ADDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMODITY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_ONBOARDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMERS_IMPORTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DATA_EXPORTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_GENERATED';

-- AlterEnum

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'SETTINGS';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'COMMODITY';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'FILE';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "meta" JSONB;

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

