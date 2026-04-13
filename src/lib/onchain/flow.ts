import { TransactionNetwork } from "@prisma/client";
import {
  BetIntent,
  BetPayoutIntent,
  CancelRefundIntent,
  DrawRefundIntent,
  EscrowIntent,
  OnchainAdapter,
  OnchainReceipt,
  SettlementIntent,
} from "./types";

// ─── Config ──────────────────────────────────────────────────────────────────
const ACCESS_NODE = process.env.NEXT_PUBLIC_FLOW_RPC || "https://rest-testnet.onflow.org";
const NETWORK = process.env.NEXT_PUBLIC_FLOW_CHAIN_ID || "testnet";
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FLOW_CONTRACT_ADDRESS || "";
const ADMIN_PRIVATE_KEY = (process.env.FLOW_ADMIN_PRIVATE_KEY || "").replace(/^0x/, "");
const EXPLORER_BASE = "https://testnet.flowscan.io";

// Flow standard contract addresses (testnet / mainnet)
const FLOW_TOKEN_ADDRESS = NETWORK === "mainnet" ? "0x1654653399040a61" : "0x7e60df042a9c0868";
const FUNGIBLE_TOKEN_ADDRESS = NETWORK === "mainnet" ? "0xf233dcee88fe0abe" : "0x9a0766d93b6608b7";

function isConfigured(): boolean {
  return Boolean(ADMIN_PRIVATE_KEY && CONTRACT_ADDRESS && ADMIN_PRIVATE_KEY !== "abc123def456ghi789jkl000");
}

// Admin address = contract address on Flow (contract deployed to admin account)
function getAdminAddress(): string {
  return CONTRACT_ADDRESS;
}

// ─── Lazy-loaded FCL singleton ───────────────────────────────────────────────
type FCL = typeof import("@onflow/fcl");
let _fcl: FCL | null = null;

async function getFCL(): Promise<FCL> {
  if (_fcl) return _fcl;
  _fcl = await import("@onflow/fcl");
  _fcl.config({
    "flow.network": NETWORK,
    "accessNode.api": ACCESS_NODE,
  });
  return _fcl;
}

// ─── ECDSA P-256 + SHA3-256 signing (Flow default) ──────────────────────────
// Flow requires: hash the message (hex) with SHA3-256, then sign with ECDSA P-256.
// Returns r || s as hex (64 bytes total).

async function signMessage(privateKeyHex: string, messageHex: string): Promise<string> {
  const { ec: EC } = await import("elliptic");
  const { SHA3 } = await import("sha3");

  const p256 = new EC("p256");
  const key = p256.keyFromPrivate(Buffer.from(privateKeyHex, "hex"));

  const sha = new SHA3(256);
  sha.update(Buffer.from(messageHex, "hex"));
  const digest = sha.digest();

  const sig = key.sign(digest);
  const n = 32;
  const r = sig.r.toArrayLike(Buffer, "be", n);
  const s = sig.s.toArrayLike(Buffer, "be", n);
  return Buffer.concat([r, s]).toString("hex");
}

// ─── Server-side authorization function ──────────────────────────────────────

function getAdminAuthorization() {
  const adminAddr = getAdminAddress();
  const keyIndex = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (account: any) => {
    return {
      ...account,
      tempId: `${adminAddr}-${keyIndex}`,
      addr: adminAddr.replace(/^0x/, ""),
      keyId: keyIndex,
      signingFunction: async (signable: { message: string }) => ({
        addr: adminAddr,
        keyId: keyIndex,
        signature: await signMessage(ADMIN_PRIVATE_KEY, signable.message),
      }),
    };
  };
}

// ─── Cadence transaction templates ───────────────────────────────────────────

function txCreateMatch(): string {
  return `
import ArcadeEscrowV2 from ${CONTRACT_ADDRESS}

transaction(host: Address, stakePerPlayer: UFix64, entryFee: UFix64) {
  let admin: &ArcadeEscrowV2.Admin

  prepare(signer: auth(BorrowValue) &Account) {
    self.admin = signer.storage.borrow<&ArcadeEscrowV2.Admin>(from: /storage/ArcadeEscrowV2Admin)
      ?? panic("Admin resource not found")
  }

  execute {
    self.admin.createMatch(host: host, stakePerPlayer: stakePerPlayer, entryFee: entryFee)
  }
}
`;
}

