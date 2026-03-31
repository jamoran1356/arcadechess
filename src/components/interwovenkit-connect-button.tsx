'use client';

import { useEffect, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";

export function InterwovenKitConnectButton() {
  const { isConnected, openConnect, openWallet, disconnect, initiaAddress } = useInterwovenKit();
  const [network, setNetwork] = useState("INITIA");

  useEffect(() => {
    const stored = window.localStorage.getItem("playchess.preferredNetwork");
    if (stored) {
      setNetwork(stored);
    }
  }, []);

  function onNetworkChange(next: string) {
    setNetwork(next);
    window.localStorage.setItem("playchess.preferredNetwork", next);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={network}
        onChange={(event) => onNetworkChange(event.target.value)}
        className="rounded-full border border-white/15 bg-transparent px-3 py-2 text-xs text-slate-200"
        aria-label="Preferred wallet network"
      >
        <option value="INITIA" className="bg-slate-950">INITIA</option>
        <option value="FLOW" className="bg-slate-950">FLOW</option>
        <option value="SOLANA" className="bg-slate-950">SOLANA</option>
      </select>
      <button
        type="button"
        onClick={isConnected ? openWallet : openConnect}
        className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm text-cyan-100 transition hover:border-cyan-200/60"
      >
        {isConnected ? "Wallet" : "Connect"}
      </button>
      {isConnected ? (
        <button
          type="button"
          onClick={disconnect}
          className="rounded-full border border-white/15 px-3 py-2 text-xs text-slate-200 transition hover:border-white/35"
          title={initiaAddress || "Connected"}
        >
          Disconnect
        </button>
      ) : null}
    </div>
  );
}
