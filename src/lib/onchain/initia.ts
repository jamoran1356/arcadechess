import { TransactionNetwork } from "@prisma/client";
import { BetIntent, BetPayoutIntent, EscrowIntent, OnchainAdapter, OnchainReceipt, SettlementIntent } from "./types";

// ─── Config ──────────────────────────────────────────────────────────────────
const REST_URL = process.env.NEXT_PUBLIC_INITIA_RPC || "https://rest.testnet.initia.xyz";
const CHAIN_ID = process.env.NEXT_PUBLIC_INITIA_CHAIN_ID || "initiation-2";
const ADMIN_SEED = process.env.INITIA_ADMIN_SEED || "";
const EXPLORER_BASE = `https://scan.testnet.initia.xyz/${CHAIN_ID}`;

// Derived at module-init time from ADMIN_SEED (matches deploy script output)
let _moduleAddress: string | null = null;

function isConfigured(): boolean {
  return Boolean(ADMIN_SEED);
}

// ─── Lazy-loaded SDK singletons ──────────────────────────────────────────────
type InitiaSDK = typeof import("@initia/initia.js");
let _sdk: InitiaSDK | null = null;
let _wallet: InstanceType<InitiaSDK["Wallet"]> | null = null;

async function getSDK() {
  if (_sdk) return _sdk;
  _sdk = await import("@initia/initia.js");
  return _sdk;
}

async function getWallet() {
  if (_wallet) return _wallet;
  const { RESTClient, MnemonicKey, Wallet } = await getSDK();
  const rest = new RESTClient(REST_URL, {
    chainId: CHAIN_ID,
    gasPrices: "0.15uinit",
    gasAdjustment: "1.75",
  });
  const key = new MnemonicKey({ mnemonic: ADMIN_SEED.trim(), coinType: 60 });
  _wallet = new Wallet(rest, key);
  _moduleAddress = key.accAddress;
  return _wallet;
}

function getModuleAddress(): string {
  if (_moduleAddress) return _moduleAddress;
  return process.env.NEXT_PUBLIC_INITIA_ADMIN_ADDRESS || "";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildReceipt(
  description: string,
  transactionHash?: string,
): OnchainReceipt {
  const hash = transactionHash || `initia_mock_${Date.now().toString(36)}`;
  return {
    network: TransactionNetwork.INITIA,
    txHash: hash,
    explorerUrl: isConfigured() ? `${EXPLORER_BASE}/txs/${hash}` : undefined,
    mode: isConfigured() ? "configured" : "mock",
    description,
  };
}

/**
 * Execute a Move entry function on-chain via the admin wallet.
 * Falls back to mock if INITIA_ADMIN_SEED is missing.
 */
async function sendMoveExecute(
  functionName: string,
  typeArgs: string[],
  args: string[],
  label: string,
): Promise<string> {
  if (!isConfigured()) {
    return `mock_initia_${label}_${Date.now().toString(36)}`;
  }

  const { MsgExecute } = await getSDK();
  const wallet = await getWallet();
  const senderAddr = getModuleAddress();

  const msg = new MsgExecute(
    senderAddr,
    getModuleAddress(),
    "arcade_escrow_v2",
    functionName,
    typeArgs,
    args,
  );

  const signedTx = await wallet.createAndSignTx({
    msgs: [msg],
    memo: `playchess::${functionName} ${label}`,
  });

  const result = await (wallet as unknown as { rest: { tx: { broadcast(tx: unknown): Promise<{ txhash: string; code: number; raw_log?: string }> } } }).rest.tx.broadcast(signedTx);

  if (result.code !== 0) {
    throw new Error(`Initia tx failed (code ${result.code}): ${result.raw_log ?? "unknown"}`);
  }

  return result.txhash;
}

// ─── On-chain match index tracking ──────────────────────────────────────────
// The contract uses sequential match indices starting from 1.
// We track the next index locally so we can map DB matchId → on-chain index.
let _nextMatchIndex: number | null = null;

async function getNextMatchIndex(): Promise<number> {
  if (_nextMatchIndex !== null) return _nextMatchIndex;
  try {
    const moduleAddr = getModuleAddress();
    const res = await fetch(
      `${REST_URL}/initia/move/v1/accounts/${moduleAddr}/modules/arcade_escrow_v2/view_functions/get_match_count`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: [] }),
      },
    );
    if (res.ok) {
      const data = (await res.json()) as { data?: string };
      _nextMatchIndex = parseInt(data.data ?? "0", 10);
      return _nextMatchIndex;
    }
  } catch { /* fall through */ }
  _nextMatchIndex = 0;
  return 0;
}

// ─── Standalone on-chain settlement helpers (draw / refund) ─────────────────
// These call contract entry functions not in the OnchainAdapter interface.

/**
 * Call settle_draw on-chain — refunds both players from vault.
 * match_index must map to the on-chain index (0-based).
 */
export async function initiaSettleDrawOnchain(matchIndex: number, label: string): Promise<string | null> {
  try {
    return await sendMoveExecute(
      "settle_draw",
      [],
      [matchIndex.toString()],
      `draw_${label}`,
    );
  } catch (error) {
    console.error("Initia settle_draw on-chain error:", error);
    return null;
  }
}

/**
 * Call refund_match on-chain — cancels and refunds deposits from vault.
 */
