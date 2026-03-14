-- Create new enums
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'trial', 'canceled_pending');
CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'quarterly', 'yearly', 'custom');
CREATE TYPE "SubscriptionEventType" AS ENUM ('created', 'status_changed', 'renewal');

-- Update Subscription columns to use enums and add statusChangedAt
ALTER TABLE "Subscription"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SubscriptionStatus" USING "status"::"SubscriptionStatus",
  ALTER COLUMN "status" SET DEFAULT 'active';

ALTER TABLE "Subscription"
  ALTER COLUMN "billingInterval" DROP DEFAULT,
  ALTER COLUMN "billingInterval" TYPE "BillingInterval" USING "billingInterval"::"BillingInterval",
  ALTER COLUMN "billingInterval" SET DEFAULT 'monthly';

ALTER TABLE "Subscription"
  ADD COLUMN     "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create subscription events table
CREATE TABLE "SubscriptionEvent" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "eventType" "SubscriptionEventType" NOT NULL,
  "status" "SubscriptionStatus" NOT NULL,
  "notes" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- Add foreign key relation
ALTER TABLE "SubscriptionEvent"
  ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
