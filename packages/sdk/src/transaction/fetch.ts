import type { InspectTransactionInput, SolanaCluster } from "../types.js";

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

const PUBLIC_RPC_ENDPOINTS: Record<SolanaCluster, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

// Full getGenesisHash values, not the shortened CAIP-2 chain identifiers.
const GENESIS_HASHES: Record<SolanaCluster, string> = {
  "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSlot(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Bounds provider responses while streaming, before JSON parsing. */
async function readRpcJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("Solana RPC response body missing.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2 * 1024 * 1024) {
        void reader.cancel().catch(() => {});
        throw new Error("Solana RPC response too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally {
    reader.releaseLock();
  }
}

async function rpcRequest(
  endpoint: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error(`Solana RPC returned HTTP ${response.status}.`);
  }

  const payload = await readRpcJson(response);
  if (
    !isRecord(payload) ||
    payload.jsonrpc !== "2.0" ||
    payload.id !== 1 ||
    payload.error ||
    !Object.hasOwn(payload, "result")
  ) {
    throw new Error("Solana RPC returned an invalid or error response.");
  }

  return payload.result;
}

export async function fetchFinalizedTransaction(
  input: InspectTransactionInput,
): Promise<{
  status: SignatureStatus | null;
  transaction: FinalizedTransaction | null;
}> {
  const endpoint = input.rpcUrl ?? PUBLIC_RPC_ENDPOINTS[input.cluster];
  // Check each request: a configured URL must not silently relabel another cluster.
  if (
    !GENESIS_HASHES[input.cluster] ||
    (await rpcRequest(endpoint, "getGenesisHash", [])) !==
      GENESIS_HASHES[input.cluster]
  ) {
    throw new Error("Solana RPC network does not match the requested cluster.");
  }
  const [statusResponse, transaction] = await Promise.all([
    rpcRequest(endpoint, "getSignatureStatuses", [
      [input.signature],
      { searchTransactionHistory: true },
    ]),
    rpcRequest(endpoint, "getTransaction", [
      input.signature,
      {
        commitment: "finalized",
        encoding: "json",
        maxSupportedTransactionVersion: 0,
      },
    ]),
  ]);

  if (
    !isRecord(statusResponse) ||
    !Array.isArray(statusResponse.value) ||
    statusResponse.value.length !== 1
  ) {
    throw new Error("Solana RPC returned invalid signature status.");
  }
  const status: unknown = statusResponse.value[0];
  if (
    status !== null &&
    (!isRecord(status) ||
      !isSlot(status.slot) ||
      !Object.hasOwn(status, "err") ||
      ![undefined, null, "processed", "confirmed", "finalized"].includes(
        status.confirmationStatus as string | null | undefined,
      ))
  ) {
    throw new Error("Solana RPC returned invalid signature status.");
  }
  if (transaction !== null) {
    if (
      !isRecord(transaction) ||
      !isSlot(transaction.slot) ||
      !Object.hasOwn(transaction, "meta")
    ) {
      throw new Error("Solana RPC returned invalid transaction metadata.");
    }
    const meta = transaction.meta;
    if (
      meta !== null &&
      (!isRecord(meta) ||
        !Object.hasOwn(meta, "err") ||
        (meta.logMessages !== null &&
          (!Array.isArray(meta.logMessages) ||
            !meta.logMessages.every((line) => typeof line === "string"))))
    ) {
      throw new Error("Solana RPC returned invalid transaction metadata.");
    }
    if (
      isRecord(status) &&
      (status.slot !== transaction.slot ||
        (isRecord(meta) && (status.err === null) !== (meta.err === null)))
    ) {
      throw new Error("Solana RPC returned inconsistent transaction evidence.");
    }
  }
  return {
    status: status as SignatureStatus | null,
    transaction: transaction as FinalizedTransaction | null,
  };
}
