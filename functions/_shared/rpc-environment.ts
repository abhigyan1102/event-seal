import type { ServerRpcEnvironment } from "./validation.ts";

/** Keeps all hosted entry points on the same cluster-specific RPC policy. */
export function readRpcEnvironment(
  getEnv: (name: string) => string | undefined,
): ServerRpcEnvironment {
  return {
    SOLANA_RPC_MAINNET_URL: getEnv("SOLANA_RPC_MAINNET_URL"),
    SOLANA_RPC_DEVNET_URL: getEnv("SOLANA_RPC_DEVNET_URL"),
    SOLANA_RPC_TESTNET_URL: getEnv("SOLANA_RPC_TESTNET_URL"),
    SOLANA_RPC_URL: getEnv("SOLANA_RPC_URL"),
    SOLANA_RPC_CLUSTER: getEnv("SOLANA_RPC_CLUSTER"),
  };
}
