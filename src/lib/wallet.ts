import { randomUUID } from "node:crypto";
import { TransactionNetwork } from "@prisma/client";
import { prisma } from "@/lib/db";

function defaultWalletAddress(network: TransactionNetwork, userId: string) {
  return `${network.toLowerCase()}_${userId}`;
}

export async function getOrCreateWalletForNetwork(userId: string, network: TransactionNetwork) {
  const existing = await prisma.wallet.findFirst({
    where: { userId, network },
  });

  if (existing) {
    return existing;
  }

  return prisma.wallet.create({
    data: {
      userId,
      network,
      address: defaultWalletAddress(network, randomUUID()),
      balance: "0",
    },
  });
}

export async function getWalletOrFail(userId: string, network: TransactionNetwork, requiredAmount: number) {
  const wallet = await getOrCreateWalletForNetwork(userId, network);
  const balance = Number(wallet.balance);

  if (!Number.isFinite(balance) || balance < requiredAmount) {
    throw new Error(
      `Fondos insuficientes. Necesitas ${requiredAmount.toFixed(6)} ${network} pero tu saldo es ${balance.toFixed(6)}. Deposita fondos desde tu dashboard.`,
    );
  }

  return wallet;
}

export async function debitWallet(walletId: string, amount: number) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
  const currentBalance = Number(wallet.balance);
  const newBalance = Math.max(0, currentBalance - amount);
  return prisma.wallet.update({
    where: { id: walletId },
    data: { balance: newBalance.toFixed(6) },
  });
}

export async function creditWallet(userId: string, network: TransactionNetwork, amount: number) {
  const wallet = await getOrCreateWalletForNetwork(userId, network);
  const currentBalance = Number(wallet.balance);
  const newBalance = currentBalance + amount;
  return prisma.wallet.update({
    where: { id: wallet.id },
    data: { balance: newBalance.toFixed(6) },
  });
}
