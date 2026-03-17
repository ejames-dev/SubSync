CREATE TABLE IF NOT EXISTS "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supportsOAuth" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT
);

CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "billingAmountCents" INTEGER NOT NULL,
    "billingCurrency" TEXT NOT NULL,
    "billingInterval" TEXT NOT NULL,
    "nextRenewal" DATETIME NOT NULL,
    "paymentSource" TEXT,
    "paymentLast4" TEXT,
    "autoImportSource" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "Service" ("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Subscription_serviceId_idx"
ON "Subscription" ("serviceId");
