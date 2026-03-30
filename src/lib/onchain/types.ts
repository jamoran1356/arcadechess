import { TransactionNetwork } from "@prisma/client";

export type SupportedNetwork = TransactionNetwork;

export type EscrowIntent = {
  matchId: string;
  actorId: string;
  actorWallet?: string;
  amount: string;
  token: string;
};

export type SettlementIntent = {
  matchId: string;
  winnerId: string;
  amount: string;
  token: string;
};

export type BetIntent = {
  matchId: string;
  bettorId: string;
  predictedWinnerId: string;
  amount: string;
  token: string;
};

export type BetPayoutIntent = {
  matchId: string;
  bettorId: string;
  winnerId: string;
  predictedWinnerId: string;
  amount: string;
  token: string;
};

export type OnchainReceipt = {
  network: SupportedNetwork;
  txHash: string;
  explorerUrl?: string;
  mode: "mock" | "configured";
  description: string;
};

export interface OnchainAdapter {
  network: SupportedNetwork;
  createEscrow(intent: EscrowIntent): Promise<OnchainReceipt>;
  joinEscrow(intent: EscrowIntent): Promise<OnchainReceipt>;
  settleEscrow(intent: SettlementIntent): Promise<OnchainReceipt>;
  placeBet(intent: BetIntent): Promise<OnchainReceipt>;
  settleBet(intent: BetPayoutIntent): Promise<OnchainReceipt>;
}
