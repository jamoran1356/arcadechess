import { NextResponse } from "next/server";
import { getSession, hasAdminAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";
import { creditWallet } from "@/lib/wallet";

const REST_URL =
  process.env.NEXT_PUBLIC_INITIA_RPC || "https://rest.testnet.initia.xyz";
const CHAIN_ID =
  process.env.NEXT_PUBLIC_INITIA_CHAIN_ID || "initiation-2";
const EXPLORER_BASE = `https://scan.testnet.initia.xyz/${CHAIN_ID}`;

/**
 * Query the Initia LCD for a transaction by hash.
 * Returns "confirmed" | "failed" | "not_found".
 */
async function queryTxStatus(
  txHash: string,
): Promise<"confirmed" | "failed" | "not_found"> {
  try {
    const res = await fetch(
      `${REST_URL}/cosmos/tx/v1beta1/txs/${encodeURIComponent(txHash)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      if (res.status === 404 || res.status === 400) return "not_found";
      return "not_found";
    }
    const data = (await res.json()) as {
      tx_response?: { code?: number };
    };
    const code = data.tx_response?.code;
    if (code === 0) return "confirmed";
    if (code !== undefined) return "failed";
    return "not_found";
  } catch {
    return "not_found";
  }
}

/**
 * POST /api/admin/transactions/reconcile
 *
 * Finds all PENDING transactions and verifies their on-chain status.
 * - Confirmed on-chain (code 0) → SETTLED + creditWallet for PRIZE_PAYOUT
 * - Failed on-chain (code != 0) → FAILED
 * - Mock hashes (no real tx) → SETTLED (mark as reconciled)
 * - Not found on-chain + older than 1h → FAILED
 */
export async function POST() {
  const session = await getSession();
  if (!session || !hasAdminAccess(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.transaction.findMany({
    where: { status: TransactionStatus.PENDING },
    orderBy: { createdAt: "asc" },
  });

  const results: Array<{
    id: string;
    txHash: string | null;
    oldStatus: string;
    newStatus: string;
    reason: string;
  }> = [];

  const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);

  for (const tx of pending) {
    const hash = tx.txHash;

    // Mock hashes — mark settled immediately
    if (
      !hash ||
      hash.startsWith("mock_") ||
      hash.startsWith("initia_mock_") ||
      hash.startsWith("draw_refund_") ||
      hash.startsWith("cancel_refund_")
    ) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: TransactionStatus.SETTLED },
      });

      // Credit wallet if it's a payout that was never credited
      if (tx.type === "PRIZE_PAYOUT") {
        await creditWallet(tx.userId, tx.network, Number(tx.amount.toString()));
      }

      results.push({
        id: tx.id,
        txHash: hash,
        oldStatus: "PENDING",
        newStatus: "SETTLED",
        reason: "mock_hash",
      });
      continue;
    }

    // Real hash — check on-chain (only INITIA supported for now)
    if (tx.network !== "INITIA") {
      results.push({
        id: tx.id,
        txHash: hash,
        oldStatus: "PENDING",
        newStatus: "PENDING",
        reason: `unsupported_network:${tx.network}`,
      });
      continue;
    }

    const onchainStatus = await queryTxStatus(hash);

    if (onchainStatus === "confirmed") {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: TransactionStatus.SETTLED },
      });

      // Credit wallet if it's a payout that was never credited
      if (tx.type === "PRIZE_PAYOUT") {
        await creditWallet(tx.userId, tx.network, Number(tx.amount.toString()));
      }

      results.push({
        id: tx.id,
        txHash: hash,
        oldStatus: "PENDING",
        newStatus: "SETTLED",
        reason: "confirmed_onchain",
      });
    } else if (onchainStatus === "failed") {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: TransactionStatus.FAILED },
      });
      results.push({
        id: tx.id,
        txHash: hash,
        oldStatus: "PENDING",
        newStatus: "FAILED",
        reason: "failed_onchain",
      });
    } else {
      // not_found — if older than 1 hour, mark FAILED; otherwise leave PENDING
      if (tx.createdAt < ONE_HOUR_AGO) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { status: TransactionStatus.FAILED },
        });
        results.push({
          id: tx.id,
          txHash: hash,
          oldStatus: "PENDING",
          newStatus: "FAILED",
          reason: "not_found_expired",
        });
      } else {
        results.push({
          id: tx.id,
          txHash: hash,
          oldStatus: "PENDING",
          newStatus: "PENDING",
          reason: "not_found_recent",
        });
      }
    }
  }

  const settled = results.filter((r) => r.newStatus === "SETTLED").length;
  const failed = results.filter((r) => r.newStatus === "FAILED").length;
  const unchanged = results.filter((r) => r.newStatus === "PENDING").length;

  return NextResponse.json({
    total: pending.length,
    settled,
    failed,
    unchanged,
    explorerBase: EXPLORER_BASE,
    results,
  });
}
