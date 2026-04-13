"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
const ADMIN_ADDRESS = process.env.NEXT_PUBLIC_SOLANA_ADMIN_ADDRESS || "";

export function useSolanaEscrowTx() {
  const { publicKey, sendTransaction, connected } = useWallet();

  async function sendToEscrow(amountHuman: number, memo?: string): Promise<string> {
    if (!connected || !publicKey) {
      throw new Error("Conecta tu wallet de Solana antes de enviar fondos.");
    }

    const lamports = Math.round(amountHuman * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      throw new Error("El monto a enviar debe ser mayor a 0.");
    }

    // Send SOL to the admin/vault address
    const target = ADMIN_ADDRESS;
    if (!target) {
      throw new Error("Dirección de admin Solana no configurada.");
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const tx = new Transaction();

    tx.add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(target),
        lamports,
      })
    );

    if (memo) {
      // Add memo instruction (optional, best-effort)
      tx.add({
        keys: [],
        programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        data: Buffer.from(memo, "utf-8"),
      });
    }

    const signature = await sendTransaction(tx, connection);

    // Wait for confirmation
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });

    return signature;
  }

  return {
    sendToEscrow,
    isWalletConnected: connected,
    walletAddress: publicKey?.toBase58() ?? null,
  };
}
