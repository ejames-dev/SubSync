-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "nextRenewalReminderSent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "channels" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
