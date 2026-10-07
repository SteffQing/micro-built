-- Organizations page: adding, renaming and deleting an organization are audited.
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_RENAMED';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_DELETED';
