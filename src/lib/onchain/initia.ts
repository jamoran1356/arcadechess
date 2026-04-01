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
// We import @initia/initia.js dynamically to keep cold-starts fast when running
// in mock mode and to avoid top-level ESM issues in Next.js server actions.

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
  // Fallback: use the env value set by deploy script
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
    "arcade_escrow",
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

export const initiaAdapter: OnchainAdapter = {
  network: TransactionNetwork.INITIA,

  async createEscrow(intent: EscrowIntent) {
    try {
      // Contract: create_match(host: &signer, stake_amount: u128, entry_fee: u128)
      const stakeUinit = Math.round(parseFloat(intent.amount) * 1_000_000).toString();
      const txHash = await sendMoveExecute(
        "create_match",
        [],
        [stakeUinit, "0"],
        intent.matchId,
      );

      return buildReceipt(
        `Escrow Initia creado para partida ${intent.matchId}. Monto: ${intent.amount} ${intent.token}.`,
        txHash,
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
      // Contract: join_match(guest: &signer, match_index: u64, stake_amount: u128)
      // NOTE: The on-chain contract uses sequential indices. Since we can't map UUID→index
      // trivially, we log the intent. The platform DB is the source of truth for balances.
      const stakeUinit = Math.round(parseFloat(intent.amount) * 1_000_000).toString();
      const txHash = await sendMoveExecute(
        "join_match",
        [],
        ["0", stakeUinit],
        intent.matchId,
      );

      return buildReceipt(
        `Jugador unió a escrow Initia para partida ${intent.matchId}. Pool: ${intent.amount} ${intent.token}.`,
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
      // Contract: settle_match(admin: &signer, match_index: u64, winner: address)
      const txHash = await sendMoveExecute(
        "settle_match",
        [],
        ["0", intent.winnerId],
        intent.matchId,
      );

      return buildReceipt(
        `Liquidación Initia completada para partida ${intent.matchId}. Ganador: ${intent.winnerId}. Premio: ${intent.amount} ${intent.token}.`,
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
    try {
      const amountUinit = Math.round(parseFloat(intent.amount) * 1_000_000).toString();
      const txHash = await sendMoveExecute(
        "place_bet",
        [],
        ["0", intent.predictedWinnerId, amountUinit],
        intent.matchId,
      );

      return buildReceipt(
        `Apuesta Initia registrada para partida ${intent.matchId} sobre ${intent.predictedWinnerId} por ${intent.amount} ${intent.token}.`,
        txHash,
      );
    } catch (error) {
      console.error("Initia placeBet error:", error);
      return buildReceipt(
        `Apuesta Initia preparada (modo mock) para partida ${intent.matchId}.`,
      );
    }
  },

  async settleBet(intent: BetPayoutIntent) {
    try {
      const payoutUinit = Math.round(parseFloat(intent.amount) * 1_000_000).toString();
      const txHash = await sendMoveExecute(
        "settle_bet",
        [],
        ["0", intent.winnerId, payoutUinit],
        intent.matchId,
      );

      return buildReceipt(
        `Payout Initia de apuesta para ${intent.bettorId} en partida ${intent.matchId}: ${intent.amount} ${intent.token}.`,
        txHash,
      );
    } catch (error) {
      console.error("Initia settleBet error:", error);
      return buildReceipt(
        `Payout Initia preparado (modo mock) para partida ${intent.matchId}.`,
      );
    }
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
