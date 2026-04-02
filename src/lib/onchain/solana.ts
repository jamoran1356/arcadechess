import { TransactionNetwork } from "@prisma/client";
import { BetIntent, BetPayoutIntent, CancelRefundIntent, DrawRefundIntent, EscrowIntent, OnchainAdapter, OnchainReceipt, SettlementIntent } from "./types";

function buildReceipt(description: string): OnchainReceipt {
  const configured = Boolean(process.env.SOLANA_RPC_URL);
  const txHash = `sol_${Date.now().toString(36)}`;

  return {
    network: TransactionNetwork.SOLANA,
    txHash,
    explorerUrl: configured ? `${process.env.SOLANA_RPC_URL}/tx/${txHash}` : undefined,
    mode: configured ? "configured" : "mock",
    description,
  };
}

export const solanaAdapter: OnchainAdapter = {
  network: TransactionNetwork.SOLANA,
  async createEscrow(intent: EscrowIntent) {
    return buildReceipt(`Escrow Solana creado para ${intent.matchId}.`);
  },
  async joinEscrow(intent: EscrowIntent) {
    return buildReceipt(`Jugador unido a escrow Solana para ${intent.matchId}.`);
  },
  async settleEscrow(intent: SettlementIntent) {
    return buildReceipt(`Liquidacion Solana preparada para ${intent.matchId} y ganador ${intent.winnerId}.`);
  },
  async settleDrawOnchain(intent: DrawRefundIntent) {
    return buildReceipt(`Draw refund Solana para ${intent.matchId}.`);
  },
  async refundMatchOnchain(intent: CancelRefundIntent) {
    return buildReceipt(`Cancel refund Solana para ${intent.matchId}.`);
  },
  async placeBet(intent: BetIntent) {
    return buildReceipt(`Apuesta Solana registrada para ${intent.matchId} sobre ${intent.predictedWinnerId}.`);
  },
  async settleBet(intent: BetPayoutIntent) {
    return buildReceipt(`Payout Solana de apuesta para ${intent.bettorId} en ${intent.matchId}.`);
  },
  async queryBalance(_address: string, _denom?: string) {
    return { amount: 0, denom: "SOL" };
  },
};
