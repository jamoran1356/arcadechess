/**
 * Client-safe explorer URL builders.
 * Uses NEXT_PUBLIC_ env vars only.
 */

const CHAIN_ID = process.env.NEXT_PUBLIC_INITIA_CHAIN_ID ?? "initiation-2";

export function getInitiaExplorerTxUrl(txHash: string): string | null {
  if (!txHash || txHash.startsWith("mock-") || txHash.startsWith("demo-")) return null;
  return `https://scan.testnet.initia.xyz/${encodeURIComponent(CHAIN_ID)}/txs/${encodeURIComponent(txHash)}`;
}

const explorerTxBaseUrls: Record<string, string> = {
  INITIA: `https://scan.testnet.initia.xyz/${CHAIN_ID}/txs`,
  FLOW: "https://testnet.flowscan.io/tx",
  SOLANA: "https://explorer.solana.com/tx",
};

export function getExplorerTxUrlClient(network: string, txHash: string): string | null {
  if (!txHash || txHash.startsWith("mock-") || txHash.startsWith("demo-") || txHash.startsWith("sol_mock_") || txHash.startsWith("flow_mock_")) return null;
  const base = explorerTxBaseUrls[network];
  if (!base) return null;
  const suffix = network === "SOLANA" ? "?cluster=devnet" : "";
  return `${base}/${txHash}${suffix}`;
}
