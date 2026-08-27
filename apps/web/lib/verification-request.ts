import type { VerifyEventInput } from "@eventseal/sdk";

const DISCRIMINATOR_PATTERN = /^[0-9a-f]{16}$/;
const CLUSTERS = new Set(["mainnet-beta", "devnet", "testnet"]);
const EVENT_FORMATS = new Set(["anchor-log", "anchor-cpi"]);

export type BrowserVerifyEventInput = Omit<VerifyEventInput, "rpcUrl">;

export type ValidationResult =
  { ok: true; value: BrowserVerifyEventInput } | { ok: false; error: string };

export function validateBrowserVerifyEventInput(
  value: unknown,
): ValidationResult {
  if (!isRecord(value)) {
    return invalid("Request body must be a JSON object");
  }

  if (value.rpcUrl !== undefined) {
    return invalid("rpcUrl is not accepted by the browser adapter");
  }

  const signature = boundedString(value.signature, 128);
  if (!signature) {
    return invalid(
      "signature must be a non-empty string of at most 128 characters",
    );
  }

  const cluster = value.cluster;
  if (typeof cluster !== "string" || !CLUSTERS.has(cluster)) {
    return invalid("cluster must be mainnet-beta, devnet, or testnet");
  }

  const expectedProgramId = boundedString(value.expectedProgramId, 64);
  if (!expectedProgramId) {
    return invalid(
      "expectedProgramId must be a non-empty string of at most 64 characters",
    );
  }

  if (!isRecord(value.event)) {
    return invalid("event must be a JSON object");
  }

  const format = value.event.format;
  if (typeof format !== "string" || !EVENT_FORMATS.has(format)) {
    return invalid("event.format must be anchor-log or anchor-cpi");
  }

  const discriminator = value.event.discriminator;
  if (
    typeof discriminator !== "string" ||
    !DISCRIMINATOR_PATTERN.test(discriminator)
  ) {
    return invalid(
      "event.discriminator must be 16 lowercase hexadecimal characters",
    );
  }

  if (value.commitment !== undefined && value.commitment !== "finalized") {
    return invalid("commitment must be finalized when provided");
  }

  return {
    ok: true,
    value: {
      signature,
      cluster: cluster as BrowserVerifyEventInput["cluster"],
      expectedProgramId,
      event: {
        format: format as BrowserVerifyEventInput["event"]["format"],
        discriminator,
      },
      commitment: "finalized",
    },
  };
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return undefined;
  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(error: string): ValidationResult {
  return { ok: false, error };
}