export async function initiaRefundMatchOnchain(matchIndex: number, label: string): Promise<string | null> {
  try {
    return await sendMoveExecute(
      "refund_match",
      [],
      [matchIndex.toString()],
      `refund_${label}`,
    );
  } catch (error) {
    console.error("Initia refund_match on-chain error:", error);
    return null;
  }
}

export const initiaAdapter: OnchainAdapter = {
  network: TransactionNetwork.INITIA,

  async createEscrow(intent: EscrowIntent) {
    try {
      const stakeUinit = Math.round(parseFloat(intent.amount) * 1_000_000);
      const hostAddress = intent.actorWallet || "";

      // 1. Create match record on-chain
      const matchIndex = await getNextMatchIndex();
      const txHash1 = await sendMoveExecute(
        "create_match",
        [],
        [hostAddress, stakeUinit.toString(), "0"],
        `create_${intent.matchId}`,
      );

      // 2. Deposit host's stake from admin treasury to vault
      if (stakeUinit > 0) {
        await sendMoveExecute(
          "deposit_funds",
          [],
          [matchIndex.toString(), hostAddress, stakeUinit.toString()],
          `deposit_host_${intent.matchId}`,
        );
      }

      _nextMatchIndex = matchIndex + 1;

      return buildReceipt(
        `Escrow Initia creado (match #${matchIndex}). Host: ${hostAddress}. Monto: ${intent.amount} ${intent.token}. Fondos custodiados en vault.`,
        txHash1,
      );
    } catch (error) {
      console.error("Initia createEscrow error:", error);
      return buildReceipt(
        `Escrow Initia preparado (modo mock) para partida ${intent.matchId}.`,
      );
    }
  },

  async joinEscrow(intent: EscrowIntent) {
    try {
      const stakeUinit = Math.round(parseFloat(intent.amount) * 1_000_000);
      const guestAddress = intent.actorWallet || "";

      // Deposit guest's stake to vault (match should already exist)
      // The match_index needs to come from the match metadata
      const matchIndex = await getNextMatchIndex() - 1; // latest match
      const txHash = await sendMoveExecute(
        "deposit_funds",
        [],
        [matchIndex.toString(), guestAddress, stakeUinit.toString()],
        `deposit_guest_${intent.matchId}`,
      );

      return buildReceipt(
        `Guest unió a escrow Initia (match #${matchIndex}). Depósito: ${intent.amount} ${intent.token} custodiado en vault.`,
        txHash,
      );
    } catch (error) {
      console.error("Initia joinEscrow error:", error);
      return buildReceipt(
        `Unión a escrow Initia preparada (modo mock) para partida ${intent.matchId}.`,
      );
    }
  },

  async settleEscrow(intent: SettlementIntent) {
    try {
      const prizeUinit = Math.round(parseFloat(intent.amount) * 1_000_000);
      // settle_to_winner(admin, match_index, winner, prize_amount)
      // 6-layer validation happens on-chain in the contract
      const txHash = await sendMoveExecute(
        "settle_to_winner",
        [],
        ["0", intent.winnerId, prizeUinit.toString()],
        `settle_${intent.matchId}`,
      );

      return buildReceipt(
        `Liquidación Initia completada on-chain. Ganador: ${intent.winnerId}. Premio: ${intent.amount} ${intent.token} transferido desde vault.`,
        txHash,
      );
    } catch (error) {
      console.error("Initia settleEscrow error:", error);
      return buildReceipt(
        `Liquidación Initia preparada (modo mock) para partida ${intent.matchId}.`,
      );
    }
  },

  async placeBet(intent: BetIntent) {
    // Bets remain DB-only for now — on-chain betting planned for v2
    return buildReceipt(
      `Apuesta registrada (DB) para partida ${intent.matchId} sobre ${intent.predictedWinnerId} por ${intent.amount} ${intent.token}.`,
    );
  },

  async settleBet(intent: BetPayoutIntent) {
    // Bets remain DB-only for now
    return buildReceipt(
      `Payout de apuesta (DB) para ${intent.bettorId} en partida ${intent.matchId}: ${intent.amount} ${intent.token}.`,
    );
  },

  async queryBalance(address: string, denom = "uinit") {
    const LCD_URL = process.env.NEXT_PUBLIC_INITIA_RPC || "https://rest.testnet.initia.xyz";
    const FALLBACK_LCD = "https://rest.testnet.initia.xyz";

    for (const baseUrl of [LCD_URL, ...(LCD_URL !== FALLBACK_LCD ? [FALLBACK_LCD] : [])]) {
      try {
        const response = await fetch(
          `${baseUrl}/cosmos/bank/v1beta1/balances/${encodeURIComponent(address)}`,
          { next: { revalidate: 15 } },
        );
        if (!response.ok) {
          console.error(`Initia LCD error (${baseUrl}): ${response.status} ${response.statusText}`);
          continue;
        }
        const data = (await response.json()) as { balances?: Array<{ denom: string; amount: string }> };
        const coin = data.balances?.find((b) => b.denom === denom);
        const microAmount = Number(coin?.amount ?? "0");
        return { amount: microAmount / 1_000_000, denom: "INIT" };
      } catch (error) {
        console.error(`Initia queryBalance error (${baseUrl}):`, error);
        continue;
      }
    }

    return null;
  },
};
