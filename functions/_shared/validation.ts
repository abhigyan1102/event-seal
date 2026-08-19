import type {
  EventFormat,
  SolanaCluster,
  VerifyEventInput,
} from "../../packages/sdk/src/index.ts";

const DISCRIMINATOR_PATTERN = /^[0-9a-f]{16}$/;
const RECEIPT_ID_PATTERN = /^es_[0-9a-f]{64}$/;

type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; error: string };

type VerifyEventConfiguration = Omit<VerifyEventInput, "signature">;

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

  const rpcUrl = value.rpcUrl;
  if (rpcUrl !== undefined && !isNonEmptyString(rpcUrl)) {
    return invalid("rpcUrl must be a non-empty string when provided");
  }

  return {
    ok: true,
    value: {
      signature,
      cluster,
      expectedProgramId,
      event: { format, discriminator },
      commitment,
      rpcUrl,
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

export function validateWebhookConfiguration(env: {
  EVENTSEAL_CLUSTER?: string;
  EVENTSEAL_EXPECTED_PROGRAM_ID?: string;
  EVENTSEAL_EVENT_FORMAT?: string;
  EVENTSEAL_EVENT_DISCRIMINATOR?: string;
  SOLANA_RPC_URL?: string;
}): ValidationResult<VerifyEventConfiguration> {
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

  const rpcUrl = env.SOLANA_RPC_URL;
  if (rpcUrl !== undefined && !isNonEmptyString(rpcUrl)) {
    return invalid("SOLANA_RPC_URL must be a non-empty string when provided");
  }

  return {
    ok: true,
    value: {
      cluster,
      expectedProgramId,
      event: { format, discriminator },
      commitment: "finalized",
      rpcUrl,
    },
  };
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
