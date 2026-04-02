import { TransactionNetwork } from "@prisma/client";
import { BetIntent, BetPayoutIntent, CancelRefundIntent, DrawRefundIntent, EscrowIntent, OnchainAdapter, OnchainReceipt, SettlementIntent } from "./types";

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

// ─── BCS encoding helpers (Move args must be BCS-serialized base64) ─────────

async function bcsAddress(addr: string): Promise<string> {
  const { bcs } = await getSDK();
  return bcs.address().serialize(addr).toBase64();
}

async function bcsU64(val: number | bigint): Promise<string> {
  const { bcs } = await getSDK();
  return bcs.u64().serialize(val).toBase64();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildReceipt(
  description: string,
  transactionHash?: string,
  onchainMatchIndex?: number,
): OnchainReceipt {
  const hash = transactionHash || `initia_mock_${Date.now().toString(36)}`;
  return {
    network: TransactionNetwork.INITIA,
    txHash: hash,
    explorerUrl: isConfigured() ? `${EXPLORER_BASE}/txs/${hash}` : undefined,
    mode: isConfigured() ? "configured" : "mock",
    description,
    onchainMatchIndex,
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
// The contract uses sequential match indices (0-based in the vector).
// We query the contract to get the current count, which becomes the next index.

async function getNextMatchIndex(): Promise<number> {
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
      // API returns quoted numbers like "\"3\"" — strip non-digits
      const raw = String(data.data ?? "0").replace(/[^0-9]/g, "");
      return parseInt(raw, 10) || 0;
    }
  } catch { /* fall through */ }
  return 0;
}

export const initiaAdapter: OnchainAdapter = {
  network: TransactionNetwork.INITIA,

  async createEscrow(intent: EscrowIntent) {
    try {
      const stakeUinit = Math.round(parseFloat(intent.amount) * 1_000_000);
      const hostAddress = intent.actorWallet || "";

      // Query the current match count — this becomes the 0-based index for the new match
      const matchIndex = await getNextMatchIndex();

      // 1. Create match record on-chain (args must be BCS-encoded)
      const txHash1 = await sendMoveExecute(
        "create_match",
        [],
        [await bcsAddress(hostAddress), await bcsU64(stakeUinit), await bcsU64(0)],
        `create_${intent.matchId}`,
      );

      // 2. Deposit host's stake from admin treasury to vault
      if (stakeUinit > 0) {
        await sendMoveExecute(
          "deposit_funds",
          [],
          [await bcsU64(matchIndex), await bcsAddress(hostAddress), await bcsU64(stakeUinit)],
          `deposit_host_${intent.matchId}`,
        );
      }

      return buildReceipt(
        `Escrow Initia creado (match #${matchIndex}). Host: ${hostAddress}. Monto: ${intent.amount} ${intent.token}. Fondos custodiados en vault.`,
        txHash1,
        matchIndex,
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
      const matchIndex = intent.onchainMatchIndex ?? null;

      if (matchIndex === null) {
        console.warn("joinEscrow: no onchainMatchIndex provided, skipping on-chain deposit");
        return buildReceipt(
          `Join escrow Initia (sin index on-chain) para partida ${intent.matchId}.`,
        );
      }

      const txHash = await sendMoveExecute(
        "deposit_funds",
        [],
        [await bcsU64(matchIndex), await bcsAddress(guestAddress), await bcsU64(stakeUinit)],
        `deposit_guest_${intent.matchId}`,
      );

      return buildReceipt(
        `Guest unio a escrow Initia (match #${matchIndex}). Deposito: ${intent.amount} ${intent.token} custodiado en vault.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Initia joinEscrow error:", error);
      return buildReceipt(
        `Union a escrow Initia preparada (modo mock) para partida ${intent.matchId}.`,
      );
    }
  },

  async settleEscrow(intent: SettlementIntent) {
    const matchIndex = intent.onchainMatchIndex;

    // If no on-chain index, the match was never created on-chain — skip
    if (matchIndex === null || matchIndex === undefined) {
      console.warn(`settleEscrow: no onchainMatchIndex for match ${intent.matchId}, settlement is DB-only`);
      return buildReceipt(
        `Liquidacion Initia (DB-only) para partida ${intent.matchId}. Ganador: ${intent.winnerId}.`,
      );
    }

    if (!intent.winnerAddress) {
      console.error(`settleEscrow: no winnerAddress for match ${intent.matchId}`);
      return buildReceipt(
        `Liquidacion Initia (sin wallet ganador) para partida ${intent.matchId}.`,
      );
    }

    try {
      const prizeUinit = Math.round(parseFloat(intent.amount) * 1_000_000);
      // settle_to_winner(admin, match_index, winner_address, prize_amount)
      const txHash = await sendMoveExecute(
        "settle_to_winner",
        [],
        [await bcsU64(matchIndex), await bcsAddress(intent.winnerAddress), await bcsU64(prizeUinit)],
        `settle_${intent.matchId}`,
      );

      return buildReceipt(
        `Liquidacion Initia on-chain completada. Match #${matchIndex}. Ganador: ${intent.winnerAddress}. Premio: ${intent.amount} ${intent.token}.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Initia settleEscrow on-chain error:", error);
      // Even if on-chain fails, we still return a receipt so DB settlement proceeds
      return buildReceipt(
        `Liquidacion Initia fallida on-chain (match #${matchIndex}). Error registrado. DB settlement procede.`,
      );
    }
  },

  async settleDrawOnchain(intent: DrawRefundIntent) {
    const matchIndex = intent.onchainMatchIndex;
    if (matchIndex === null || matchIndex === undefined) {
      return buildReceipt(`Draw refund Initia (DB-only) para partida ${intent.matchId}.`);
    }
    try {
      const txHash = await sendMoveExecute(
        "settle_draw",
        [],
        [await bcsU64(matchIndex)],
        `draw_${intent.matchId}`,
      );
      return buildReceipt(
        `Draw refund Initia on-chain completado. Match #${matchIndex}.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Initia settle_draw on-chain error:", error);
      return buildReceipt(`Draw refund Initia fallido on-chain (match #${matchIndex}).`);
    }
  },

  async refundMatchOnchain(intent: CancelRefundIntent) {
    const matchIndex = intent.onchainMatchIndex;
    if (matchIndex === null || matchIndex === undefined) {
      return buildReceipt(`Cancel refund Initia (DB-only) para partida ${intent.matchId}.`);
    }
    try {
      const txHash = await sendMoveExecute(
        "refund_match",
        [],
        [await bcsU64(matchIndex)],
        `refund_${intent.matchId}`,
      );
      return buildReceipt(
        `Cancel refund Initia on-chain completado. Match #${matchIndex}.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Initia refund_match on-chain error:", error);
      return buildReceipt(`Cancel refund Initia fallido on-chain (match #${matchIndex}).`);
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
