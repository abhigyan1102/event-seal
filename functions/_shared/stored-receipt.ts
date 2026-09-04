import {
  createReceiptId,
  createVerificationReceiptId,
  type EventFormat,
  type SolanaCluster,
  type VerificationEvidence,
  type VerificationReasonCode,
  type VerificationVerdict,
} from "../../packages/sdk/src/index.ts";

export const STORED_RECEIPT_COLUMNS = [
  "receipt_version",
  "receipt_id",
  "signature",
  "cluster",
  "commitment",
  "slot",
  "verdict",
  "reason_code",
  "reason",
  "expected_program_id",
  "event_format",
  "event_discriminator",
  "emitter_program_id",
  "event_position",
  "event_data_hash",
  "evidence",
  "created_at",
].join(",");

interface StoredReceiptBase {
  receipt_id: string;
  signature: string;
  cluster: SolanaCluster;
  slot: number | null;
  verdict: VerificationVerdict;
  reason_code: VerificationReasonCode;
  emitter_program_id: string;
  event_position: number;
  event_data_hash: string;
  evidence: VerificationEvidence[];
  created_at: string;
}

export interface LegacyStoredReceipt extends StoredReceiptBase {
  receipt_version: 1;
  commitment: null;
  reason: null;
  expected_program_id: null;
  event_format: null;
  event_discriminator: null;
}

export interface StoredReceiptV2 extends StoredReceiptBase {
  receipt_version: 2;
  commitment: "finalized";
  reason: string;
  expected_program_id: string;
  event_format: EventFormat;
  event_discriminator: string;
}

export type StoredVerificationReceipt = LegacyStoredReceipt | StoredReceiptV2;

const RECEIPT_KEYS = new Set(STORED_RECEIPT_COLUMNS.split(","));
const RECEIPT_ID_PATTERN = /^es_[0-9a-f]{64}$/;
const EVENT_HASH_PATTERN = /^[0-9a-f]{64}$/;
const DISCRIMINATOR_PATTERN = /^[0-9a-f]{16}$/;
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

export function isStoredVerificationReceipt(
  value: unknown,
): value is StoredVerificationReceipt {
  if (!isRecord(value) || !hasExactKeys(value, RECEIPT_KEYS)) return false;
  if (
    typeof value.receipt_id !== "string" ||
    !RECEIPT_ID_PATTERN.test(value.receipt_id) ||
    !isNonEmptyString(value.signature) ||
    !isCluster(value.cluster) ||
    !isNullableNonNegativeInteger(value.slot) ||
    !isOneOf(value.verdict, VERDICTS) ||
    !isOneOf(value.reason_code, REASON_CODES) ||
    !isNonEmptyString(value.emitter_program_id) ||
    !isNonNegativeInteger(value.event_position) ||
    typeof value.event_data_hash !== "string" ||
    !EVENT_HASH_PATTERN.test(value.event_data_hash) ||
    !Array.isArray(value.evidence) ||
    !value.evidence.every(isVerificationEvidence) ||
    typeof value.created_at !== "string" ||
    Number.isNaN(Date.parse(value.created_at))
  ) {
    return false;
  }

  if (value.receipt_version === 1) {
    if (
      value.commitment !== null ||
      value.reason !== null ||
      value.expected_program_id !== null ||
      value.event_format !== null ||
      value.event_discriminator !== null
    ) {
      return false;
    }

    return (
      value.receipt_id ===
      createReceiptId({
        cluster: value.cluster,
        signature: value.signature,
        event: {
          emitterProgramId: value.emitter_program_id,
          eventPosition: value.event_position,
          eventDataHash: value.event_data_hash,
        },
      })
    );
  }

  if (
    value.receipt_version !== 2 ||
    value.commitment !== "finalized" ||
    !isNonEmptyString(value.reason) ||
    !isNonEmptyString(value.expected_program_id) ||
    !isEventFormat(value.event_format) ||
    typeof value.event_discriminator !== "string" ||
    !DISCRIMINATOR_PATTERN.test(value.event_discriminator)
  ) {
    return false;
  }

  return (
    value.receipt_id ===
    createVerificationReceiptId({
      cluster: value.cluster,
      commitment: value.commitment,
      signature: value.signature,
      expectedProgramId: value.expected_program_id,
      eventFormat: value.event_format,
      eventDiscriminator: value.event_discriminator,
      event: {
        emitterProgramId: value.emitter_program_id,
        eventPosition: value.event_position,
        eventDataHash: value.event_data_hash,
      },
    })
  );
}

function isVerificationEvidence(value: unknown): value is VerificationEvidence {
  return (
    isRecord(value) &&
    hasExactKeys(value, new Set(["check", "passed", "detail"])) &&
    isNonEmptyString(value.check) &&
    typeof value.passed === "boolean" &&
    isNonEmptyString(value.detail)
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: ReadonlySet<string>,
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.size && keys.every((key) => expected.has(key))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCluster(value: unknown): value is SolanaCluster {
  return value === "mainnet-beta" || value === "devnet" || value === "testnet";
}

function isEventFormat(value: unknown): value is EventFormat {
  return value === "anchor-log" || value === "anchor-cpi";
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || isNonNegativeInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}
