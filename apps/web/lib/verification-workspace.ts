import type {
  VerificationReasonCode,
  VerificationResult,
  SolanaCluster,
} from "@eventseal/sdk";

import demo from "../../../tests/fixtures/devnet-demo.json";
import type { BrowserVerifyEventInput } from "./verification-request";

export type RequestField = "signature" | "expectedProgramId" | "discriminator";
export type FieldErrors = Partial<Record<RequestField, string>>;

export function emptyVerificationRequest(): BrowserVerifyEventInput {
  return {
    signature: "",
    cluster: "devnet",
    expectedProgramId: "",
    event: { format: "anchor-log", discriminator: "" },
    commitment: "finalized",
  };
}

export function exampleRequest(
  kind: "success" | "failure",
): BrowserVerifyEventInput {
  return {
    signature: demo.transactions[kind].signature,
    cluster: "devnet",
    expectedProgramId: demo.programId,
    event: { format: "anchor-log", discriminator: demo.event.discriminator },
    commitment: "finalized",
  };
}

export function normalizeRequest(
  request: BrowserVerifyEventInput,
): BrowserVerifyEventInput {
  return {
    ...request,
    signature: request.signature.trim(),
    expectedProgramId: request.expectedProgramId.trim(),
    event: {
      ...request.event,
      discriminator: request.event.discriminator.trim().toLowerCase(),
    },
  };
}

// Check both the alphabet and decoded width; character count alone is not enough.
function isBase58Bytes(value: string, bytes: number): boolean {
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

export function validateWorkspaceRequest(
  request: BrowserVerifyEventInput,
): FieldErrors {
  const errors: FieldErrors = {};
  const value = normalizeRequest(request);
  if (!isBase58Bytes(value.signature, 64))
    errors.signature =
      "Enter a complete Solana transaction signature (64 bytes in base58), not a wallet address or URL.";
  if (!isBase58Bytes(value.expectedProgramId, 32))
    errors.expectedProgramId =
      "Enter the emitting program’s address (32 bytes in base58), not your wallet address.";
  if (!/^[0-9a-f]{16}$/.test(value.event.discriminator))
    errors.discriminator =
      "Enter exactly 16 hexadecimal characters for the eight-byte event discriminator.";
  return errors;
}

export const clusterLabels: Record<SolanaCluster, string> = {
  devnet: "Devnet",
  "mainnet-beta": "Mainnet beta",
  testnet: "Testnet",
};

export function transactionUrl(
  signature: string,
  cluster: SolanaCluster,
): string {
  const url = new URL(
    `https://explorer.solana.com/tx/${encodeURIComponent(signature)}`,
  );
  if (cluster !== "mainnet-beta") url.searchParams.set("cluster", cluster);
  return url.toString();
}

export function resultMatchesRequest(
  result: VerificationResult,
  request: BrowserVerifyEventInput,
): boolean {
  return (
    result.signature === request.signature &&
    result.cluster === request.cluster &&
    result.expectedProgramId === request.expectedProgramId &&
    result.commitment === "finalized"
  );
}

export const verdictTitles = {
  verified: "Event verified",
  rejected: "Event rejected",
  indeterminate: "Verification inconclusive",
} as const;

export const reasonGuidance: Record<VerificationReasonCode, string> = {
  VERIFIED:
    "The event passed the verifier’s checks. Apply your own business rules before taking action.",
  TX_FAILED:
    "Do not act on these logs. The transaction failed, even if it emitted matching event bytes.",
  TX_NOT_FOUND:
    "Check the signature and cluster. If this transaction is recent, wait and retry; older evidence may require an archival RPC.",
  TX_NOT_FINALIZED:
    "Wait for finalization, then retry. Do not treat an unfinalized transaction as verified.",
  RPC_UNAVAILABLE:
    "The RPC could not supply reliable evidence. Retry later; no verification decision can be trusted yet.",
  METADATA_MISSING:
    "Required transaction metadata is missing. Retry later or ask the backend operator to check its RPC provider.",
  LOGS_UNAVAILABLE:
    "Complete logs are unavailable. Do not infer success from partial logs; check the RPC provider’s retained evidence.",
  EVENT_NOT_FOUND:
    "No matching event was found. Confirm this program emits Anchor log events and check its event definition.",
  AMBIGUOUS_EVENT:
    "The evidence cannot be attributed unambiguously. Do not act automatically; inspect the invocation logs.",
  PROGRAM_MISMATCH:
    "The event did not match the expected emitting program. Check the program’s trusted deployment address; do not change it merely to obtain a pass.",
  DISCRIMINATOR_MISMATCH:
    "The event bytes did not match the expected discriminator. Check the event definition in the program’s IDL or source.",
  CPI_EVENT_UNSUPPORTED:
    "Anchor CPI events are not supported. This verifier currently supports eight-byte Anchor log events only.",
  INVALID_REQUEST:
    "Check the transaction signature, cluster, expected program, and event discriminator, then submit again.",
};

export function evidenceLabel(check: string): string {
  const labels: Record<string, string> = {
    rpc: "RPC evidence",
    finality: "Transaction finality",
    execution: "Transaction execution",
    attribution: "Event attribution",
  };
  return Object.hasOwn(labels, check) ? (labels[check] ?? check) : check;
}
