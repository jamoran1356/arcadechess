-- AlterTable: change rating default from 1200 to 0
ALTER TABLE "User" ALTER COLUMN "rating" SET DEFAULT 0;

-- AlterTable: add ban system columns
ALTER TABLE "User" ADD COLUMN "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "banReason" TEXT;
