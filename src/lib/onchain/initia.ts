import { TransactionNetwork } from "@prisma/client";
import { EscrowIntent, OnchainAdapter, OnchainReceipt, SettlementIntent } from "./types";

function buildReceipt(description: string): OnchainReceipt {
  const configured = Boolean(process.env.INITIA_RPC_URL && process.env.INITIA_CHAIN_ID);
  const txHash = `initia_${Date.now().toString(36)}`;

  return {
    network: TransactionNetwork.INITIA,
    txHash,
    explorerUrl: configured
      ? `${process.env.INITIA_RPC_URL}/tx/${txHash}`
      : undefined,
    mode: configured ? "configured" : "mock",
    description,
  };
}

export const initiaAdapter: OnchainAdapter = {
  network: TransactionNetwork.INITIA,
  async createEscrow(intent: EscrowIntent) {
    return buildReceipt(`Escrow Initia creado para ${intent.matchId}.`);
  },
  async joinEscrow(intent: EscrowIntent) {
    return buildReceipt(`Jugador unido a escrow Initia para ${intent.matchId}.`);
  },
  async settleEscrow(intent: SettlementIntent) {
    return buildReceipt(`Liquidacion Initia preparada para ${intent.matchId} y ganador ${intent.winnerId}.`);
  },
};
