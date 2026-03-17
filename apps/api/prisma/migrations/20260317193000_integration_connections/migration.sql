CREATE TABLE IF NOT EXISTS "IntegrationConnection" (
    "providerId" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntegrationConnection_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
