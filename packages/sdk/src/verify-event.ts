import { attributeAnchorLogEvent } from "./events/anchor-log.js";
import { createReceiptId } from "./receipt.js";
import { fetchFinalizedTransaction } from "./transaction/fetch.js";
import type { VerificationResult, VerifyEventInput } from "./types.js";

const DISCRIMINATOR_PATTERN = /^[0-9a-f]{16}$/;

function baseResult(
  input: VerifyEventInput,
): Omit<VerificationResult, "verdict" | "reasonCode" | "reason"> {
  return {
    signature: input.signature,
    cluster: input.cluster,
    commitment: "finalized",
    expectedProgramId: input.expectedProgramId,
    evidence: [],
  };
}

export async function verifyEvent(
  input: VerifyEventInput,
): Promise<VerificationResult> {
  const base = baseResult(input);

  if (
    !input.signature ||
    !input.expectedProgramId ||
    !DISCRIMINATOR_PATTERN.test(input.event.discriminator)
  ) {
    return {
      ...base,
      verdict: "indeterminate",
      reasonCode: "INVALID_REQUEST",
      reason:
        "Signature, program ID, and a 16-character lowercase hex discriminator are required.",
    };
  }

  let response: Awaited<ReturnType<typeof fetchFinalizedTransaction>>;
  try {
    response = await fetchFinalizedTransaction(input);
  } catch (error) {
    return {
      ...base,
      verdict: "indeterminate",
      reasonCode: "RPC_UNAVAILABLE",
      reason:
        error instanceof Error ? error.message : "Solana RPC request failed.",
      evidence: [
        {
          check: "rpc",
          passed: false,
          detail: "Finalized transaction data was unavailable.",
        },
      ],
    };
  }

  if (!response.transaction) {
    return {
      ...base,
      verdict: "indeterminate",
      reasonCode: "TX_NOT_FOUND",
      reason:
        "The transaction was not available from the selected RPC endpoint.",
    };
  }

  const resultBase = { ...base, slot: response.transaction.slot };
  if (response.status?.confirmationStatus !== "finalized") {
    return {
      ...resultBase,
      verdict: "indeterminate",
      reasonCode: "TX_NOT_FINALIZED",
      reason: "The RPC endpoint did not confirm finalized commitment.",
      evidence: [
        {
          check: "finality",
          passed: false,
          detail: "confirmationStatus was not finalized.",
        },
      ],
    };
  }

  if (!response.transaction.meta) {
    return {
      ...resultBase,
      verdict: "indeterminate",
      reasonCode: "METADATA_MISSING",
      reason: "Transaction metadata is required to verify execution success.",
    };
  }

  if (response.transaction.meta.err !== null) {
    return {
      ...resultBase,
      verdict: "rejected",
      reasonCode: "TX_FAILED",
      reason: "The transaction emitted logs but did not execute successfully.",
      evidence: [
        {
          check: "finality",
          passed: true,
          detail: "Transaction is finalized.",
        },
        { check: "execution", passed: false, detail: "meta.err is not null." },
      ],
    };
  }

  const logs = response.transaction.meta.logMessages;
  if (!logs) {
    return {
      ...resultBase,
      verdict: "indeterminate",
      reasonCode: "LOGS_UNAVAILABLE",
      reason: "Complete transaction logs are required for event attribution.",
    };
  }

  if (input.event.format === "anchor-cpi") {
    return {
      ...resultBase,
      verdict: "indeterminate",
      reasonCode: "CPI_EVENT_UNSUPPORTED",
      reason: "Anchor CPI event attribution is not supported by this version.",
      evidence: [
        {
          check: "finality",
          passed: true,
          detail: "Transaction is finalized.",
        },
        { check: "execution", passed: true, detail: "meta.err is null." },
        {
          check: "attribution",
          passed: false,
          detail: "CPI verifier is not implemented yet.",
        },
      ],
    };
  }

  const attribution = attributeAnchorLogEvent(
    logs,
    input.expectedProgramId,
    input.event.discriminator,
  );
  const verified = attribution.reasonCode === "VERIFIED" && attribution.event;

  return {
    ...resultBase,
    verdict: verified
      ? "verified"
      : attribution.reasonCode === "PROGRAM_MISMATCH" ||
          attribution.reasonCode === "DISCRIMINATOR_MISMATCH"
        ? "rejected"
        : "indeterminate",
    reasonCode: attribution.reasonCode,
    reason: attribution.reason,
    event: attribution.event,
    receiptId: attribution.event
      ? createReceiptId({
          cluster: input.cluster,
          signature: input.signature,
          event: attribution.event,
        })
      : undefined,
    evidence: [
      { check: "finality", passed: true, detail: "Transaction is finalized." },
      { check: "execution", passed: true, detail: "meta.err is null." },
      {
        check: "attribution",
        passed: Boolean(verified),
        detail: attribution.reason,
      },
    ],
  };
}
