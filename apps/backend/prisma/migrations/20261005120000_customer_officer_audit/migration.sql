-- Assigning a customer to an account officer (or back to the platform) is audited.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_OFFICER_CHANGED';
