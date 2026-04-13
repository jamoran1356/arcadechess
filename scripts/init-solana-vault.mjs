#!/usr/bin/env node
/**
 * One-time script to call initialize_vault on the Solana Anchor program.
 * Usage: node scripts/init-solana-vault.mjs
 */
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("PMCjtbjN15YvMxPoXdsrmr35RRDV5W5ASVdVEbF6PX6");
const VAULT_SEED = Buffer.from("vault");

// Load keypair from default Solana CLI location
const keypairPath = join(homedir(), ".config", "solana", "id.json");
const secretKey = Uint8Array.from(JSON.parse(readFileSync(keypairPath, "utf-8")));
const admin = Keypair.fromSecretKey(secretKey);

// Derive vault PDA
const [vaultPDA, vaultBump] = PublicKey.findProgramAddressSync([VAULT_SEED], PROGRAM_ID);

console.log("Program ID:", PROGRAM_ID.toBase58());
console.log("Admin:", admin.publicKey.toBase58());
console.log("Vault PDA:", vaultPDA.toBase58());
console.log("Vault bump:", vaultBump);

// Build initialize_vault instruction
const disc = createHash("sha256").update("global:initialize_vault").digest().subarray(0, 8);

const ix = new TransactionInstruction({
  keys: [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: vaultPDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  programId: PROGRAM_ID,
  data: disc,
});

const conn = new Connection(RPC_URL, "confirmed");

// Check if vault already exists
const existing = await conn.getAccountInfo(vaultPDA);
if (existing) {
  console.log("Vault already initialized! Data length:", existing.data.length);
  // Read admin from vault: 8 disc + 32 admin pubkey
  const storedAdmin = new PublicKey(existing.data.subarray(8, 40));
  const matchCount = existing.data.readBigUInt64LE(40);
  console.log("Stored admin:", storedAdmin.toBase58());
  console.log("Match count:", matchCount.toString());
  process.exit(0);
}

const tx = new Transaction().add(ix);
const sig = await sendAndConfirmTransaction(conn, tx, [admin], { commitment: "confirmed" });
console.log("✅ Vault initialized! TX:", sig);
console.log("Explorer:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
