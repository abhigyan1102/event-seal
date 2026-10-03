export const ARC_TESTNET_CHAIN_ID = 5_042_002;
export const ARC_TESTNET_CHAIN_ID_HEX = "0x4cef52";
export const ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network";
export const ARC_TESTNET_EXPLORER_URL = "https://testnet.arcscan.app";
export const ARC_USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
export const ARC_USDC_DECIMALS = 6;
export const ARC_USDC_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type ArcSettlementVerdict = "verified" | "rejected" | "indeterminate";

export type ArcSettlementDecision = "release" | "stop" | "retry";

export type ArcSettlementReasonCode =
  | "VERIFIED"
  | "TX_FAILED"
  | "USDC_TRANSFER_NOT_FOUND"
  | "SENDER_MISMATCH"
  | "RECIPIENT_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "AMBIGUOUS_TRANSFER"
  | "TX_NOT_FINAL"
  | "ARC_CHAIN_MISMATCH"
  | "RPC_UNAVAILABLE"
  | "RPC_MALFORMED";

export interface ArcSettlementRequest {
  transactionHash: string;
  expectedSender: string;
  expectedRecipient: string;
  expectedAmount: string;
}

export interface ArcSettlementEvidence {
  check: string;
  passed: boolean;
  detail: string;
}

export interface ArcSettlementTransfer {
  sender: string;
  recipient: string;
  amount: string;
  amountBaseUnits: string;
  logIndex: number;
  blockNumber: number;
}

export interface ArcSettlementResult {
  verdict: ArcSettlementVerdict;
  decision: ArcSettlementDecision;
  reasonCode: ArcSettlementReasonCode;
  reason: string;
  network: "arc-testnet";
  chainId: typeof ARC_TESTNET_CHAIN_ID;
  transactionHash: string;
  usdcContract: typeof ARC_USDC_CONTRACT;
  expected: {
    sender: string;
    recipient: string;
    amount: string;
    amountBaseUnits: string;
  };
  transfer?: ArcSettlementTransfer;
  receiptId?: string;
  evidence: ArcSettlementEvidence[];
}

export type ArcSettlementValidation =
  { ok: true; value: ArcSettlementRequest } | { ok: false; error: string };

const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const USDC_AMOUNT_PATTERN = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,6}))?$/;
const RECEIPT_ID_PATTERN = /^es_arc_[0-9a-f]{64}$/;
const REASON_CODES: readonly ArcSettlementReasonCode[] = [
  "VERIFIED",
  "TX_FAILED",
  "USDC_TRANSFER_NOT_FOUND",
  "SENDER_MISMATCH",
  "RECIPIENT_MISMATCH",
  "AMOUNT_MISMATCH",
  "AMBIGUOUS_TRANSFER",
  "TX_NOT_FINAL",
  "ARC_CHAIN_MISMATCH",
  "RPC_UNAVAILABLE",
  "RPC_MALFORMED",
];
const MAX_UINT256 = (1n << 256n) - 1n;

export function validateArcSettlementRequest(
  value: unknown,
): ArcSettlementValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const input = value as Record<string, unknown>;
  if (
    typeof input.transactionHash !== "string" ||
    !TRANSACTION_HASH_PATTERN.test(input.transactionHash.trim())
  ) {
    return {
      ok: false,
      error: "transactionHash must be a 32-byte 0x-prefixed hash",
    };
  }
  if (
    typeof input.expectedSender !== "string" ||
    !ADDRESS_PATTERN.test(input.expectedSender.trim())
  ) {
    return {
      ok: false,
      error: "expectedSender must be a 20-byte 0x-prefixed address",
    };
  }
  if (
    typeof input.expectedRecipient !== "string" ||
    !ADDRESS_PATTERN.test(input.expectedRecipient.trim())
  ) {
    return {
      ok: false,
      error: "expectedRecipient must be a 20-byte 0x-prefixed address",
    };
  }
  if (typeof input.expectedAmount !== "string") {
    return { ok: false, error: "expectedAmount must be a USDC amount" };
  }

  const amount = parseUsdcAmount(input.expectedAmount);
  if (!amount || amount.baseUnits === 0n) {
    return {
      ok: false,
      error: "expectedAmount must be greater than zero with at most 6 decimals",
    };
  }

  return {
    ok: true,
    value: {
      transactionHash: input.transactionHash.trim().toLowerCase(),
      expectedSender: input.expectedSender.trim().toLowerCase(),
      expectedRecipient: input.expectedRecipient.trim().toLowerCase(),
      expectedAmount: amount.formatted,
    },
  };
}

