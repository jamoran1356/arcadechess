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
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

// ─── Config ────────────────────────────────────────────────────────────────
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
const PROGRAM_ID_STR = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID || "";
const PAYER_KEYPAIR_JSON = process.env.SOLANA_PAYER_KEYPAIR || "";
const EXPLORER_BASE = "https://explorer.solana.com";
const CLUSTER_SUFFIX = "?cluster=devnet";

const VAULT_SEED = Buffer.from("vault");

function isConfigured(): boolean {
  return Boolean(PAYER_KEYPAIR_JSON && PROGRAM_ID_STR && PROGRAM_ID_STR !== "11111111111111111111111111111111");
}

// ─── Lazy-loaded singletons ────────────────────────────────────────────────
let _connection: Connection | null = null;
let _adminKeypair: Keypair | null = null;
let _programId: PublicKey | null = null;

function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_URL, "confirmed");
  }
  return _connection;
}

function getAdminKeypair(): Keypair {
  if (!_adminKeypair) {
    try {
      const secretKey = Uint8Array.from(JSON.parse(PAYER_KEYPAIR_JSON));
      _adminKeypair = Keypair.fromSecretKey(secretKey);
    } catch {
      throw new Error("SOLANA_PAYER_KEYPAIR is invalid or not set");
    }
  }
  return _adminKeypair;
}

function getProgramId(): PublicKey {
  if (!_programId) {
    _programId = new PublicKey(PROGRAM_ID_STR);
  }
  return _programId;
}

// ─── PDA derivations ───────────────────────────────────────────────────────

function getVaultPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SEED], getProgramId());
}

function getMatchPDA(matchIndex: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(matchIndex));
  return PublicKey.findProgramAddressSync([Buffer.from("match"), buf], getProgramId());
}

function getBetPDA(matchId: string, bettor: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), Buffer.from(matchId), bettor.toBuffer()],
    getProgramId(),
  );
}

// ─── Anchor instruction discriminators ──────────────────────────────────────
// Anchor uses SHA256("global:<fn_name>")[0..8] as the 8-byte discriminator.
// We import the crypto module lazily to compute these.

async function anchorDiscriminator(name: string): Promise<Buffer> {
  const { createHash } = await import("crypto");
  const hash = createHash("sha256").update(`global:${name}`).digest();
  return Buffer.from(hash.subarray(0, 8));
}

// ─── Instruction builders ──────────────────────────────────────────────────

async function buildCreateMatchIx(
  admin: PublicKey,
  vault: PublicKey,
  matchEscrow: PublicKey,
  host: PublicKey,
  stakePerPlayer: bigint,
  entryFee: bigint,
): Promise<TransactionInstruction> {
  const disc = await anchorDiscriminator("create_match");
  const data = Buffer.alloc(8 + 32 + 8 + 8);
  disc.copy(data, 0);
  host.toBuffer().copy(data, 8);
  data.writeBigUInt64LE(stakePerPlayer, 40);
  data.writeBigUInt64LE(entryFee, 48);

  return new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: matchEscrow, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: getProgramId(),
    data,
  });
}

async function buildDepositFundsIx(
  admin: PublicKey,
  vault: PublicKey,
  matchEscrow: PublicKey,
  matchIndex: bigint,
  player: PublicKey,
  amount: bigint,
): Promise<TransactionInstruction> {
  const disc = await anchorDiscriminator("deposit_funds");
  const data = Buffer.alloc(8 + 8 + 32 + 8);
  disc.copy(data, 0);
  data.writeBigUInt64LE(matchIndex, 8);
  player.toBuffer().copy(data, 16);
  data.writeBigUInt64LE(amount, 48);

  return new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: matchEscrow, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: getProgramId(),
    data,
  });
}

async function buildSettleToWinnerIx(
  admin: PublicKey,
  vault: PublicKey,
  matchEscrow: PublicKey,
  winnerAccount: PublicKey,
  matchIndex: bigint,
  winner: PublicKey,
  prizeAmount: bigint,
): Promise<TransactionInstruction> {
  const disc = await anchorDiscriminator("settle_to_winner");
  const data = Buffer.alloc(8 + 8 + 32 + 8);
  disc.copy(data, 0);
  data.writeBigUInt64LE(matchIndex, 8);
  winner.toBuffer().copy(data, 16);
  data.writeBigUInt64LE(prizeAmount, 48);

  return new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: matchEscrow, isSigner: false, isWritable: true },
      { pubkey: winnerAccount, isSigner: false, isWritable: true },
    ],
    programId: getProgramId(),
    data,
  });
}

