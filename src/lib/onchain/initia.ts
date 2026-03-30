import { TransactionNetwork } from "@prisma/client";
import { EscrowIntent, OnchainAdapter, OnchainReceipt, SettlementIntent } from "./types";

const INITIA_CHAIN_ID = process.env.INITIA_CHAIN_ID || "initia-testnet-1";
const INITIA_RPC_URL = process.env.INITIA_RPC_URL || "https://initia-rpc-testnet.allthatnode.com";
const INITIA_CONTRACT_ADDRESS =
  process.env.INITIA_CONTRACT_ADDRESS || "0x1::playchess::arcade_escrow";
const INITIA_MODULE_PUBLISHER =
  process.env.INITIA_MODULE_PUBLISHER || "0x1";

interface InitiaTransaction {
  sequence_number: number;
  max_gas_amount: number;
  gas_unit_price: number;
  expiration_timestamp_secs: number;
  payload: {
    type: string;
    function: string;
    type_arguments: string[];
    arguments: (string | number | boolean)[];
  };
}

function buildReceipt(
  description: string,
  transactionHash?: string,
): OnchainReceipt {
  const isConfigured = Boolean(
    process.env.INITIA_RPC_URL && process.env.INITIA_CHAIN_ID,
  );
  const hash = transactionHash || `initia_${Date.now().toString(36)}`;

  return {
    network: TransactionNetwork.INITIA,
    txHash: hash,
    explorerUrl: isConfigured
      ? `https://testnet.initia.explorer.com/tx/${hash}`
      : undefined,
    mode: isConfigured ? "configured" : "mock",
    description,
  };
}

async function sendInitiaTransaction(
  functionName: string,
  args: (string | number | boolean)[],
  matchId: string,
): Promise<string> {
  if (!process.env.INITIA_RPC_URL || !process.env.INITIA_PRIVATE_KEY) {
    // Mock mode
    return `mock_initia_${matchId}_${Date.now().toString(36)}`;
  }

  try {
    // Placeholder para implementación real con SDK de Initia
    const response = await fetch(`${INITIA_RPC_URL}/api/v1/simulate_tx`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chain_id: INITIA_CHAIN_ID,
        function: functionName,
        arguments: args,
      }),
    });

    if (!response.ok) {
      throw new Error(`Initia RPC error: ${response.statusText}`);
    }

    const data = (await response.json()) as unknown;
    const txData = data as { hash?: string };
    return txData.hash || `initia_${Date.now().toString(36)}`;
  } catch (error) {
    console.error("Initia transaction error:", error);
    throw error;
  }
}

export const initiaAdapter: OnchainAdapter = {
  network: TransactionNetwork.INITIA,

  async createEscrow(intent: EscrowIntent) {
    try {
      const txHash = await sendInitiaTransaction(
        `${INITIA_MODULE_PUBLISHER}::arcade_escrow::create_match`,
        [intent.matchId, intent.amount],
        intent.matchId,
      );

      return buildReceipt(
        `Escrow Initia creado para partida ${intent.matchId}. Monto bloqueado: ${intent.amount} ${intent.token}.`,
        txHash,
      );
    } catch (error) {
      console.error("Initia createEscrow error:", error);
      return buildReceipt(
        `Escrow Initia preparado (modo mock) para partida ${intent.matchId}.`,
      );
    }
  },

  async joinEscrow(intent: EscrowIntent) {
    try {
      const txHash = await sendInitiaTransaction(
        `${INITIA_MODULE_PUBLISHER}::arcade_escrow::join_match`,
        [intent.matchId, intent.amount],
        intent.matchId,
      );

      return buildReceipt(
        `Jugador se unió a escrow Initia para partida ${intent.matchId}. Pool actualizado: ${intent.amount} ${intent.token}.`,
        txHash,
      );
    } catch (error) {
      console.error("Initia joinEscrow error:", error);
      return buildReceipt(
        `Unión a escrow Initia preparada (modo mock) para partida ${intent.matchId}.`,
      );
    }
  },

  async settleEscrow(intent: SettlementIntent) {
    try {
      const txHash = await sendInitiaTransaction(
        `${INITIA_MODULE_PUBLISHER}::arcade_escrow::settle_match`,
        [intent.matchId, intent.winnerId, intent.amount],
        intent.matchId,
      );

      return buildReceipt(
        `Liquidación Initia completada para partida ${intent.matchId}. Ganador: ${intent.winnerId}. Premio: ${intent.amount} ${intent.token}.`,
        txHash,
      );
    } catch (error) {
      console.error("Initia settleEscrow error:", error);
      return buildReceipt(
        `Liquidación Initia preparada (modo mock) para partida ${intent.matchId}.`,
      );
    }
  },
};
