import type {
  VerificationEvidence,
  VerificationReasonCode,
  VerificationResult,
  VerificationVerdict,
} from "@eventseal/sdk";

const VERDICTS: readonly VerificationVerdict[] = [
  "verified",
  "rejected",
  "indeterminate",
];

const REASON_CODES: readonly VerificationReasonCode[] = [
  "VERIFIED",
  "TX_FAILED",
  "TX_NOT_FOUND",
  "TX_NOT_FINALIZED",
  "RPC_UNAVAILABLE",
  "METADATA_MISSING",
  "LOGS_UNAVAILABLE",
  "EVENT_NOT_FOUND",
  "AMBIGUOUS_EVENT",
  "PROGRAM_MISMATCH",
  "DISCRIMINATOR_MISMATCH",
  "CPI_EVENT_UNSUPPORTED",
  "INVALID_REQUEST",
];

export function isVerificationResult(
  value: unknown,
): value is VerificationResult {
  if (!isRecord(value)) return false;

  return (
    isOneOf(value.verdict, VERDICTS) &&
    isOneOf(value.reasonCode, REASON_CODES) &&
    typeof value.reason === "string" &&
    typeof value.signature === "string" &&
    isOneOf(value.cluster, ["mainnet-beta", "devnet", "testnet"] as const) &&
    value.commitment === "finalized" &&
    isOptionalNonNegativeInteger(value.slot) &&
    typeof value.expectedProgramId === "string" &&
    isOptionalString(value.receiptId) &&
    isOptionalEventEvidence(value.event) &&
    Array.isArray(value.evidence) &&
    value.evidence.every(isVerificationEvidence)
  );
}

function isVerificationEvidence(value: unknown): value is VerificationEvidence {
  return (
    isRecord(value) &&
    typeof value.check === "string" &&
    typeof value.passed === "boolean" &&
    typeof value.detail === "string"
  );
}

function isOptionalEventEvidence(value: unknown): boolean {
  if (value === undefined) return true;
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.eventPosition) &&
    typeof value.emitterProgramId === "string" &&
    typeof value.eventDataHash === "string"
  );
}

function isOptionalNonNegativeInteger(value: unknown): boolean {
  return value === undefined || isNonNegativeInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
