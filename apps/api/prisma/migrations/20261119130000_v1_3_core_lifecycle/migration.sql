ALTER TABLE "Service" ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN "customIntervalDays" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "trialEndsAt" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "postTrialAmountCents" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "leadTimeDaysOverride" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "tagsJson" TEXT;
