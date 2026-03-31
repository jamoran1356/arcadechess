'use client';

import { useInterwovenKit } from "@initia/interwovenkit-react";

export function InterwovenKitConnectButton() {
  const { isConnected, openConnect, openWallet, disconnect, initiaAddress } = useInterwovenKit();

  return (
    <div className="flex items-center gap-2">
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
