import { TransactionNetwork } from "@prisma/client";
import { getPlatformConfig } from "@/lib/platform-config";

const ALL_NETWORKS = Object.values(TransactionNetwork);

/**
 * Returns the list of networks enabled by the admin in PlatformConfig.
 * Defaults to ["INITIA"] if the field is missing or malformed.
 */
export async function getEnabledNetworks(): Promise<TransactionNetwork[]> {
  const config = await getPlatformConfig();
  const raw = config.enabledNetworks;

  if (!Array.isArray(raw)) return [TransactionNetwork.INITIA];

  const valid = raw.filter(
    (n): n is TransactionNetwork => typeof n === "string" && ALL_NETWORKS.includes(n as TransactionNetwork),
  );

  return valid.length > 0 ? valid : [TransactionNetwork.INITIA];
}

export function isNetworkEnabled(enabled: TransactionNetwork[], network: TransactionNetwork): boolean {
  return enabled.includes(network);
}
