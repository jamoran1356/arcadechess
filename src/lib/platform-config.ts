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
}) {
  return (stakeAmount * config.matchFeeBps) / 10_000;
}