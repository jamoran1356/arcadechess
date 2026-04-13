"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useFlowWallet } from "@/hooks/use-flow-wallet";

type Props = {
  address: string;
  network: string;
  walletId: string;
};

export function OnchainBalance({ address, network, walletId }: Props) {
  const { initiaAddress, isConnected: initiaConnected } = useInterwovenKit();
  const { publicKey: solanaPublicKey, connected: solanaConnected } = useSolanaWallet();
  const { address: flowAddress, connected: flowConnected } = useFlowWallet();
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);

  // Resolve the correct wallet address per network
  const connectedAddress =
    network === "INITIA" && initiaConnected && initiaAddress ? initiaAddress :
    network === "SOLANA" && solanaConnected && solanaPublicKey ? solanaPublicKey.toBase58() :
    network === "FLOW" && flowConnected && flowAddress ? flowAddress :
    null;

  const isWalletConnectedForNetwork =
    (network === "INITIA" && initiaConnected) ||
    (network === "SOLANA" && solanaConnected) ||
    (network === "FLOW" && flowConnected);

  const realAddress = connectedAddress || address;

  const isPlaceholder =
    realAddress.startsWith("initia_") ||
    realAddress.startsWith("flow_") ||
    realAddress.startsWith("solana_");

  // Auto-link wallet address to platform wallet
  useEffect(() => {
    if (!isWalletConnectedForNetwork || !connectedAddress || linked) return;
    if (address === connectedAddress) {
      setLinked(true);
      return;
    }

    fetch("/api/wallet/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: connectedAddress, network }),
    })
      .then((res) => { if (res.ok) { setLinked(true); router.refresh(); } })
      .catch(() => {});
  }, [network, isWalletConnectedForNetwork, connectedAddress, address, linked, router]);

  // Fetch on-chain balance
  useEffect(() => {
    if (isPlaceholder) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/wallet/onchain-balance?address=${encodeURIComponent(realAddress)}&network=${network}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setBalance(typeof data.amount === "number" ? data.amount : null);
        } else {
          setBalance(null);
        }
      })
      .catch(() => setBalance(null))
      .finally(() => setLoading(false));
  }, [realAddress, network, isPlaceholder]);

  if (isPlaceholder && !isWalletConnectedForNetwork) {
    return <p className="mt-1 text-xs opacity-50">Conecta tu wallet para ver el saldo on-chain</p>;
  }

  if (isPlaceholder) {
    return null;
  }

  if (loading) {
    return <span className="mt-1 text-xs opacity-50">cargando on-chain...</span>;
  }

  if (balance === null) {
    return null;
  }

  return (
    <p className="mt-1 text-3xl font-semibold">
      {balance.toFixed(6)}
    </p>
  );
}