export function parseUsdcAmount(
  value: string,
): { baseUnits: bigint; formatted: string } | undefined {
  const trimmed = value.trim();
  const match = USDC_AMOUNT_PATTERN.exec(trimmed);
  if (!match) return undefined;

  const whole = BigInt(trimmed.split(".", 1)[0] ?? "0");
  const fractional = (match[2] ?? "").padEnd(ARC_USDC_DECIMALS, "0");
  const baseUnits =
    whole * 10n ** BigInt(ARC_USDC_DECIMALS) + BigInt(fractional);
  if (baseUnits > MAX_UINT256) return undefined;

  return { baseUnits, formatted: formatUsdcAmount(baseUnits) };
}

export function formatUsdcAmount(baseUnits: bigint): string {
  const scale = 10n ** BigInt(ARC_USDC_DECIMALS);
  const whole = baseUnits / scale;
  const fractional = (baseUnits % scale)
    .toString()
    .padStart(ARC_USDC_DECIMALS, "0")
    .replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

export function isArcSettlementResult(
  value: unknown,
): value is ArcSettlementResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<ArcSettlementResult>;
  const commonFieldsAreValid =
    ["verified", "rejected", "indeterminate"].includes(result.verdict ?? "") &&
    ["release", "stop", "retry"].includes(result.decision ?? "") &&
    REASON_CODES.includes(result.reasonCode as ArcSettlementReasonCode) &&
    typeof result.reason === "string" &&
    result.network === "arc-testnet" &&
    result.chainId === ARC_TESTNET_CHAIN_ID &&
    typeof result.transactionHash === "string" &&
    TRANSACTION_HASH_PATTERN.test(result.transactionHash) &&
    result.usdcContract === ARC_USDC_CONTRACT &&
    isExpectedSettlement(result.expected) &&
    Array.isArray(result.evidence) &&
    result.evidence.every(
      (item) =>
        item &&
        typeof item.check === "string" &&
        typeof item.passed === "boolean" &&
        typeof item.detail === "string",
    );
  if (!commonFieldsAreValid) return false;

  if (result.verdict === "verified") {
    return (
      result.decision === "release" &&
      result.reasonCode === "VERIFIED" &&
      typeof result.receiptId === "string" &&
      RECEIPT_ID_PATTERN.test(result.receiptId) &&
      isSettlementTransfer(result.transfer)
    );
  }
  return (
    (result.verdict === "rejected" && result.decision === "stop") ||
    (result.verdict === "indeterminate" && result.decision === "retry")
  );
}

function isExpectedSettlement(
  value: unknown,
): value is ArcSettlementResult["expected"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const expected = value as Partial<ArcSettlementResult["expected"]>;
  return (
    typeof expected.sender === "string" &&
    ADDRESS_PATTERN.test(expected.sender) &&
    typeof expected.recipient === "string" &&
    ADDRESS_PATTERN.test(expected.recipient) &&
    typeof expected.amount === "string" &&
    Boolean(parseUsdcAmount(expected.amount)) &&
    typeof expected.amountBaseUnits === "string" &&
    /^[0-9]+$/.test(expected.amountBaseUnits)
  );
}

function isSettlementTransfer(value: unknown): value is ArcSettlementTransfer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const transfer = value as Partial<ArcSettlementTransfer>;
  return (
    typeof transfer.sender === "string" &&
    ADDRESS_PATTERN.test(transfer.sender) &&
    typeof transfer.recipient === "string" &&
    ADDRESS_PATTERN.test(transfer.recipient) &&
    typeof transfer.amount === "string" &&
    Boolean(parseUsdcAmount(transfer.amount)) &&
    typeof transfer.amountBaseUnits === "string" &&
    /^[0-9]+$/.test(transfer.amountBaseUnits) &&
    Number.isSafeInteger(transfer.logIndex) &&
    Number.isSafeInteger(transfer.blockNumber)
  );
}
