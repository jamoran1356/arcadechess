-- Add new arcade game types to the ArcadeGameType enum
ALTER TYPE "ArcadeGameType" ADD VALUE IF NOT EXISTS 'MAZE_RUNNER';
ALTER TYPE "ArcadeGameType" ADD VALUE IF NOT EXISTS 'PING_PONG';
ALTER TYPE "ArcadeGameType" ADD VALUE IF NOT EXISTS 'REACTION_DUEL';
