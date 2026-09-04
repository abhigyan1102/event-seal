import type { InspectTransactionInput } from "@eventseal/sdk";

const CLUSTERS = new Set(["mainnet-beta", "devnet", "testnet"]);

export type BrowserInspectTransactionInput = Omit<
  InspectTransactionInput,
  "rpcUrl"
>;

export type InspectionRequestValidation =
  | { ok: true; value: BrowserInspectTransactionInput }
  | { ok: false; error: string };

export function validateBrowserInspectTransactionInput(
  value: unknown,
): InspectionRequestValidation {
  if (!isRecord(value)) {
    return invalid("Request body must be a JSON object");
  }
  if (value.rpcUrl !== undefined) {
    return invalid("rpcUrl is not accepted by the browser adapter");
  }
  if (
    Object.keys(value).some((key) => key !== "signature" && key !== "cluster")
  ) {
    return invalid("Only signature and cluster are accepted");
  }

  const signature = boundedString(value.signature, 128);
  if (!signature || !isBase58Bytes(signature, 64)) {
    return invalid(
      "signature must be a base58 transaction signature that decodes to 64 bytes",
    );
  }

  const cluster = value.cluster;
  if (typeof cluster !== "string" || !CLUSTERS.has(cluster)) {
    return invalid("cluster must be mainnet-beta, devnet, or testnet");
  }

  return {
    ok: true,
    value: {
      signature,
      cluster: cluster as BrowserInspectTransactionInput["cluster"],
    },
  };
}

export function isBase58Bytes(value: string, bytes: number): boolean {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  if (!value || value.length > 128) return false;
  let number = 0n;
  for (const character of value) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) return false;
    number = number * 58n + BigInt(digit);
  }
  const leadingZeros = value.match(/^1*/)?.[0].length ?? 0;
  const width = number === 0n ? 0 : Math.ceil(number.toString(16).length / 2);
  return leadingZeros + width === bytes;
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

function invalid(error: string): InspectionRequestValidation {
  return { ok: false, error };
}
