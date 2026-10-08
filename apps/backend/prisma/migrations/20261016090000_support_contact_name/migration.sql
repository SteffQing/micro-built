-- A visitor leaves their name with their email or phone when passing a conversation to the team.
ALTER TABLE "SupportConversation" ADD COLUMN "contactName" TEXT;
