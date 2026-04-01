"use client";

import { useEffect, useState } from "react";

type Props = {
  address: string;
  network: string;
};

export function OnchainBalance({ address, network }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || address.startsWith("initia_") || address.startsWith("flow_") || address.startsWith("solana_")) {
      // Skip generated placeholder addresses
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/wallet/onchain-balance?address=${encodeURIComponent(address)}&network=${network}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setBalance(data.amount ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address, network]);

  if (loading) {
    return <span className="text-xs opacity-50">cargando on-chain...</span>;
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
