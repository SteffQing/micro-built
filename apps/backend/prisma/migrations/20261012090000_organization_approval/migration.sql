-- New organizations named by an admin or marketer wait for a super admin (existing ones are ACTIVE).
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'PENDING');

ALTER TABLE "Organization" ADD COLUMN "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "requestedById" TEXT;

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Admin"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_APPROVED';
