import type { TransactionInspection } from "@eventseal/sdk";

const CLUSTERS = new Set(["mainnet-beta", "devnet", "testnet"]);
const FINALITIES = new Set(["processed", "confirmed", "finalized", "unknown"]);
const EXECUTIONS = new Set(["succeeded", "failed", "unknown"]);
const LOG_STATUSES = new Set(["available", "unavailable", "incomplete"]);
const REASON_CODES = new Set([
  "CANDIDATES_FOUND",
  "NO_SUPPORTED_LOG_EVENT",
  "LOGS_INCOMPLETE",
  "LOGS_UNAVAILABLE",
  "METADATA_MISSING",
  "TX_FAILED",
  "TX_NOT_FOUND",
  "TX_NOT_FINALIZED",
  "RPC_UNAVAILABLE",
  "INVALID_REQUEST",
]);
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HEX_16 = /^[0-9a-f]{16}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const INSPECTION_KEYS = new Set([
  "kind",
  "signature",
  "cluster",
  "finality",
  "execution",
  "slot",
  "reasonCode",
  "invokedPrograms",
  "logsStatus",
  "candidates",
]);
const CANDIDATE_KEYS = new Set([
  "eventPosition",
  "emitterProgramId",
  "eventDataHash",
  "discriminator",
  "dataBase64",
]);

export function isTransactionInspection(
  value: unknown,
): value is TransactionInspection {
  if (!isRecord(value)) return false;
  return (
    hasOnlyKeys(value, INSPECTION_KEYS) &&
    value.kind === "transaction-inspection" &&
    typeof value.signature === "string" &&
    typeof value.cluster === "string" &&
    CLUSTERS.has(value.cluster) &&
    typeof value.finality === "string" &&
    FINALITIES.has(value.finality) &&
    typeof value.execution === "string" &&
    EXECUTIONS.has(value.execution) &&
    isOptionalNonNegativeInteger(value.slot) &&
    typeof value.reasonCode === "string" &&
    REASON_CODES.has(value.reasonCode) &&
    Array.isArray(value.invokedPrograms) &&
    value.invokedPrograms.length <= 128 &&
    value.invokedPrograms.every(
      (program) => typeof program === "string" && BASE58_ADDRESS.test(program),
    ) &&
    typeof value.logsStatus === "string" &&
    LOG_STATUSES.has(value.logsStatus) &&
    Array.isArray(value.candidates) &&
    value.candidates.length <= 128 &&
    value.candidates.every(isLogEventCandidate)
  );
}

function isLogEventCandidate(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, CANDIDATE_KEYS) &&
    isNonNegativeInteger(value.eventPosition) &&
    typeof value.emitterProgramId === "string" &&
    BASE58_ADDRESS.test(value.emitterProgramId) &&
    typeof value.eventDataHash === "string" &&
    HEX_64.test(value.eventDataHash) &&
    typeof value.discriminator === "string" &&
    HEX_16.test(value.discriminator) &&
    typeof value.dataBase64 === "string" &&
    value.dataBase64.length <= 350_000 &&
    BASE64.test(value.dataBase64)
  );
}

function isOptionalNonNegativeInteger(value: unknown): boolean {
  return value === undefined || isNonNegativeInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}
