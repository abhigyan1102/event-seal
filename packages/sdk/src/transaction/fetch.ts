import type { VerifyEventInput } from "../types.js";

interface SignatureStatus {
  confirmationStatus?: "processed" | "confirmed" | "finalized" | null;
  err: unknown;
  slot: number;
}

export interface FinalizedTransaction {
  slot: number;
  meta: {
    err: unknown;
    logMessages: string[] | null;
  } | null;
}

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

const PUBLIC_RPC_ENDPOINTS: Record<VerifyEventInput["cluster"], string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

async function rpcRequest<T>(
  endpoint: string,
  method: string,
  params: unknown[],
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Solana RPC returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as JsonRpcResponse<T>;
  if (payload.error) {
    throw new Error(
      `Solana RPC ${payload.error.code}: ${payload.error.message}`,
    );
  }
  if (!("result" in payload)) {
    throw new Error("Solana RPC response did not include a result.");
  }

  return payload.result as T;
}

export async function fetchFinalizedTransaction(input: VerifyEventInput) {
  const endpoint = input.rpcUrl ?? PUBLIC_RPC_ENDPOINTS[input.cluster];
  const [statusResponse, transaction] = await Promise.all([
    rpcRequest<{
      context: { slot: number };
      value: Array<SignatureStatus | null>;
    }>(endpoint, "getSignatureStatuses", [
      [input.signature],
      { searchTransactionHistory: true },
    ]),
    rpcRequest<FinalizedTransaction | null>(endpoint, "getTransaction", [
      input.signature,
      {
        commitment: "finalized",
        encoding: "json",
        maxSupportedTransactionVersion: 0,
      },
    ]),
  ]);

  return {
    status: statusResponse.value[0] ?? null,
    transaction,
  };
}