async function buildSettleDrawIx(
  admin: PublicKey,
  vault: PublicKey,
  matchEscrow: PublicKey,
  hostAccount: PublicKey,
  guestAccount: PublicKey,
  matchIndex: bigint,
): Promise<TransactionInstruction> {
  const disc = await anchorDiscriminator("settle_draw");
  const data = Buffer.alloc(8 + 8);
  disc.copy(data, 0);
  data.writeBigUInt64LE(matchIndex, 8);

  return new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: matchEscrow, isSigner: false, isWritable: true },
      { pubkey: hostAccount, isSigner: false, isWritable: true },
      { pubkey: guestAccount, isSigner: false, isWritable: true },
    ],
    programId: getProgramId(),
    data,
  });
}

async function buildRefundMatchIx(
  admin: PublicKey,
  vault: PublicKey,
  matchEscrow: PublicKey,
  hostAccount: PublicKey,
  guestAccount: PublicKey,
  matchIndex: bigint,
): Promise<TransactionInstruction> {
  const disc = await anchorDiscriminator("refund_match");
  const data = Buffer.alloc(8 + 8);
  disc.copy(data, 0);
  data.writeBigUInt64LE(matchIndex, 8);

  return new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: matchEscrow, isSigner: false, isWritable: true },
      { pubkey: hostAccount, isSigner: false, isWritable: true },
      { pubkey: guestAccount, isSigner: false, isWritable: true },
    ],
    programId: getProgramId(),
    data,
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildReceipt(
  description: string,
  txHash?: string,
  onchainMatchIndex?: number,
  settled = true,
): OnchainReceipt {
  const hash = txHash || `sol_mock_${Date.now().toString(36)}`;
  return {
    network: TransactionNetwork.SOLANA,
    txHash: hash,
    explorerUrl: isConfigured() ? `${EXPLORER_BASE}/tx/${hash}${CLUSTER_SUFFIX}` : undefined,
    mode: isConfigured() ? "configured" : "mock",
    settled,
    description,
    onchainMatchIndex,
  };
}

async function sendTx(tx: Transaction): Promise<string> {
  const conn = getConnection();
  const admin = getAdminKeypair();
  return sendAndConfirmTransaction(conn, tx, [admin], { commitment: "confirmed" });
}

/** Read the vault's match_count from the account data (offset: 32 admin + 0 = match_count at byte 40). */
async function getNextMatchIndex(): Promise<number> {
  if (!isConfigured()) return 0;
  try {
    const [vaultPDA] = getVaultPDA();
    const conn = getConnection();
    const info = await conn.getAccountInfo(vaultPDA);
    if (!info || !info.data) return 0;
    // Anchor account: 8 discriminator + 32 admin + 8 match_count + 1 bump
    const matchCount = info.data.readBigUInt64LE(40);
    return Number(matchCount);
  } catch {
    return 0;
  }
}

// ─── Adapter ───────────────────────────────────────────────────────────────

