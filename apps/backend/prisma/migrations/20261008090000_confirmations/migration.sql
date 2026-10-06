-- Gated admin actions are confirmed with an authenticator code or a passkey; super admins reset users' sign-in.
CREATE TYPE "ConfirmationMethod" AS ENUM ('TOTP', 'PASSKEY');

ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_ROLE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'SIGN_IN_RESET';

CREATE TABLE "Confirmation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "method" "ConfirmationMethod",
    "challenge" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Confirmation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Confirmation_sessionId_confirmedAt_idx" ON "Confirmation"("sessionId", "confirmedAt");
CREATE INDEX "Confirmation_expiresAt_idx" ON "Confirmation"("expiresAt");

ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
