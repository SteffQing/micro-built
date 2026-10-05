-- Admin prompts name what they are about, so they can be cleared once it is acted on.
ALTER TABLE "Notification" ADD COLUMN "subject" TEXT;
CREATE INDEX "Notification_subject_idx" ON "Notification"("subject");
