-- Admins propose identity, bank and payroll changes for customers; a super admin decides them.
ALTER TYPE "ChangeRequestKind" ADD VALUE 'PAYROLL';
ALTER TYPE "AuditAction" ADD VALUE 'CHANGE_REQUEST_PROPOSED';

ALTER TABLE "ChangeRequest" ADD COLUMN "requestedById" TEXT;

ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "Admin"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
