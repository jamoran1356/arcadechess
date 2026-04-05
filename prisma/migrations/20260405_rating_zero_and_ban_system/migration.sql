-- AlterTable: change rating default from 1200 to 0
ALTER TABLE "User" ALTER COLUMN "rating" SET DEFAULT 0;

-- AlterTable: add ban system columns (IF NOT EXISTS for idempotency)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banReason" TEXT;
