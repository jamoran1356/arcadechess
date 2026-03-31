"use client";

import { useInterwovenKit } from "@initia/interwovenkit-react";

const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_INITIA_CONTRACT_ADDRESS ?? "";
const DENOM = "uinit";

export function useEscrowTx() {
  const { initiaAddress, isConnected, requestTxBlock } = useInterwovenKit();

  /**
   * Sign & broadcast a MsgSend to the escrow contract address.
   * Returns the confirmed transaction hash.
   * @param amountHuman - amount in INIT (e.g. 0.15), will be converted to uinit
   * @param memo - optional tx memo
   */
  async function sendToEscrow(amountHuman: number, memo?: string): Promise<string> {
    if (!isConnected || !initiaAddress) {
      throw new Error("Conecta tu wallet de Initia antes de enviar fondos al escrow.");
    }
    if (!ESCROW_ADDRESS) {
      throw new Error("Dirección de contrato escrow no configurada (NEXT_PUBLIC_INITIA_CONTRACT_ADDRESS).");
    }

    const microAmount = Math.round(amountHuman * 1_000_000).toString();

    const messages = [
      {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        value: {
          fromAddress: initiaAddress,
          toAddress: ESCROW_ADDRESS,
          amount: [{ amount: microAmount, denom: DENOM }],
        },
      },
    ];

    const result = await requestTxBlock({ messages, memo });
    return result.transactionHash;
  }

  return {
    sendToEscrow,
    isWalletConnected: isConnected,
    walletAddress: initiaAddress,
  };
}
