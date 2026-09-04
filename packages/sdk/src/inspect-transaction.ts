import { inspectLogs } from "./events/inspect-logs.js";
import { fetchFinalizedTransaction } from "./transaction/fetch.js";
import type {
  InspectTransactionInput,
  TransactionInspection,
} from "./types.js";

/** Reads transaction evidence without verifying an expected event or issuing a receipt. */
export async function inspectTransaction(
  input: InspectTransactionInput,
): Promise<TransactionInspection> {
  const result: TransactionInspection = {
    kind: "transaction-inspection",
    signature: input.signature,
    cluster: input.cluster,
    execution: "unknown",
    finality: "unknown",
    reasonCode: "INVALID_REQUEST",
    logsStatus: "unavailable",
    invokedPrograms: [],
    candidates: [],
  };
  if (
    !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(input.signature) ||
    !["mainnet-beta", "devnet", "testnet"].includes(input.cluster)
  )
    return result;
  try {
    const { status, transaction } = await fetchFinalizedTransaction(input);
    result.finality = status?.confirmationStatus ?? "unknown";
    if (status) {
      result.slot = status.slot;
      result.execution = status.err === null ? "succeeded" : "failed";
    }
    if (!transaction) {
      result.reasonCode =
        status && result.finality !== "finalized"
          ? "TX_NOT_FINALIZED"
          : "TX_NOT_FOUND";
      return result;
    }
    result.slot = transaction.slot;
    if (result.finality !== "finalized") {
      result.reasonCode = "TX_NOT_FINALIZED";
      return result;
    }
    if (!transaction.meta) {
      result.reasonCode = "METADATA_MISSING";
      return result;
    }
    result.execution = transaction.meta.err === null ? "succeeded" : "failed";
    if (!transaction.meta.logMessages) {
      result.reasonCode = "LOGS_UNAVAILABLE";
      return result;
    }
    Object.assign(result, inspectLogs(transaction.meta.logMessages));
    result.reasonCode =
      result.execution === "failed"
        ? "TX_FAILED"
        : result.logsStatus === "incomplete"
          ? "LOGS_INCOMPLETE"
          : result.candidates.length
            ? "CANDIDATES_FOUND"
            : "NO_SUPPORTED_LOG_EVENT";
    return result;
  } catch {
    // Never return provider error messages, URLs, credentials, or partial evidence.
    return {
      kind: "transaction-inspection",
      signature: input.signature,
      cluster: input.cluster,
      finality: "unknown",
      execution: "unknown",
      reasonCode: "RPC_UNAVAILABLE",
      logsStatus: "unavailable",
      invokedPrograms: [],
      candidates: [],
    };
  }
}
