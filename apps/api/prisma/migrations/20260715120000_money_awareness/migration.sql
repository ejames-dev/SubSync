ALTER TABLE "Service" ADD COLUMN "cancelUrl" TEXT;

ALTER TABLE "UserSettings" ADD COLUMN "monthlyBudgetCents" INTEGER;
ALTER TABLE "UserSettings" ADD COLUMN "budgetCurrency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "UserSettings" ADD COLUMN "budgetAlertTriggered" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SubscriptionEvent" ADD COLUMN "previousAmountCents" INTEGER;
ALTER TABLE "SubscriptionEvent" ADD COLUMN "previousCurrency" TEXT;
ALTER TABLE "SubscriptionEvent" ADD COLUMN "amountCents" INTEGER;
ALTER TABLE "SubscriptionEvent" ADD COLUMN "currency" TEXT;

CREATE TABLE "_new_PendingNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingNotification_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "_new_PendingNotification" (
    "id",
    "subscriptionId",
    "channel",
    "title",
    "body",
    "deliveredAt",
    "createdAt"
)
SELECT
    "id",
    "subscriptionId",
    "channel",
    "title",
    "body",
    "deliveredAt",
    "createdAt"
FROM "PendingNotification";

DROP TABLE "PendingNotification";
ALTER TABLE "_new_PendingNotification" RENAME TO "PendingNotification";
