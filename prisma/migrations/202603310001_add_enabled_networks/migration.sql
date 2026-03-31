-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN "enabledNetworks" JSONB NOT NULL DEFAULT '["INITIA"]';
