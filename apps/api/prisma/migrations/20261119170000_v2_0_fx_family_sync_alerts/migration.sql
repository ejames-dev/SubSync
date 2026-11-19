ALTER TABLE "UserSettings" ADD COLUMN "webhookUrl" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "smtpPort" INTEGER;
ALTER TABLE "UserSettings" ADD COLUMN "smtpUsername" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "smtpPasswordEnc" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "smtpFrom" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "smtpTo" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "syncFolderPath" TEXT;

ALTER TABLE "Subscription" ADD COLUMN "totalSeats" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "sharedSeats" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "personalShareCents" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "bundleParentId" TEXT;

CREATE TABLE IF NOT EXISTS "ExchangeRate" (
    "currency" TEXT NOT NULL PRIMARY KEY,
    "rateToUsd" REAL NOT NULL,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
