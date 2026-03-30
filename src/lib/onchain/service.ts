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

export function getSupportedNetworks() {
  const initiaContract = process.env.NEXT_PUBLIC_INITIA_CONTRACT_ADDRESS ?? null;
  const flowContract = process.env.NEXT_PUBLIC_FLOW_CONTRACT_ADDRESS ?? null;
  const solanaContract = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID ?? null;
  const initiaChainId = process.env.NEXT_PUBLIC_INITIA_CHAIN_ID ?? "initiation-2";

  return [
    {
      id: TransactionNetwork.INITIA,
      name: "Initia",
      summary: "Escrow principal para stakes del hackathon y appchain gaming.",
      status: process.env.INITIA_RPC_URL ? "Configurado" : "Mock listo para conectar con weave/minitiad",
      contractAddress: initiaContract,
      explorerUrl: initiaContract
        ? `https://scan.initia.xyz/${initiaChainId}/accounts/${initiaContract}`
        : null,
    },
    {
      id: TransactionNetwork.FLOW,
      name: "Flow",
      summary: "Ruta alternativa para coleccionables y settlement de partidas curadas.",
      status: process.env.FLOW_ACCESS_NODE ? "Configurado" : "Contrato Cadence de referencia incluido",
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
}
