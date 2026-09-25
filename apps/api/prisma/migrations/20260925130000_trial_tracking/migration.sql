ALTER TABLE "Subscription" ADD COLUMN "trialEndsAt" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "trialReminderSent" BOOLEAN NOT NULL DEFAULT false;
