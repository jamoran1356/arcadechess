"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useInterwovenKit } from "@initia/interwovenkit-react";

type Props = {
  address: string;
  network: string;
  walletId: string;
};

export function OnchainBalance({ address, network, walletId }: Props) {
  const { initiaAddress, isConnected } = useInterwovenKit();
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);

  // The real address to query: use InterwovenKit address for INITIA, else the stored address
  const realAddress =
    network === "INITIA" && isConnected && initiaAddress ? initiaAddress : address;

  const isPlaceholder =
    realAddress.startsWith("initia_") ||
    realAddress.startsWith("flow_") ||
    realAddress.startsWith("solana_");

  // Auto-link InterwovenKit address to platform wallet
  useEffect(() => {
    if (network !== "INITIA" || !isConnected || !initiaAddress || linked) return;
    if (address === initiaAddress) {
      setLinked(true);
      return;
    }

    fetch("/api/wallet/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: initiaAddress, network: "INITIA" }),
    })
      .then((res) => { if (res.ok) { setLinked(true); router.refresh(); } })
      .catch(() => {});
  }, [network, isConnected, initiaAddress, address, linked]);

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

  if (isPlaceholder && network === "INITIA" && !isConnected) {
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
    <p className="mt-1 text-sm opacity-70">
      On-chain: <span className="font-semibold">{balance.toFixed(6)}</span>
    </p>
  );
}