export const solanaAdapter: OnchainAdapter = {
  network: TransactionNetwork.SOLANA,

  async createEscrow(intent: EscrowIntent) {
    if (!isConfigured()) {
      return buildReceipt(`Escrow Solana preparado (modo mock) para partida ${intent.matchId}.`);
    }

    try {
      const admin = getAdminKeypair();
      const totalLamports = Math.round(parseFloat(intent.amount) * LAMPORTS_PER_SOL);
      const stakeLamports = intent.stakeAmount
        ? Math.round(parseFloat(intent.stakeAmount) * LAMPORTS_PER_SOL)
        : totalLamports;
      const feeLamports = intent.entryFee
        ? Math.round(parseFloat(intent.entryFee) * LAMPORTS_PER_SOL)
        : 0;
      const hostAddress = new PublicKey(intent.actorWallet || admin.publicKey.toBase58());

      const matchIndex = await getNextMatchIndex();
      const [vaultPDA] = getVaultPDA();
      const [matchPDA] = getMatchPDA(matchIndex);

      // 1. Create match on-chain
      const createIx = await buildCreateMatchIx(
        admin.publicKey,
        vaultPDA,
        matchPDA,
        hostAddress,
        BigInt(stakeLamports),
        BigInt(feeLamports),
      );

      const tx = new Transaction().add(createIx);

      // 2. Deposit host funds in same tx
      if (totalLamports > 0) {
        const depositIx = await buildDepositFundsIx(
          admin.publicKey,
          vaultPDA,
          matchPDA,
          BigInt(matchIndex),
          hostAddress,
          BigInt(totalLamports),
        );
        tx.add(depositIx);
      }

      const txHash = await sendTx(tx);

      return buildReceipt(
        `Escrow Solana creado (match #${matchIndex}). Host: ${hostAddress.toBase58()}. Monto: ${intent.amount} SOL.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Solana createEscrow error:", error);
      return buildReceipt(
        `Escrow Solana preparado (modo mock) para partida ${intent.matchId}.`,
        undefined,
        undefined,
        false,
      );
    }
  },

  async joinEscrow(intent: EscrowIntent) {
    if (!isConfigured()) {
      return buildReceipt(`Join escrow Solana (mock) para partida ${intent.matchId}.`);
    }

    try {
      const admin = getAdminKeypair();
      const amountLamports = Math.round(parseFloat(intent.amount) * LAMPORTS_PER_SOL);
      const guestAddress = new PublicKey(intent.actorWallet || admin.publicKey.toBase58());
      const matchIndex = intent.onchainMatchIndex ?? null;

      if (matchIndex === null) {
        return buildReceipt(`Join escrow Solana (sin index) para partida ${intent.matchId}.`);
      }

      if (amountLamports <= 0) {
        return buildReceipt(`Join escrow Solana (monto 0) para partida ${intent.matchId}.`);
      }

      const [vaultPDA] = getVaultPDA();
      const [matchPDA] = getMatchPDA(matchIndex);

      const depositIx = await buildDepositFundsIx(
        admin.publicKey,
        vaultPDA,
        matchPDA,
        BigInt(matchIndex),
        guestAddress,
        BigInt(amountLamports),
      );

      const tx = new Transaction().add(depositIx);
      const txHash = await sendTx(tx);

      return buildReceipt(
        `Guest unio a escrow Solana (match #${matchIndex}). Deposito: ${intent.amount} SOL.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Solana joinEscrow error:", error);
      return buildReceipt(
        `Join escrow Solana fallido para partida ${intent.matchId}.`,
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
        `Liquidacion Solana (DB-only) para partida ${intent.matchId}.`,
        undefined,
        undefined,
        false,
      );
    }

    if (!isConfigured()) {
      return buildReceipt(`Liquidacion Solana (mock) para partida ${intent.matchId}.`);
    }

    if (!intent.winnerAddress) {
      return buildReceipt(
        `Liquidacion Solana (sin wallet ganador) para partida ${intent.matchId}.`,
        undefined,
        undefined,
        false,
      );
    }

    try {
      const admin = getAdminKeypair();
      const prizeLamports = Math.round(parseFloat(intent.amount) * LAMPORTS_PER_SOL);
      const winnerPubkey = new PublicKey(intent.winnerAddress);

      if (prizeLamports <= 0) {
        return buildReceipt(
          `Liquidacion Solana (premio 0) para partida ${intent.matchId}.`,
          undefined,
          matchIndex,
          false,
        );
      }

      const [vaultPDA] = getVaultPDA();
      const [matchPDA] = getMatchPDA(matchIndex);

      const ix = await buildSettleToWinnerIx(
        admin.publicKey,
        vaultPDA,
        matchPDA,
        winnerPubkey,
        BigInt(matchIndex),
        winnerPubkey,
        BigInt(prizeLamports),
      );

      const tx = new Transaction().add(ix);
      const txHash = await sendTx(tx);

      return buildReceipt(
        `Liquidacion Solana completada. Match #${matchIndex}. Ganador: ${intent.winnerAddress}. Premio: ${intent.amount} SOL.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Solana settleEscrow error:", error);
      return buildReceipt(
        `Liquidacion Solana fallida (match #${matchIndex}).`,
        undefined,
        matchIndex,
        false,
      );
    }
  },

  async settleDrawOnchain(intent: DrawRefundIntent) {
    const matchIndex = intent.onchainMatchIndex;
    if (matchIndex === null || matchIndex === undefined) {
      return buildReceipt(`Draw refund Solana (DB-only) para partida ${intent.matchId}.`, undefined, undefined, false);
    }

    if (!isConfigured()) {
      return buildReceipt(`Draw refund Solana (mock) para partida ${intent.matchId}.`);
    }

    try {
      const admin = getAdminKeypair();
      const [vaultPDA] = getVaultPDA();
      const [matchPDA] = getMatchPDA(matchIndex);

      // Read match escrow to get host/guest addresses
      const conn = getConnection();
      const matchInfo = await conn.getAccountInfo(matchPDA);
      if (!matchInfo || !matchInfo.data) {
        throw new Error(`Match PDA #${matchIndex} not found on-chain`);
      }
      // Parse host (offset 8 disc + 8 match_index = 16) and guest (offset 16+32 = 48)
      const hostPubkey = new PublicKey(matchInfo.data.subarray(16, 48));
      const guestPubkey = new PublicKey(matchInfo.data.subarray(48, 80));

      const ix = await buildSettleDrawIx(
        admin.publicKey,
        vaultPDA,
        matchPDA,
        hostPubkey,
        guestPubkey,
        BigInt(matchIndex),
      );

      const tx = new Transaction().add(ix);
      const txHash = await sendTx(tx);

      return buildReceipt(
        `Draw refund Solana completado. Match #${matchIndex}.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Solana settle_draw error:", error);
      return buildReceipt(`Draw refund Solana fallido (match #${matchIndex}).`, undefined, matchIndex, false);
    }
  },

  async refundMatchOnchain(intent: CancelRefundIntent) {
    const matchIndex = intent.onchainMatchIndex;
    if (matchIndex === null || matchIndex === undefined) {
      return buildReceipt(`Cancel refund Solana (DB-only) para partida ${intent.matchId}.`, undefined, undefined, false);
    }

    if (!isConfigured()) {
      return buildReceipt(`Cancel refund Solana (mock) para partida ${intent.matchId}.`);
    }

    try {
      const admin = getAdminKeypair();
      const [vaultPDA] = getVaultPDA();
      const [matchPDA] = getMatchPDA(matchIndex);

      // Read match escrow for host/guest
      const conn = getConnection();
      const matchInfo = await conn.getAccountInfo(matchPDA);
      if (!matchInfo || !matchInfo.data) {
        throw new Error(`Match PDA #${matchIndex} not found on-chain`);
      }
      const hostPubkey = new PublicKey(matchInfo.data.subarray(16, 48));
      const guestPubkey = new PublicKey(matchInfo.data.subarray(48, 80));

      const ix = await buildRefundMatchIx(
        admin.publicKey,
        vaultPDA,
        matchPDA,
        hostPubkey,
        guestPubkey,
        BigInt(matchIndex),
      );

      const tx = new Transaction().add(ix);
      const txHash = await sendTx(tx);

      return buildReceipt(
        `Cancel refund Solana completado. Match #${matchIndex}.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Solana refund_match error:", error);
      return buildReceipt(`Cancel refund Solana fallido (match #${matchIndex}).`, undefined, matchIndex, false);
    }
  },

  async placeBet(intent: BetIntent) {
    const matchIndex = intent.onchainMatchIndex;
    const amountLamports = Math.round(parseFloat(intent.amount) * LAMPORTS_PER_SOL);

    if (!isConfigured() || matchIndex === null || matchIndex === undefined || amountLamports <= 0) {
      return buildReceipt(
        `Apuesta Solana registrada (DB-only) para partida ${intent.matchId} sobre ${intent.predictedWinnerId}.`,
      );
    }

    try {
      const admin = getAdminKeypair();
      const bettorPubkey = new PublicKey(intent.bettorWallet || admin.publicKey.toBase58());
      const predictedWinner = new PublicKey(intent.predictedWinnerId);
      const [vaultPDA] = getVaultPDA();
      const [betPDA] = getBetPDA(intent.matchId, bettorPubkey);

      const disc = await anchorDiscriminator("place_bet");
      const matchIdBytes = Buffer.from(intent.matchId);
      const data = Buffer.alloc(8 + 4 + matchIdBytes.length + 32 + 8);
      disc.copy(data, 0);
      data.writeUInt32LE(matchIdBytes.length, 8);
      matchIdBytes.copy(data, 12);
      const offset = 12 + matchIdBytes.length;
      predictedWinner.toBuffer().copy(data, offset);
      data.writeBigUInt64LE(BigInt(amountLamports), offset + 32);

      const ix = new TransactionInstruction({
        keys: [
          { pubkey: admin.publicKey, isSigner: true, isWritable: true },
          { pubkey: bettorPubkey, isSigner: false, isWritable: false },
          { pubkey: vaultPDA, isSigner: false, isWritable: true },
          { pubkey: betPDA, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: getProgramId(),
        data,
      });

      const tx = new Transaction().add(ix);
      const txHash = await sendTx(tx);

      return buildReceipt(
        `Apuesta Solana on-chain. Match ${intent.matchId}. Apostador: ${bettorPubkey.toBase58()}. Monto: ${intent.amount} SOL.`,
        txHash,
        matchIndex,
      );
    } catch (error) {
      console.error("Solana placeBet error:", error);
      return buildReceipt(
        `Apuesta Solana fallida para partida ${intent.matchId}.`,
        undefined,
        matchIndex,
        false,
      );
    }
  },

  async settleBet(intent: BetPayoutIntent) {
    // Bet settlement stays DB-only for now (same as Initia adapter)
    return buildReceipt(
      `Payout de apuesta Solana (DB) para ${intent.bettorId} en partida ${intent.matchId}: ${intent.amount} ${intent.token}.`,
    );
  },

  async queryBalance(address: string, _denom?: string) {
    if (!isConfigured()) return { amount: 0, denom: "SOL" };

    try {
      const conn = getConnection();
      const pubkey = new PublicKey(address);
      const lamports = await conn.getBalance(pubkey);
      return { amount: lamports / LAMPORTS_PER_SOL, denom: "SOL" };
    } catch (error) {
      console.error("Solana queryBalance error:", error);
      return null;
    }
  },
};