function txDepositFunds(): string {
  return `
import ArcadeEscrowV2 from ${CONTRACT_ADDRESS}
import FlowToken from ${FLOW_TOKEN_ADDRESS}
import FungibleToken from ${FUNGIBLE_TOKEN_ADDRESS}

transaction(matchIndex: UInt64, player: Address, amount: UFix64) {
  let admin: &ArcadeEscrowV2.Admin
  let payment: @{FungibleToken.Vault}

  prepare(signer: auth(BorrowValue) &Account) {
    self.admin = signer.storage.borrow<&ArcadeEscrowV2.Admin>(from: /storage/ArcadeEscrowV2Admin)
      ?? panic("Admin resource not found")

    let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
      ?? panic("Could not borrow FlowToken vault")

    self.payment = vaultRef.withdraw(amount: amount)
  }

  execute {
    self.admin.depositFunds(matchIndex: matchIndex, player: player, payment: <-self.payment)
  }
}
`;
}

function txSettleToWinner(): string {
  return `
import ArcadeEscrowV2 from ${CONTRACT_ADDRESS}

transaction(matchIndex: UInt64, winner: Address, prizeAmount: UFix64) {
  let admin: &ArcadeEscrowV2.Admin

  prepare(signer: auth(BorrowValue) &Account) {
    self.admin = signer.storage.borrow<&ArcadeEscrowV2.Admin>(from: /storage/ArcadeEscrowV2Admin)
      ?? panic("Admin resource not found")
  }

  execute {
    self.admin.settleToWinner(matchIndex: matchIndex, winner: winner, prizeAmount: prizeAmount)
  }
}
`;
}

function txSettleDraw(): string {
  return `
import ArcadeEscrowV2 from ${CONTRACT_ADDRESS}

transaction(matchIndex: UInt64) {
  let admin: &ArcadeEscrowV2.Admin

  prepare(signer: auth(BorrowValue) &Account) {
    self.admin = signer.storage.borrow<&ArcadeEscrowV2.Admin>(from: /storage/ArcadeEscrowV2Admin)
      ?? panic("Admin resource not found")
  }

  execute {
    self.admin.settleDraw(matchIndex: matchIndex)
  }
}
`;
}

function txRefundMatch(): string {
  return `
import ArcadeEscrowV2 from ${CONTRACT_ADDRESS}

transaction(matchIndex: UInt64) {
  let admin: &ArcadeEscrowV2.Admin

  prepare(signer: auth(BorrowValue) &Account) {
    self.admin = signer.storage.borrow<&ArcadeEscrowV2.Admin>(from: /storage/ArcadeEscrowV2Admin)
      ?? panic("Admin resource not found")
  }

  execute {
    self.admin.refundMatch(matchIndex: matchIndex)
  }
}
`;
}

// ─── Cadence scripts ─────────────────────────────────────────────────────────

