/**
 * Shared fixtures and helpers for SDK unit tests.
 *
 * Provides reusable program IDs, discriminators, encoded event data,
 * log line builders, and mock RPC response factories.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Canonical expected program ID (matches the demo Anchor program). */
export const EXPECTED_PROGRAM = "AMWm3XHjn6zVygWDX6J7DYPvvwQ6xy3mKKwspWJeuZVS";

/** An attacker or unrelated program ID. */
export const ATTACKER_PROGRAM = "11111111111111111111111111111111";

/** A secondary unrelated program for nested CPI scenarios. */
export const OUTER_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

/** 8-byte discriminator as 16 lowercase hex characters. */
export const DISCRIMINATOR = "bf91ff47ac4cb187";

/** A different valid discriminator. */
export const WRONG_DISCRIMINATOR = "aabbccddeeff0011";

/** DemoEvent payload for nonce 42 (discriminator + u64 little-endian nonce). */
export const EVENT_DATA_B64 = Buffer.from(
  "bf91ff47ac4cb1872a00000000000000",
  "hex",
).toString("base64");

/** Event payload with a different discriminator. */
export const WRONG_DISC_EVENT_B64 = Buffer.from(
  "aabbccddeeff00110203",
  "hex",
).toString("base64");

/** Base64 that decodes to fewer than 8 bytes (too short for a discriminator). */
export const SHORT_EVENT_B64 = Buffer.from("010203", "hex").toString("base64");

/** Invalid base64 string. */
export const MALFORMED_B64 = "!!!not-base64!!!";

// ---------------------------------------------------------------------------
// Log line builders
// ---------------------------------------------------------------------------

export function invokeLog(programId: string, depth: number): string {
  return `Program ${programId} invoke [${depth}]`;
}

export function successLog(programId: string): string {
  return `Program ${programId} success`;
}

export function failedLog(programId: string, message = "error"): string {
  return `Program ${programId} failed: ${message}`;
}

export function dataLog(b64: string): string {
  return `Program data: ${b64}`;
}

// ---------------------------------------------------------------------------
// Pre-built log arrays
// ---------------------------------------------------------------------------

/** Successful single event emitted by the expected program. */
export function successfulEventLogs(): string[] {
  return [
    invokeLog(EXPECTED_PROGRAM, 1),
    dataLog(EVENT_DATA_B64),
    successLog(EXPECTED_PROGRAM),
  ];
}

/** Event emitted by an attacker program (same discriminator, wrong emitter). */
export function attackerEventLogs(): string[] {
  return [
    invokeLog(ATTACKER_PROGRAM, 1),
    dataLog(EVENT_DATA_B64),
    successLog(ATTACKER_PROGRAM),
  ];
}

/** Event emitted by expected program but with wrong discriminator. */
export function wrongDiscriminatorLogs(): string[] {
  return [
    invokeLog(EXPECTED_PROGRAM, 1),
    dataLog(WRONG_DISC_EVENT_B64),
    successLog(EXPECTED_PROGRAM),
  ];
}

/** Two identical events from expected program → AMBIGUOUS_EVENT. */
export function duplicateEventLogs(): string[] {
  return [
    invokeLog(EXPECTED_PROGRAM, 1),
    dataLog(EVENT_DATA_B64),
    dataLog(EVENT_DATA_B64),
    successLog(EXPECTED_PROGRAM),
  ];
}

/** Nested CPI: outer program invokes inner (expected) program which emits. */
export function nestedCpiLogs(): string[] {
  return [
    invokeLog(OUTER_PROGRAM, 1),
    invokeLog(EXPECTED_PROGRAM, 2),
    dataLog(EVENT_DATA_B64),
    successLog(EXPECTED_PROGRAM),
    successLog(OUTER_PROGRAM),
  ];
}

/** Nested CPI: outer program invokes inner (attacker) which emits matching bytes. */
export function nestedCpiAttackerLogs(): string[] {
  return [
    invokeLog(EXPECTED_PROGRAM, 1),
    invokeLog(ATTACKER_PROGRAM, 2),
    dataLog(EVENT_DATA_B64),
    successLog(ATTACKER_PROGRAM),
    successLog(EXPECTED_PROGRAM),
  ];
}

/** Logs with no "Program data:" lines at all. */
export function noDataLogs(): string[] {
  return [
    invokeLog(EXPECTED_PROGRAM, 1),
    "Program log: some irrelevant log message",
    successLog(EXPECTED_PROGRAM),
  ];
}

/** Logs with malformed base64 in the data line. */
export function malformedBase64Logs(): string[] {
  return [
    invokeLog(EXPECTED_PROGRAM, 1),
    dataLog(MALFORMED_B64),
    successLog(EXPECTED_PROGRAM),
  ];
}

/** Logs with data too short for an 8-byte discriminator. */
export function shortDataLogs(): string[] {
  return [
    invokeLog(EXPECTED_PROGRAM, 1),
    dataLog(SHORT_EVENT_B64),
    successLog(EXPECTED_PROGRAM),
  ];
}

// ---------------------------------------------------------------------------
// Mock RPC response factories
// ---------------------------------------------------------------------------

interface MockStatus {
  confirmationStatus?: "processed" | "confirmed" | "finalized" | null;
  err: unknown;
  slot: number;
}

interface MockTransaction {
  slot: number;
  meta: {
    err: unknown;
    logMessages: string[] | null;
  } | null;
}

interface MockFetchResult {
  status: MockStatus | null;
  transaction: MockTransaction | null;
}

/** Finalized, successful transaction with the given logs. */
export function finalizedSuccessTx(logs: string[]): MockFetchResult {
  return {
    status: { confirmationStatus: "finalized", err: null, slot: 100 },
    transaction: {
      slot: 100,
      meta: { err: null, logMessages: logs },
    },
  };
}

/** Finalized but failed transaction (meta.err is non-null). */
export function finalizedFailedTx(logs: string[]): MockFetchResult {
  return {
    status: { confirmationStatus: "finalized", err: null, slot: 100 },
    transaction: {
      slot: 100,
      meta: {
        err: { InstructionError: [0, "Custom"] },
        logMessages: logs,
      },
    },
  };
}

/** Transaction exists but is not finalized (confirmed only). */
export function confirmedOnlyTx(): MockFetchResult {
  return {
    status: { confirmationStatus: "confirmed", err: null, slot: 100 },
    transaction: {
      slot: 100,
      meta: { err: null, logMessages: [] },
    },
  };
}

/** Transaction exists but metadata is null. */
export function noMetadataTx(): MockFetchResult {
  return {
    status: { confirmationStatus: "finalized", err: null, slot: 100 },
    transaction: { slot: 100, meta: null },
  };
}

/** Transaction exists, finalized, but logs are null. */
export function noLogsTx(): MockFetchResult {
  return {
    status: { confirmationStatus: "finalized", err: null, slot: 100 },
    transaction: {
      slot: 100,
      meta: { err: null, logMessages: null },
    },
  };
}

/** Transaction not found (null from RPC). */
export function notFoundTx(): MockFetchResult {
  return {
    status: null,
    transaction: null,
  };
}
