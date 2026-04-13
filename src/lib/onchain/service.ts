import { TransactionNetwork } from "@prisma/client";
import { flowAdapter } from "./flow";
import { initiaAdapter } from "./initia";
import { solanaAdapter } from "./solana";

const adapters = {
  [TransactionNetwork.INITIA]: initiaAdapter,
  [TransactionNetwork.FLOW]: flowAdapter,
  [TransactionNetwork.SOLANA]: solanaAdapter,
};

export function getOnchainAdapter(network: TransactionNetwork) {
  return adapters[network];
}

const explorerTxBaseUrls: Record<TransactionNetwork, string> = {
  [TransactionNetwork.INITIA]: `https://scan.testnet.initia.xyz/${process.env.NEXT_PUBLIC_INITIA_CHAIN_ID ?? "initiation-2"}/txs`,
  [TransactionNetwork.FLOW]: "https://testnet.flowscan.io/tx",
  [TransactionNetwork.SOLANA]: "https://explorer.solana.com/tx",
};

const explorerAddrBaseUrls: Record<TransactionNetwork, string> = {
  [TransactionNetwork.INITIA]: `https://scan.testnet.initia.xyz/${process.env.NEXT_PUBLIC_INITIA_CHAIN_ID ?? "initiation-2"}/accounts`,
  [TransactionNetwork.FLOW]: "https://testnet.flowscan.io/account",
  [TransactionNetwork.SOLANA]: "https://explorer.solana.com/address",
};

export function getExplorerTxUrl(network: TransactionNetwork, txHash: string): string | null {
  if (!txHash || txHash.startsWith("mock-") || txHash.startsWith("demo-") || txHash.startsWith("sol_mock_") || txHash.startsWith("flow_mock_")) return null;
  const base = explorerTxBaseUrls[network];
  const suffix = network === TransactionNetwork.SOLANA ? "?cluster=devnet" : "";
  return `${base}/${txHash}${suffix}`;
}

export function getExplorerAddressUrl(network: TransactionNetwork, address: string): string | null {
  if (!address) return null;
  const base = explorerAddrBaseUrls[network];
  const suffix = network === TransactionNetwork.SOLANA ? "?cluster=devnet" : "";
  return `${base}/${address}${suffix}`;
}

export function getSupportedNetworks(enabledList?: TransactionNetwork[]) {
  const initiaContract = process.env.NEXT_PUBLIC_INITIA_CONTRACT_ADDRESS ?? null;
  const flowContract = process.env.NEXT_PUBLIC_FLOW_CONTRACT_ADDRESS ?? null;
  const solanaContract = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID ?? null;
  const initiaChainId = process.env.NEXT_PUBLIC_INITIA_CHAIN_ID ?? "initiation-2";

  const all = [
    {
      id: TransactionNetwork.INITIA,
      name: "Initia",
      summary: "Escrow principal para stakes del hackathon y appchain gaming.",
      status: process.env.INITIA_ADMIN_SEED ? "Configurado" : "Mock listo para conectar con weave/minitiad",
      contractAddress: initiaContract,
      explorerUrl: initiaContract
        ? `https://scan.testnet.initia.xyz/${initiaChainId}/accounts/${initiaContract}`
        : null,
    },
    {
      id: TransactionNetwork.FLOW,
      name: "Flow",
      summary: "Ruta alternativa para coleccionables y settlement de partidas curadas.",
      status: process.env.FLOW_ADMIN_PRIVATE_KEY && process.env.FLOW_ADMIN_PRIVATE_KEY !== "abc123def456ghi789jkl000" ? "Configurado" : "Contrato Cadence de referencia incluido",
      contractAddress: flowContract,
      explorerUrl: flowContract
        ? `https://testnet.flowscan.io/account/${flowContract}`
        : null,
    },
    {
      id: TransactionNetwork.SOLANA,
      name: "Solana",
      summary: "Canal rapido para stakes de baja latencia y torneos cortos.",
      status: process.env.SOLANA_RPC_URL ? "Configurado" : "Programa Anchor/Rust de referencia incluido",
      contractAddress: solanaContract,
      explorerUrl: solanaContract
        ? `https://explorer.solana.com/address/${solanaContract}?cluster=devnet`
        : null,
    },
  ];

  return all.map((n) => ({
    ...n,
    enabled: !enabledList || enabledList.includes(n.id),
  }));
}