function scriptGetMatchCount(): string {
  return `
import ArcadeEscrowV2 from ${CONTRACT_ADDRESS}

access(all) fun main(): UInt64 {
  return ArcadeEscrowV2.getMatchCount()
}
`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildReceipt(
  description: string,
  txHash?: string,
  onchainMatchIndex?: number,
  settled = true,
): OnchainReceipt {
  const hash = txHash || `flow_mock_${Date.now().toString(36)}`;
  return {
    network: TransactionNetwork.FLOW,
    txHash: hash,
    explorerUrl: isConfigured() ? `${EXPLORER_BASE}/tx/${hash}` : undefined,
    mode: isConfigured() ? "configured" : "mock",
    settled,
    description,
    onchainMatchIndex,
  };
}

/** Send a Cadence transaction via FCL mutate, signed by the admin key. */
async function sendTransaction(
  cadence: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: (arg: any, t: any) => any[],
  label: string,
): Promise<string> {
  if (!isConfigured()) {
    return `flow_mock_${label}_${Date.now().toString(36)}`;
  }

  const fcl = await getFCL();
  const authz = getAdminAuthorization();

  const txId = await fcl.mutate({
    cadence,
    args,
    proposer: authz,
    payer: authz,
    authorizations: [authz],
    limit: 999,
  });

  // Wait for transaction to be sealed
  await fcl.tx(txId).onceSealed();

  return txId;
}

/** Query the contract for the current match count (next match index). */
async function getNextMatchIndex(): Promise<number> {
  if (!isConfigured()) return 0;
  try {
    const fcl = await getFCL();
    const result = await fcl.query({
      cadence: scriptGetMatchCount(),
    });
    return parseInt(String(result ?? "0"), 10) || 0;
  } catch {
    return 0;
  }
}

/** Format a number as UFix64 string (e.g. "1.50000000"). */
function toUFix64(value: number): string {
  return value.toFixed(8);
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export const flowAdapter: OnchainAdapter = {
  network: TransactionNetwork.FLOW,

  async createEscrow(intent: EscrowIntent) {
    if (!isConfigured()) {
      return buildReceipt(`Escrow Flow preparado (modo mock) para partida ${intent.matchId}.`);
    }

    try {
      const totalFlow = parseFloat(intent.amount);
      const stakeFlow = intent.stakeAmount ? parseFloat(intent.stakeAmount) : totalFlow;
      const feeFlow = intent.entryFee ? parseFloat(intent.entryFee) : 0;
      const hostAddress = intent.actorWallet || getAdminAddress();

      const matchIndex = await getNextMatchIndex();

      const { default: t } = await import("@onflow/types");

      // 1. Create match on-chain
      const txHash = await sendTransaction(
        txCreateMatch(),
        (arg) => [
          arg(hostAddress, t.Address),
          arg(toUFix64(stakeFlow), t.UFix64),
          arg(toUFix64(feeFlow), t.UFix64),
        ],
        `create_${intent.matchId}`,
      );

      // 2. Deposit host funds
      if (totalFlow > 0) {
        await sendTransaction(
          txDepositFunds(),
          (arg) => [
            arg(String(matchIndex), t.UInt64),
            arg(hostAddress, t.Address),
            arg(toUFix64(totalFlow), t.UFix64),
          ],
          `deposit_host_${intent.matchId}`,
        );
      }

      return buildReceipt(
        `Escrow Flow creado (match #${matchIndex}). Host: ${hostAddress}. Monto: ${intent.amount} FLOW.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Flow createEscrow error:", error);
      return buildReceipt(
        `Escrow Flow preparado (modo mock) para partida ${intent.matchId}.`,
        undefined,
        undefined,
        false,
      );
    }
  },

  async joinEscrow(intent: EscrowIntent) {
    if (!isConfigured()) {
      return buildReceipt(`Join escrow Flow (mock) para partida ${intent.matchId}.`);
    }

    try {
      const amountFlow = parseFloat(intent.amount);
      const guestAddress = intent.actorWallet || "";
      const matchIndex = intent.onchainMatchIndex ?? null;

      if (matchIndex === null) {
        return buildReceipt(`Join escrow Flow (sin index) para partida ${intent.matchId}.`);
      }

      if (amountFlow <= 0) {
        return buildReceipt(`Join escrow Flow (monto 0) para partida ${intent.matchId}.`);
      }

      const { default: t } = await import("@onflow/types");

      const txHash = await sendTransaction(
        txDepositFunds(),
        (arg) => [
          arg(String(matchIndex), t.UInt64),
          arg(guestAddress, t.Address),
          arg(toUFix64(amountFlow), t.UFix64),
        ],
        `deposit_guest_${intent.matchId}`,
      );

      return buildReceipt(
        `Guest unio a escrow Flow (match #${matchIndex}). Deposito: ${intent.amount} FLOW.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Flow joinEscrow error:", error);
      return buildReceipt(
        `Join escrow Flow fallido para partida ${intent.matchId}.`,
        undefined,
        undefined,
        false,
      );
    }
  },

  async settleEscrow(intent: SettlementIntent) {
    const matchIndex = intent.onchainMatchIndex;

    if (matchIndex === null || matchIndex === undefined) {
      return buildReceipt(
        `Liquidacion Flow (DB-only) para partida ${intent.matchId}.`,
        undefined,
        undefined,
        false,
      );
    }

    if (!isConfigured()) {
      return buildReceipt(`Liquidacion Flow (mock) para partida ${intent.matchId}.`);
    }

    if (!intent.winnerAddress) {
      return buildReceipt(
        `Liquidacion Flow (sin wallet ganador) para partida ${intent.matchId}.`,
        undefined,
        undefined,
        false,
      );
    }

    try {
      const prizeFlow = parseFloat(intent.amount);
      if (prizeFlow <= 0) {
        return buildReceipt(
          `Liquidacion Flow (premio 0) para partida ${intent.matchId}.`,
          undefined,
          matchIndex,
          false,
        );
      }

      const { default: t } = await import("@onflow/types");

      const txHash = await sendTransaction(
        txSettleToWinner(),
        (arg) => [
          arg(String(matchIndex), t.UInt64),
          arg(intent.winnerAddress, t.Address),
          arg(toUFix64(prizeFlow), t.UFix64),
        ],
        `settle_${intent.matchId}`,
      );

      return buildReceipt(
        `Liquidacion Flow completada. Match #${matchIndex}. Ganador: ${intent.winnerAddress}. Premio: ${intent.amount} FLOW.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Flow settleEscrow error:", error);
      return buildReceipt(
        `Liquidacion Flow fallida (match #${matchIndex}).`,
        undefined,
        matchIndex,
        false,
      );
    }
  },

  async settleDrawOnchain(intent: DrawRefundIntent) {
    const matchIndex = intent.onchainMatchIndex;
    if (matchIndex === null || matchIndex === undefined) {
      return buildReceipt(`Draw refund Flow (DB-only) para partida ${intent.matchId}.`, undefined, undefined, false);
    }

    if (!isConfigured()) {
      return buildReceipt(`Draw refund Flow (mock) para partida ${intent.matchId}.`);
    }

    try {
      const { default: t } = await import("@onflow/types");

      const txHash = await sendTransaction(
        txSettleDraw(),
        (arg) => [arg(String(matchIndex), t.UInt64)],
        `draw_${intent.matchId}`,
      );

      return buildReceipt(
        `Draw refund Flow completado. Match #${matchIndex}.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Flow settle_draw error:", error);
      return buildReceipt(`Draw refund Flow fallido (match #${matchIndex}).`, undefined, matchIndex, false);
    }
  },

  async refundMatchOnchain(intent: CancelRefundIntent) {
    const matchIndex = intent.onchainMatchIndex;
    if (matchIndex === null || matchIndex === undefined) {
      return buildReceipt(`Cancel refund Flow (DB-only) para partida ${intent.matchId}.`, undefined, undefined, false);
    }

    if (!isConfigured()) {
      return buildReceipt(`Cancel refund Flow (mock) para partida ${intent.matchId}.`);
    }

    try {
      const { default: t } = await import("@onflow/types");

      const txHash = await sendTransaction(
        txRefundMatch(),
        (arg) => [arg(String(matchIndex), t.UInt64)],
        `refund_${intent.matchId}`,
      );

      return buildReceipt(
        `Cancel refund Flow completado. Match #${matchIndex}.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Flow refund_match error:", error);
      return buildReceipt(`Cancel refund Flow fallido (match #${matchIndex}).`, undefined, matchIndex, false);
    }
  },

  async placeBet(intent: BetIntent) {
    const matchIndex = intent.onchainMatchIndex;
    const amountFlow = parseFloat(intent.amount);

    if (matchIndex === null || matchIndex === undefined || amountFlow <= 0 || !isConfigured()) {
      return buildReceipt(
        `Apuesta registrada (DB-only) para partida ${intent.matchId} sobre ${intent.predictedWinnerId} por ${intent.amount} FLOW.`,
      );
    }

    try {
      const bettorAddr = intent.bettorWallet || "";
      const { default: t } = await import("@onflow/types");

      const txHash = await sendTransaction(
        txDepositFunds(),
        (arg) => [
          arg(String(matchIndex), t.UInt64),
          arg(bettorAddr, t.Address),
          arg(toUFix64(amountFlow), t.UFix64),
        ],
        `bet_${intent.matchId}_${intent.bettorId}`,
      );

      return buildReceipt(
        `Apuesta on-chain depositada. Match #${matchIndex}. Apostador: ${bettorAddr}. Monto: ${intent.amount} FLOW.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Flow placeBet error:", error);
      return buildReceipt(
        `Apuesta fallida on-chain (match #${matchIndex}).`,
        undefined,
        matchIndex,
        false,
      );
    }
  },

  async settleBet(intent: BetPayoutIntent) {
    return buildReceipt(
      `Payout de apuesta (DB) para ${intent.bettorId} en partida ${intent.matchId}: ${intent.amount} ${intent.token}.`,
    );
  },

  async queryBalance(address: string, _denom = "FLOW") {
    try {
      const res = await fetch(
        `${ACCESS_NODE}/v1/accounts/${encodeURIComponent(address)}`,
        { next: { revalidate: 15 } },
      );
      if (!res.ok) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await res.json()) as any;
      // Flow REST API returns balance in "UFix64" string (e.g. "100.00000000") or raw integer
      const rawBalance = data?.balance ?? "0";
      // Balance from Flow REST is in 1e-8 units (like UFix64)
      const amount = typeof rawBalance === "string"
        ? parseFloat(rawBalance) / 1e8
        : Number(rawBalance) / 1e8;
      return { amount, denom: "FLOW" };
    } catch (error) {
      console.error("Flow queryBalance error:", error);
      return null;
    }
  },
};
