'use client';

import { PropsWithChildren, useEffect, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";
import {
  initiaPrivyWalletConnector,
  injectStyles,
  InterwovenKitProvider,
  TESTNET,
} from "@initia/interwovenkit-react";
import interwovenKitStyles from "@initia/interwovenkit-react/styles.js";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

// ─── Initia config ──────────────────────────────────────────────────────
const wagmiConfig = createConfig({
  connectors: [initiaPrivyWalletConnector],
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
});

const queryClient = new QueryClient();

function resolveInterwovenChainId() {
  const configuredChainId = (process.env.NEXT_PUBLIC_INITIA_CHAIN_ID ?? "").trim();

  if (!configuredChainId) {
    return TESTNET.defaultChainId;
  }

  // Backward-compatible alias used in previous env values.
  const normalizedChainId =
    configuredChainId === "initia-testnet" || configuredChainId === "initia-testnet-1"
      ? "initiation-2"
      : configuredChainId;

  return normalizedChainId === "initiation-2" ? normalizedChainId : TESTNET.defaultChainId;
}

const defaultInterwovenChainId = resolveInterwovenChainId();

// ─── Solana config ──────────────────────────────────────────────────────
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";

function SolanaProviders({ children }: PropsWithChildren) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// ─── Combined provider ──────────────────────────────────────────────────
export function InterwovenKitProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    injectStyles(interwovenKitStyles);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <InterwovenKitProvider
          {...TESTNET}
          defaultChainId={defaultInterwovenChainId}
          enableAutoSign={true}
        >
          <SolanaProviders>
            {children}
          </SolanaProviders>
        </InterwovenKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
