import { TransactionNetwork } from "@prisma/client";

export type SupportedNetwork = TransactionNetwork;

export type EscrowIntent = {
  matchId: string;
  actorId: string;
  actorWallet?: string;
  onchainMatchIndex?: number | null;
  amount: string;
  token: string;
  stakeAmount?: string;
  entryFee?: string;
};

export type SettlementIntent = {
  matchId: string;
  winnerId: string;
  winnerAddress: string;
  onchainMatchIndex: number | null;
  amount: string;
  token: string;
};

export type DrawRefundIntent = {
  matchId: string;
  onchainMatchIndex: number | null;
};

export type CancelRefundIntent = {
  matchId: string;
  onchainMatchIndex: number | null;
};

export type BetIntent = {
  matchId: string;
  bettorId: string;
  bettorWallet?: string;
  predictedWinnerId: string;
  amount: string;
  token: string;
  onchainMatchIndex?: number | null;
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
  settled: boolean;
  description: string;
  onchainMatchIndex?: number;
};

export interface OnchainAdapter {
  network: SupportedNetwork;
  createEscrow(intent: EscrowIntent): Promise<OnchainReceipt>;
  joinEscrow(intent: EscrowIntent): Promise<OnchainReceipt>;
  settleEscrow(intent: SettlementIntent): Promise<OnchainReceipt>;
  settleDrawOnchain(intent: DrawRefundIntent): Promise<OnchainReceipt>;
  refundMatchOnchain(intent: CancelRefundIntent): Promise<OnchainReceipt>;
  placeBet(intent: BetIntent): Promise<OnchainReceipt>;
  settleBet(intent: BetPayoutIntent): Promise<OnchainReceipt>;
  /** Query on-chain balance for a wallet address. Returns human-readable amount (e.g. INIT not uinit). Returns null on failure. */
  queryBalance(address: string, denom?: string): Promise<{ amount: number; denom: string } | null>;
}
