/**
 * Client-safe explorer URL builders.
 * Uses NEXT_PUBLIC_ env vars only.
 */

const CHAIN_ID = process.env.NEXT_PUBLIC_INITIA_CHAIN_ID ?? "initiation-2";

export function getInitiaExplorerTxUrl(txHash: string): string | null {
  if (!txHash || txHash.startsWith("mock-") || txHash.startsWith("demo-")) return null;
  return `https://scan.testnet.initia.xyz/${encodeURIComponent(CHAIN_ID)}/txs/${encodeURIComponent(txHash)}`;
}
