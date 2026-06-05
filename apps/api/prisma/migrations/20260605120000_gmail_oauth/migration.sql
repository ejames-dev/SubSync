CREATE TABLE IF NOT EXISTS "GmailConnection" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "email" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "tokenExpiry" DATETIME,
    "scopes" TEXT NOT NULL,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "OAuthState" (
    "state" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "ProcessedGmailMessage" (
    "messageId" TEXT NOT NULL PRIMARY KEY,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
