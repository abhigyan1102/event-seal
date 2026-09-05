import "server-only";

import {
  createReceiptId,
  createVerificationReceiptId,
  type EventFormat,
  type SolanaCluster,
  type VerificationEvidence,
  type VerificationReasonCode,
  type VerificationVerdict,
} from "@eventseal/sdk";
import { createClient } from "@insforge/sdk";

import { getAuthConfig } from "./auth-config";
import { isReceiptId } from "./receipt-id";

export const PUBLIC_RECEIPT_COLUMNS = [
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

interface PublicReceiptBase {
  receipt_version: 1 | 2;
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

export interface LegacyPublicReceipt extends PublicReceiptBase {
  receipt_version: 1;
  commitment: null;
  reason: null;
  expected_program_id: null;
  event_format: null;
  event_discriminator: null;
}

export interface PublicReceiptV2 extends PublicReceiptBase {
  receipt_version: 2;
  commitment: "finalized";
  reason: string;
  expected_program_id: string;
  event_format: EventFormat;
  event_discriminator: string;
}

export type PublicReceipt = LegacyPublicReceipt | PublicReceiptV2;

export type PublicReceiptLookup =
  | { status: "found"; receipt: PublicReceipt }
  | { status: "malformed" }
  | { status: "missing" }
  | { status: "unavailable" };

interface ReceiptLookupResponse {
  data: unknown;
  error: unknown;
}

interface ReceiptClient {
  database: {
    from(table: string): {
      select(columns: string): {
        eq(
          column: string,
          value: string,
        ): {
          maybeSingle(): Promise<ReceiptLookupResponse>;
        };
      };
    };
  };
}

interface PublicReceiptDependencies {
  configuration(): { baseUrl: string; anonKey: string };
  client(options: { baseUrl: string; anonKey: string }): ReceiptClient;
}

const defaultDependencies: PublicReceiptDependencies = {
  configuration: getAuthConfig,
  client: (options) => createClient(options) as unknown as ReceiptClient,
};

const RECEIPT_KEYS = new Set(PUBLIC_RECEIPT_COLUMNS.split(","));
const EVENT_HASH_PATTERN = /^[0-9a-f]{64}$/;
const DISCRIMINATOR_PATTERN = /^[0-9a-f]{16}$/;
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/;
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
const VERDICT_BY_REASON_CODE = {
  VERIFIED: "verified",
  TX_FAILED: "rejected",
  TX_NOT_FOUND: "indeterminate",
  TX_NOT_FINALIZED: "indeterminate",
  RPC_UNAVAILABLE: "indeterminate",
  METADATA_MISSING: "indeterminate",
  LOGS_UNAVAILABLE: "indeterminate",
  EVENT_NOT_FOUND: "indeterminate",
  AMBIGUOUS_EVENT: "indeterminate",
  PROGRAM_MISMATCH: "rejected",
  DISCRIMINATOR_MISMATCH: "rejected",
  CPI_EVENT_UNSUPPORTED: "indeterminate",
  INVALID_REQUEST: "indeterminate",
} as const satisfies Record<VerificationReasonCode, VerificationVerdict>;

export async function loadPublicReceipt(
  receiptId: string,
  dependencies: PublicReceiptDependencies = defaultDependencies,
): Promise<PublicReceiptLookup> {
  if (!isReceiptId(receiptId)) return { status: "malformed" };

  try {
    const { baseUrl, anonKey } = dependencies.configuration();
    const { data, error } = await dependencies
      .client({ baseUrl, anonKey })
      .database.from("verification_receipts")
      .select(PUBLIC_RECEIPT_COLUMNS)
      .eq("receipt_id", receiptId)
      .maybeSingle();

    if (error) return { status: "unavailable" };
    if (data === null || data === undefined) return { status: "missing" };
    if (!isPublicReceipt(data) || data.receipt_id !== receiptId) {
      return { status: "unavailable" };
    }

    return { status: "found", receipt: data };
  } catch {
    return { status: "unavailable" };
  }
}

export function isPublicReceipt(value: unknown): value is PublicReceipt {
  if (!isRecord(value) || !hasExactKeys(value, RECEIPT_KEYS)) return false;
  if (
    (value.receipt_version !== 1 && value.receipt_version !== 2) ||
    typeof value.receipt_id !== "string" ||
    !isReceiptId(value.receipt_id) ||
    !isNonEmptyString(value.signature) ||
    !isCluster(value.cluster) ||
    !isNullableNonNegativeInteger(value.slot) ||
    !isOneOf(value.verdict, VERDICTS) ||
    !isOneOf(value.reason_code, REASON_CODES) ||
    VERDICT_BY_REASON_CODE[value.reason_code] !== value.verdict ||
    !isNonEmptyString(value.emitter_program_id) ||
    !isNonNegativeInteger(value.event_position) ||
    typeof value.event_data_hash !== "string" ||
    !EVENT_HASH_PATTERN.test(value.event_data_hash) ||
    !Array.isArray(value.evidence) ||
    !value.evidence.every(isVerificationEvidence) ||
    !isStrictTimestamp(value.created_at)
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

function isStrictTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return false;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day >= 1 && day <= (daysInMonth[month - 1] ?? 0);
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}
