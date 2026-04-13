"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// FCL is lazy-loaded at runtime (it's a big dep)
type FlowUser = { addr: string | null; loggedIn: boolean };

const ACCESS_NODE = process.env.NEXT_PUBLIC_FLOW_RPC || "https://rest-testnet.onflow.org";
const FLOW_NETWORK = process.env.NEXT_PUBLIC_FLOW_CHAIN_ID || "testnet";
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FLOW_CONTRACT_ADDRESS || "";

export function useFlowWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const fclRef = useRef<typeof import("@onflow/fcl") | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const fcl = await import("@onflow/fcl");
      if (cancelled) return;
      fclRef.current = fcl;

      fcl.config({
        "flow.network": FLOW_NETWORK,
        "accessNode.api": ACCESS_NODE,
        "discovery.wallet": FLOW_NETWORK === "mainnet"
          ? "https://fcl-discovery.onflow.org/authn"
          : "https://fcl-discovery.onflow.org/testnet/authn",
        "app.detail.title": "PlayChess Arena",
      });

      fcl.currentUser.subscribe((user: FlowUser) => {
        if (cancelled) return;
        setAddress(user.addr);
        setConnected(!!user.loggedIn);
      });
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const connect = useCallback(async () => {
    const fcl = fclRef.current ?? await import("@onflow/fcl");
    fclRef.current = fcl;
    await fcl.authenticate();
  }, []);

  const disconnect = useCallback(async () => {
    const fcl = fclRef.current ?? await import("@onflow/fcl");
    fclRef.current = fcl;
    await fcl.unauthenticate();
  }, []);

  return {
    address,
    connected,
    connect,
    disconnect,
  };
}

export function useFlowEscrowTx() {
  const { address, connected } = useFlowWallet();

  async function sendToEscrow(amountHuman: number, memo?: string): Promise<string> {
    if (!connected || !address) {
      throw new Error("Conecta tu wallet de Flow antes de enviar fondos.");
    }

    if (!CONTRACT_ADDRESS) {
      throw new Error("Dirección de contrato Flow no configurada.");
    }

    // Amount in UFix64 format (8 decimal places)
    const amountFixed = amountHuman.toFixed(8);

    const fcl = await import("@onflow/fcl");
    const t = await import("@onflow/types");

    // Send FLOW tokens to the admin/contract address
    const txId = await fcl.mutate({
      cadence: `
        import FungibleToken from 0x${CONTRACT_ADDRESS.replace(/^0x/, "").length > 0 ? "9a0766d93b6608b7" : "9a0766d93b6608b7"}
        import FlowToken from 0x${FLOW_NETWORK === "mainnet" ? "1654653399040a61" : "7e60df042a9c0868"}

        transaction(amount: UFix64, to: Address) {
          let sentVault: @{FungibleToken.Vault}

          prepare(signer: auth(BorrowValue) &Account) {
            let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
              from: /storage/flowTokenVault
            ) ?? panic("Could not borrow reference to the owner's vault")

            self.sentVault <- vaultRef.withdraw(amount: amount)
          }

          execute {
            let receiver = getAccount(to)
              .capabilities.borrow<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
              ?? panic("Could not borrow receiver reference")

            receiver.deposit(from: <- self.sentVault)
          }
        }
      `,
      args: (arg: typeof fcl.arg, tt: typeof t) => [
        arg(amountFixed, tt.UFix64),
        arg(CONTRACT_ADDRESS, tt.Address),
      ],
      proposer: fcl.currentUser,
      payer: fcl.currentUser,
      authorizations: [fcl.currentUser],
      limit: 100,
    });

    // Wait for transaction to be sealed
    await fcl.tx(txId).onceSealed();
    return txId;
  }

  return {
    sendToEscrow,
    isWalletConnected: connected,
    walletAddress: address,
  };
}
