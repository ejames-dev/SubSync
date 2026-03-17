ALTER TABLE "Subscription"
  ADD COLUMN "statusChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "SubscriptionEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEvent_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
