import type {
  EventFormat,
  InspectTransactionInput,
  SolanaCluster,
  VerifyEventInput,
} from "../../packages/sdk/src/index.ts";

const DISCRIMINATOR_PATTERN = /^[0-9a-f]{16}$/;
const RECEIPT_ID_PATTERN = /^es_[0-9a-f]{64}$/;

type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; error: string };

type VerifyEventConfiguration = Omit<VerifyEventInput, "signature">;

export interface ServerRpcEnvironment {
  SOLANA_RPC_MAINNET_URL?: string;
  SOLANA_RPC_DEVNET_URL?: string;
  SOLANA_RPC_TESTNET_URL?: string;
  SOLANA_RPC_URL?: string;
  SOLANA_RPC_CLUSTER?: string;
}

/** Resolves only an endpoint explicitly bound to the requested network. */
export function applyServerRpcUrl<
  T extends Pick<InspectTransactionInput, "cluster">,
>(
  input: T,
  env: ServerRpcEnvironment,
): ValidationResult<T & { rpcUrl?: string }> {
  const names = {
    "mainnet-beta": "SOLANA_RPC_MAINNET_URL",
    devnet: "SOLANA_RPC_DEVNET_URL",
    testnet: "SOLANA_RPC_TESTNET_URL",
  } as const;
  let rpcUrl = env[names[input.cluster]];
  if (rpcUrl === undefined && env.SOLANA_RPC_URL !== undefined) {
    if (!isSolanaCluster(env.SOLANA_RPC_CLUSTER)) {
      return invalid(
        "Legacy SOLANA_RPC_URL requires an explicit SOLANA_RPC_CLUSTER binding",
      );
    }
    if (env.SOLANA_RPC_CLUSTER === input.cluster) rpcUrl = env.SOLANA_RPC_URL;
  }
  if (rpcUrl === undefined) {
    return { ok: true, value: input };
  }
  if (!isNonEmptyString(rpcUrl)) {
    return invalid("The configured cluster RPC URL must be non-empty");
  }
  try {
    const url = new URL(rpcUrl);
    if (url.protocol !== "https:")
      return invalid("The configured cluster RPC URL must use HTTPS");
  } catch {
    return invalid("The configured cluster RPC URL must be an absolute URL");
  }
  return { ok: true, value: { ...input, rpcUrl } };
}

/** Accepts only signature and cluster at the public inspection boundary. */
export function validateInspectTransactionInput(
  value: unknown,
): ValidationResult<InspectTransactionInput> {
  if (!isRecord(value)) return invalid("Request body must be a JSON object");
  if (
    Object.keys(value).some((key) => key !== "signature" && key !== "cluster")
  )
    return invalid("Only signature and cluster are accepted");
  if (
    typeof value.signature !== "string" ||
    !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value.signature)
  )
    return invalid("signature must be a base58 transaction signature");
  if (!isSolanaCluster(value.cluster))
    return invalid("cluster must be mainnet-beta, devnet, or testnet");
  return {
    ok: true,
    value: { signature: value.signature, cluster: value.cluster },
  };
}

export function validateVerifyEventInput(
  value: unknown,
): ValidationResult<VerifyEventInput> {
  if (!isRecord(value)) {
    return invalid("Request body must be a JSON object");
  }

  const signature = value.signature;
  if (!isNonEmptyString(signature)) {
    return invalid("signature must be a non-empty string");
  }

  const cluster = value.cluster;
  if (!isSolanaCluster(cluster)) {
    return invalid("cluster must be mainnet-beta, devnet, or testnet");
  }

  const expectedProgramId = value.expectedProgramId;
  if (!isNonEmptyString(expectedProgramId)) {
    return invalid("expectedProgramId must be a non-empty string");
  }

  const event = value.event;
  if (!isRecord(event)) {
    return invalid("event must be a JSON object");
  }

  const format = event.format;
  if (!isEventFormat(format)) {
    return invalid("event.format must be anchor-log or anchor-cpi");
  }

  const discriminator = event.discriminator;
  if (!isDiscriminator(discriminator)) {
    return invalid(
      "event.discriminator must be 16 lowercase hexadecimal characters",
    );
  }

  const commitment = value.commitment;
  if (commitment !== undefined && commitment !== "finalized") {
    return invalid("commitment must be finalized when provided");
  }

  if (value.rpcUrl !== undefined) {
    return invalid(
      "rpcUrl is not accepted by the hosted verify-event function",
    );
  }

  return {
    ok: true,
    value: {
      signature,
      cluster,
      expectedProgramId,
      event: { format, discriminator },
      commitment,
    },
  };
}

export function validateReceiptId(value: unknown): ValidationResult<string> {
  if (!isNonEmptyString(value)) {
    return invalid("receiptId is required");
  }
  if (!RECEIPT_ID_PATTERN.test(value)) {
    return invalid("receiptId must match the EventSeal receipt format");
  }
  return { ok: true, value };
}

export function validateHeliusPayload(
  value: unknown,
): ValidationResult<string[]> {
  if (!Array.isArray(value)) {
    return invalid("Expected an array of transactions");
  }

  const signatures = new Set<string>();
  for (const [index, transaction] of value.entries()) {
    if (!isRecord(transaction)) {
      return invalid(`Transaction at index ${index} must be a JSON object`);
    }

    const signature = transaction.signature;
    if (!isNonEmptyString(signature)) {
      return invalid(
        `Transaction at index ${index} requires a non-empty signature`,
      );
    }

    signatures.add(signature);
  }

  return { ok: true, value: [...signatures] };
}

export function validateWebhookConfiguration(
  env: ServerRpcEnvironment & {
    EVENTSEAL_CLUSTER?: string;
    EVENTSEAL_EXPECTED_PROGRAM_ID?: string;
    EVENTSEAL_EVENT_FORMAT?: string;
    EVENTSEAL_EVENT_DISCRIMINATOR?: string;
  },
): ValidationResult<VerifyEventConfiguration> {
  const cluster = env.EVENTSEAL_CLUSTER;
  if (!isSolanaCluster(cluster)) {
    return invalid(
      "EVENTSEAL_CLUSTER must be mainnet-beta, devnet, or testnet",
    );
  }

  const expectedProgramId = env.EVENTSEAL_EXPECTED_PROGRAM_ID;
  if (!isNonEmptyString(expectedProgramId)) {
    return invalid("EVENTSEAL_EXPECTED_PROGRAM_ID is required");
  }

  const format = env.EVENTSEAL_EVENT_FORMAT;
  if (!isEventFormat(format)) {
    return invalid("EVENTSEAL_EVENT_FORMAT must be anchor-log or anchor-cpi");
  }

  const discriminator = env.EVENTSEAL_EVENT_DISCRIMINATOR;
  if (!isDiscriminator(discriminator)) {
    return invalid(
      "EVENTSEAL_EVENT_DISCRIMINATOR must be 16 lowercase hexadecimal characters",
    );
  }

  return applyServerRpcUrl<VerifyEventConfiguration>(
    {
      cluster,
      expectedProgramId,
      event: { format, discriminator },
      commitment: "finalized",
    },
    env,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSolanaCluster(value: unknown): value is SolanaCluster {
  return value === "mainnet-beta" || value === "devnet" || value === "testnet";
}

function isEventFormat(value: unknown): value is EventFormat {
  return value === "anchor-log" || value === "anchor-cpi";
}

function isDiscriminator(value: unknown): value is string {
  return typeof value === "string" && DISCRIMINATOR_PATTERN.test(value);
}

function invalid(error: string): ValidationResult<never> {
  return { ok: false, error };
}
