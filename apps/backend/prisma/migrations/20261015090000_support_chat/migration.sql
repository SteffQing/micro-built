-- CreateEnum
CREATE TYPE "SupportAudience" AS ENUM ('ANONYMOUS', 'CUSTOMER', 'MARKETER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('AI', 'HANDOFF', 'ASSIGNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportRole" AS ENUM ('USER', 'AI', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SupportRating" AS ENUM ('UP', 'DOWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SUPPORT_CLAIMED';
ALTER TYPE "AuditAction" ADD VALUE 'SUPPORT_CLOSED';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'SUPPORT_CONVERSATION';

-- CreateTable
CREATE TABLE "SupportConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "visitorId" TEXT,
    "audience" "SupportAudience" NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'AI',
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "assigneeId" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requesterUnread" BOOLEAN NOT NULL DEFAULT false,
    "staffUnread" BOOLEAN NOT NULL DEFAULT false,
    "handedOffAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "SupportRole" NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "toolNames" TEXT[],
    "guard" JSONB,
    "offerHandoff" BOOLEAN NOT NULL DEFAULT false,
    "rating" "SupportRating",
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportConversation_userId_lastMessageAt_idx" ON "SupportConversation"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "SupportConversation_visitorId_lastMessageAt_idx" ON "SupportConversation"("visitorId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "SupportConversation_status_handedOffAt_idx" ON "SupportConversation"("status", "handedOffAt");

-- CreateIndex
CREATE INDEX "SupportMessage_conversationId_createdAt_idx" ON "SupportMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

