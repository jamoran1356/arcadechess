import { prisma } from "@/lib/db";

const PLATFORM_CONFIG_KEY = "default";

export async function getPlatformConfig() {
  const existing = await prisma.platformConfig.findUnique({
    where: { key: PLATFORM_CONFIG_KEY },
  });

  if (existing) {
    return existing;
  }

  return prisma.platformConfig.create({
    data: {
      key: PLATFORM_CONFIG_KEY,
      matchFeeBps: 500,
      betFeeBps: 300,
      arcadeFeeFixed: "0.050000",
      minEntryFee: "0.050000",
      isActive: true,
      notes: "Default platform economics.",
    },
  });
}

export function calculateMatchEntryFee(stakeAmount: number, config: {
  matchFeeBps: number;
  arcadeFeeFixed: { toString(): string } | string;
  minEntryFee: { toString(): string } | string;
}) {
  const percentageFee = (stakeAmount * config.matchFeeBps) / 10_000;
  const arcadeFeeFixed = Number(config.arcadeFeeFixed.toString());
  const minEntryFee = Number(config.minEntryFee.toString());
  return Math.max(minEntryFee, percentageFee + arcadeFeeFixed);
}