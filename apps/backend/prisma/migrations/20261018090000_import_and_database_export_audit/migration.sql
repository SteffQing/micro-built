-- A customer import is audited from upload to its result (CUSTOMER_IMPORT), and super admins can export the
-- whole database (DATABASE): requested, delivered or failed.
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_IMPORT_FINISHED';
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_IMPORT_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'DATABASE_EXPORT_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'DATABASE_EXPORT_DELIVERED';
ALTER TYPE "AuditAction" ADD VALUE 'DATABASE_EXPORT_FAILED';
ALTER TYPE "AuditEntityType" ADD VALUE 'CUSTOMER_IMPORT';
ALTER TYPE "AuditEntityType" ADD VALUE 'DATABASE';
