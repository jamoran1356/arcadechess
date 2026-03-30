'use client';

import { PropsWithChildren, useEffect } from "react";
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
          {children}
        </InterwovenKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
