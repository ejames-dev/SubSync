ALTER TABLE "Subscription" ADD COLUMN "importKey" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "lastImportedAt" DATETIME;

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_importKey_key"
ON "Subscription"("importKey");

CREATE TABLE IF NOT EXISTS "EmailReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "sender" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "parserId" TEXT,
    "parserVersion" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "overallConfidence" INTEGER NOT NULL DEFAULT 0,
    "bodyHash" TEXT NOT NULL,
    "bodySnapshot" TEXT,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailReceipt_externalMessageId_key"
ON "EmailReceipt"("externalMessageId");
CREATE INDEX IF NOT EXISTS "EmailReceipt_status_receivedAt_idx"
ON "EmailReceipt"("status", "receivedAt");

CREATE TABLE IF NOT EXISTS "EmailReceiptItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "serviceId" TEXT,
    "subscriptionId" TEXT,
    "providerName" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "renewalDate" DATETIME NOT NULL,
    "paymentSource" TEXT,
    "paymentLast4" TEXT,
    "confidence" INTEGER NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'review',
    "evidenceJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "EmailReceipt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailReceiptItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailReceiptItem_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EmailReceiptItem_receiptId_idx"
ON "EmailReceiptItem"("receiptId");
CREATE INDEX IF NOT EXISTS "EmailReceiptItem_action_confidence_idx"
ON "EmailReceiptItem"("action", "confidence");
