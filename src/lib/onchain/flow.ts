import { TransactionNetwork } from "@prisma/client";
import { EscrowIntent, OnchainAdapter, OnchainReceipt, SettlementIntent } from "./types";

function buildReceipt(description: string): OnchainReceipt {
  const configured = Boolean(process.env.FLOW_ACCESS_NODE);
  const txHash = `flow_${Date.now().toString(36)}`;

  return {
    network: TransactionNetwork.FLOW,
    txHash,
    explorerUrl: configured ? `${process.env.FLOW_ACCESS_NODE}/tx/${txHash}` : undefined,
    mode: configured ? "configured" : "mock",
    description,
  };
}

export const flowAdapter: OnchainAdapter = {
  network: TransactionNetwork.FLOW,
  async createEscrow(intent: EscrowIntent) {
    return buildReceipt(`Escrow Flow creado para ${intent.matchId}.`);
  },
  async joinEscrow(intent: EscrowIntent) {
    return buildReceipt(`Jugador unido a escrow Flow para ${intent.matchId}.`);
  },
  async settleEscrow(intent: SettlementIntent) {
    return buildReceipt(`Liquidacion Flow preparada para ${intent.matchId} y ganador ${intent.winnerId}.`);
  },
};
