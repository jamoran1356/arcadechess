-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ARCADE_PENDING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionNetwork" AS ENUM ('INITIA', 'FLOW', 'SOLANA');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('ENTRY_STAKE', 'ESCROW_LOCK', 'PRIZE_PAYOUT', 'BRIDGE_SYNC');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SETTLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ArcadeGameType" AS ENUM ('TARGET_RUSH', 'MEMORY_GRID', 'KEY_CLASH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "network" "TransactionNetwork" NOT NULL,
    "address" TEXT NOT NULL,
    "balance" TEXT NOT NULL DEFAULT '0',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "token" TEXT NOT NULL DEFAULT 'INIT',
    "features" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "boardTheme" TEXT NOT NULL DEFAULT 'arena',
    "stakeAmount" DECIMAL(18,6) NOT NULL,
    "stakeToken" TEXT NOT NULL DEFAULT 'INIT',
    "entryFee" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "preferredNetwork" "TransactionNetwork" NOT NULL DEFAULT 'INITIA',
    "fen" TEXT NOT NULL,
    "turn" TEXT NOT NULL DEFAULT 'w',
    "moveHistory" JSONB NOT NULL,
    "arcadeGamePool" JSONB NOT NULL,
    "isSolo" BOOLEAN NOT NULL DEFAULT false,
    "gameClockMs" INTEGER NOT NULL DEFAULT 300000,
    "status" "MatchStatus" NOT NULL DEFAULT 'OPEN',
    "hostId" TEXT NOT NULL,
    "guestId" TEXT,
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchBet" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "network" "TransactionNetwork" NOT NULL,
    "predictedWinnerId" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "payoutAmount" DECIMAL(18,6),
    "token" TEXT NOT NULL DEFAULT 'INIT',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "txHash" TEXT,
    "payoutTxHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "MatchBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArcadeDuel" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "attackerId" TEXT NOT NULL,
    "defenderId" TEXT NOT NULL,
    "gameType" "ArcadeGameType" NOT NULL,
    "seed" TEXT NOT NULL,
    "boardMove" JSONB NOT NULL,
    "attackerScore" INTEGER,
    "defenderScore" INTEGER,
    "winnerId" TEXT,
    "attackerEnteredAt" TIMESTAMP(3),
    "defenderEnteredAt" TIMESTAMP(3),
    "participationPenalty" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArcadeDuel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArcadeGame" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "gameType" "ArcadeGameType" NOT NULL,
    "baseScore" INTEGER NOT NULL DEFAULT 1000,
    "difficultyMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "contractAddresses" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArcadeGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT,
    "network" "TransactionNetwork" NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(18,6) NOT NULL,
    "token" TEXT NOT NULL DEFAULT 'INIT',
    "txHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_network_address_key" ON "Wallet"("network", "address");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "MatchBet_matchId_status_idx" ON "MatchBet"("matchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MatchBet_matchId_userId_key" ON "MatchBet"("matchId", "userId");

-- CreateIndex
CREATE INDEX "ArcadeDuel_matchId_resolvedAt_idx" ON "ArcadeDuel"("matchId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArcadeGame_gameType_key" ON "ArcadeGame"("gameType");

-- CreateIndex
CREATE INDEX "Transaction_network_status_idx" ON "Transaction"("network", "status");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchBet" ADD CONSTRAINT "MatchBet_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchBet" ADD CONSTRAINT "MatchBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcadeDuel" ADD CONSTRAINT "ArcadeDuel_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcadeDuel" ADD CONSTRAINT "ArcadeDuel_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcadeDuel" ADD CONSTRAINT "ArcadeDuel_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcadeDuel" ADD CONSTRAINT "ArcadeDuel_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;


