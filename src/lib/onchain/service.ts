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
  return [
    {
      id: TransactionNetwork.INITIA,
      name: "Initia",
      summary: "Escrow principal para stakes del hackathon y appchain gaming.",
      status: process.env.INITIA_RPC_URL ? "Configurado" : "Mock listo para conectar con weave/minitiad",
    },
    {
      id: TransactionNetwork.FLOW,
      name: "Flow",
      summary: "Ruta alternativa para coleccionables y settlement de partidas curadas.",
      status: process.env.FLOW_ACCESS_NODE ? "Configurado" : "Contrato Cadence de referencia incluido",
    },
    {
      id: TransactionNetwork.SOLANA,
      name: "Solana",
      summary: "Canal rapido para stakes de baja latencia y torneos cortos.",
      status: process.env.SOLANA_RPC_URL ? "Configurado" : "Programa Anchor/Rust de referencia incluido",
    },
  ];
}
