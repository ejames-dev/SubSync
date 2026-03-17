CREATE TABLE IF NOT EXISTS "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadTimeDays" INTEGER NOT NULL,
    "notificationChannels" TEXT NOT NULL
);
