-- Reconcile existing databases where 202603300001_init was already marked as applied.
-- This migration is idempotent and safe for both existing and fresh environments.

-- Match clock columns (solo/bullet timers)
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "whiteClockMs" INTEGER NOT NULL DEFAULT 300000;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "blackClockMs" INTEGER NOT NULL DEFAULT 300000;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "turnStartedAt" TIMESTAMP(3);

UPDATE "Match"
SET
  "whiteClockMs" = COALESCE("whiteClockMs", "gameClockMs"),
  "blackClockMs" = COALESCE("blackClockMs", "gameClockMs"),
  "turnStartedAt" = CASE
    WHEN "status" = 'IN_PROGRESS' AND "turnStartedAt" IS NULL THEN COALESCE("updatedAt", CURRENT_TIMESTAMP)
    ELSE "turnStartedAt"
  END;

-- Platform fee configuration table
CREATE TABLE IF NOT EXISTS "PlatformConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "matchFeeBps" INTEGER NOT NULL DEFAULT 500,
    "betFeeBps" INTEGER NOT NULL DEFAULT 300,
    "arcadeFeeFixed" DECIMAL(18,6) NOT NULL DEFAULT 0.050000,
    "minEntryFee" DECIMAL(18,6) NOT NULL DEFAULT 0.050000,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformConfig_key_key" ON "PlatformConfig"("key");

INSERT INTO "PlatformConfig" (
  "id",
  "key",
  "matchFeeBps",
  "betFeeBps",
  "arcadeFeeFixed",
  "minEntryFee",
  "isActive",
  "updatedAt"
)
VALUES (
  'platform-config-default',
  'default',
  500,
  300,
  0.050000,
  0.050000,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

-- Default admin user seed
INSERT INTO "User" (
  "id",
  "name",
  "email",
  "passwordHash",
  "role",
  "rating",
  "createdAt",
  "updatedAt"
)
VALUES (
  'admin_seed_playchess',
  'PlayChess Admin',
  'admin@playchess.gg',
  '$2b$10$ADhHWcFYo0rwCd1qRhJwsef8Fs9CSa8gIpOCI80fltMSpUwYClsnS',
  'ADMIN'::"UserRole",
  1200,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO NOTHING;
