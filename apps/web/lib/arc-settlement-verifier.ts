import { createHash } from "node:crypto";

import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_CHAIN_ID_HEX,
  ARC_TESTNET_RPC_URL,
  ARC_USDC_CONTRACT,
  ARC_USDC_TRANSFER_TOPIC,
  formatUsdcAmount,
  parseUsdcAmount,
  type ArcSettlementEvidence,
  type ArcSettlementRequest,
  type ArcSettlementResult,
  type ArcSettlementTransfer,
} from "./arc-settlement";

interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  logIndex: string;
  blockNumber: string;
  removed?: boolean;
}

interface RpcReceipt {
  status: string;
  blockNumber: string;
  transactionHash: string;
  logs: RpcLog[];
}

type RpcResponse =
  | { jsonrpc: "2.0"; id: number; result: unknown }
  | {
      jsonrpc: "2.0";
      id: number;
      error: { code: number; message: string };
    };

type FetchLike = typeof fetch;

export function createArcSettlementVerifier(fetchFn: FetchLike = fetch) {
  return async function verifyArcSettlement(
    request: ArcSettlementRequest,
  ): Promise<ArcSettlementResult> {
    const parsedAmount = parseUsdcAmount(request.expectedAmount);
    if (!parsedAmount) {
      throw new Error("Arc settlement input was not normalized");
    }

    const expected = {
      sender: request.expectedSender,
      recipient: request.expectedRecipient,
      amount: parsedAmount.formatted,
      amountBaseUnits: parsedAmount.baseUnits.toString(),
    };
    const evidence: ArcSettlementEvidence[] = [];

    let chainId: unknown;
    let receiptValue: unknown;
    let currentBlockValue: unknown;
    try {
      [chainId, receiptValue, currentBlockValue] = await Promise.all([
        callRpc(fetchFn, "eth_chainId", []),
        callRpc(fetchFn, "eth_getTransactionReceipt", [
          request.transactionHash,
        ]),
        callRpc(fetchFn, "eth_blockNumber", []),
      ]);
    } catch {
      return result(request, expected, evidence, {
        verdict: "indeterminate",
        decision: "retry",
        reasonCode: "RPC_UNAVAILABLE",
        reason:
          "Arc RPC evidence is unavailable. Retry without releasing value.",
      });
    }

    if (
      typeof chainId !== "string" ||
      chainId.toLowerCase() !== ARC_TESTNET_CHAIN_ID_HEX
    ) {
      evidence.push({
        check: "arc-chain",
        passed: false,
        detail: `Expected Arc Testnet chain ${ARC_TESTNET_CHAIN_ID}.`,
      });
      return result(request, expected, evidence, {
        verdict: "indeterminate",
        decision: "retry",
        reasonCode: "ARC_CHAIN_MISMATCH",
        reason: "The RPC endpoint did not identify itself as Arc Testnet.",
      });
    }
    evidence.push({
      check: "arc-chain",
      passed: true,
      detail: `RPC reported Arc Testnet chain ${ARC_TESTNET_CHAIN_ID}.`,
    });

    if (receiptValue === null) {
      evidence.push({
        check: "transaction-finality",
        passed: false,
        detail: "No committed transaction receipt is available yet.",
      });
      return result(request, expected, evidence, {
        verdict: "indeterminate",
        decision: "retry",
        reasonCode: "TX_NOT_FINAL",
        reason: "The transaction is missing or has not reached Arc finality.",
      });
    }

    if (!isRpcReceipt(receiptValue) || !isHexQuantity(currentBlockValue)) {
      return result(request, expected, evidence, {
        verdict: "indeterminate",
        decision: "retry",
        reasonCode: "RPC_MALFORMED",
        reason: "Arc RPC returned incomplete transaction evidence.",
      });
    }

    const receipt = receiptValue;
    const blockNumber = parseHexQuantity(receipt.blockNumber);
    const currentBlock = parseHexQuantity(currentBlockValue);
    if (
      receipt.transactionHash.toLowerCase() !== request.transactionHash ||
      blockNumber === undefined ||
      currentBlock === undefined ||
      currentBlock < blockNumber
    ) {
      return result(request, expected, evidence, {
        verdict: "indeterminate",
        decision: "retry",
        reasonCode: "RPC_MALFORMED",
        reason: "Arc RPC returned inconsistent transaction evidence.",
      });
    }

    evidence.push({
      check: "transaction-finality",
      passed: true,
      detail: `Receipt is committed in Arc block ${blockNumber}; one confirmation is final.`,
    });

    if (receipt.status.toLowerCase() !== "0x1") {
      evidence.push({
        check: "execution-status",
        passed: false,
        detail: "The Arc transaction receipt reports failed execution.",
      });
      return result(request, expected, evidence, {
        verdict: "rejected",
        decision: "stop",
        reasonCode: "TX_FAILED",
        reason: "The Arc transaction failed, so no settlement can be released.",
      });
    }
    evidence.push({
      check: "execution-status",
      passed: true,
      detail: "The Arc transaction executed successfully.",
    });

    const transfers = receipt.logs
      .map((log) => parseUsdcTransfer(log, blockNumber))
      .filter((transfer): transfer is ArcSettlementTransfer =>
        Boolean(transfer),
      );

    if (transfers.length === 0) {
      evidence.push({
        check: "usdc-transfer",
        passed: false,
        detail: `No canonical USDC Transfer event was emitted by ${ARC_USDC_CONTRACT}.`,
      });
      return result(request, expected, evidence, {
        verdict: "rejected",
        decision: "stop",
        reasonCode: "USDC_TRANSFER_NOT_FOUND",
        reason: "The transaction contains no canonical Arc USDC transfer.",
      });
    }
    evidence.push({
      check: "usdc-transfer",
      passed: true,
      detail: `Found ${transfers.length} canonical Arc USDC Transfer event${transfers.length === 1 ? "" : "s"}.`,
    });

    const senderMatches = transfers.filter(
      (transfer) => transfer.sender === request.expectedSender,
    );
    if (senderMatches.length === 0) {
      evidence.push({
        check: "expected-sender",
        passed: false,
        detail: `No USDC transfer was sent by ${request.expectedSender}.`,
      });
      return result(request, expected, evidence, {
        verdict: "rejected",
        decision: "stop",
        reasonCode: "SENDER_MISMATCH",
        reason: "The Arc USDC sender does not match the trusted request.",
      });
    }
    evidence.push({
      check: "expected-sender",
      passed: true,
      detail: "The USDC sender matches the trusted request.",
    });

    const recipientMatches = senderMatches.filter(
      (transfer) => transfer.recipient === request.expectedRecipient,
    );
    if (recipientMatches.length === 0) {
      evidence.push({
        check: "expected-recipient",
        passed: false,
        detail: `No matching sender paid ${request.expectedRecipient}.`,
      });
      return result(request, expected, evidence, {
        verdict: "rejected",
        decision: "stop",
        reasonCode: "RECIPIENT_MISMATCH",
        reason: "The Arc USDC recipient does not match the trusted request.",
      });
    }
    evidence.push({
      check: "expected-recipient",
      passed: true,
      detail: "The USDC recipient matches the trusted request.",
    });

    const exactMatches = recipientMatches.filter(
      (transfer) => transfer.amountBaseUnits === expected.amountBaseUnits,
    );
    if (exactMatches.length === 0) {
      evidence.push({
        check: "expected-amount",
        passed: false,
        detail: `No matching transfer moved exactly ${expected.amount} USDC.`,
      });
      return result(request, expected, evidence, {
        verdict: "rejected",
        decision: "stop",
        reasonCode: "AMOUNT_MISMATCH",
        reason: "The Arc USDC amount does not match the trusted request.",
      });
    }
    evidence.push({
      check: "expected-amount",
      passed: true,
      detail: `The transfer moved exactly ${expected.amount} USDC.`,
    });

    if (exactMatches.length !== 1) {
      evidence.push({
        check: "unique-settlement",
        passed: false,
        detail: `Found ${exactMatches.length} indistinguishable matching transfers.`,
      });
      return result(request, expected, evidence, {
        verdict: "indeterminate",
        decision: "retry",
        reasonCode: "AMBIGUOUS_TRANSFER",
        reason: "More than one Arc USDC transfer matches the trusted request.",
      });
    }

    const transfer = exactMatches[0]!;
    evidence.push({
      check: "unique-settlement",
      passed: true,
      detail: `Exactly one matching transfer was found at log index ${transfer.logIndex}.`,
    });
    const receiptId = createReceiptId(request.transactionHash, transfer);

    return result(request, expected, evidence, {
      verdict: "verified",
      decision: "release",
      reasonCode: "VERIFIED",
      reason:
        "The finalized Arc transaction contains exactly one expected USDC settlement.",
      transfer,
      receiptId,
    });
  };
}

async function callRpc(
  fetchFn: FetchLike,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const response = await fetchFn(ARC_TESTNET_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Arc RPC request failed");

  const value = (await response.json()) as RpcResponse;
  if (
    !value ||
    typeof value !== "object" ||
    "error" in value ||
    !("result" in value)
  ) {
    throw new Error("Arc RPC returned an error");
  }
  return value.result;
}

function isRpcReceipt(value: unknown): value is RpcReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const receipt = value as Partial<RpcReceipt>;
  return (
    typeof receipt.status === "string" &&
    ["0x0", "0x1"].includes(receipt.status.toLowerCase()) &&
    isHexQuantity(receipt.blockNumber) &&
    typeof receipt.transactionHash === "string" &&
    Array.isArray(receipt.logs) &&
    receipt.logs.every(isRpcLog)
  );
}

function isRpcLog(value: unknown): value is RpcLog {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const log = value as Partial<RpcLog>;
  return (
    typeof log.address === "string" &&
    Array.isArray(log.topics) &&
    log.topics.every((topic) => typeof topic === "string") &&
    typeof log.data === "string" &&
    isHexQuantity(log.logIndex) &&
    isHexQuantity(log.blockNumber) &&
    (log.removed === undefined || typeof log.removed === "boolean")
  );
}

function parseUsdcTransfer(
  log: RpcLog,
  receiptBlockNumber: number,
): ArcSettlementTransfer | undefined {
  if (
    log.removed === true ||
    log.address.toLowerCase() !== ARC_USDC_CONTRACT ||
    log.topics.length !== 3 ||
    log.topics[0]?.toLowerCase() !== ARC_USDC_TRANSFER_TOPIC ||
    !/^0x0{24}[0-9a-fA-F]{40}$/.test(log.topics[1] ?? "") ||
    !/^0x0{24}[0-9a-fA-F]{40}$/.test(log.topics[2] ?? "") ||
    !/^0x[0-9a-fA-F]{64}$/.test(log.data)
  ) {
    return undefined;
  }

  const senderTopic = log.topics[1];
  const recipientTopic = log.topics[2];
  if (!senderTopic || !recipientTopic) return undefined;

  const amount = BigInt(log.data);
  const logIndex = parseHexQuantity(log.logIndex);
  const blockNumber = parseHexQuantity(log.blockNumber);
  if (
    logIndex === undefined ||
    blockNumber === undefined ||
    blockNumber !== receiptBlockNumber
  ) {
    return undefined;
  }

  return {
    sender: `0x${senderTopic.slice(-40)}`.toLowerCase(),
    recipient: `0x${recipientTopic.slice(-40)}`.toLowerCase(),
    amount: formatUsdcAmount(amount),
    amountBaseUnits: amount.toString(),
    logIndex,
    blockNumber,
  };
}

function isHexQuantity(value: unknown): value is string {
  return (
    typeof value === "string" && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)
  );
}

function parseHexQuantity(value: string): number | undefined {
  if (!isHexQuantity(value)) return undefined;
  const parsed = BigInt(value);
  return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : undefined;
}

function createReceiptId(
  transactionHash: string,
  transfer: ArcSettlementTransfer,
): string {
  const identity = [
    "arc-testnet",
    ARC_TESTNET_CHAIN_ID.toString(),
    transactionHash,
    ARC_USDC_CONTRACT,
    transfer.logIndex.toString(),
    transfer.blockNumber.toString(),
    transfer.sender,
    transfer.recipient,
    transfer.amountBaseUnits,
  ].join("\n");
  return `es_arc_${createHash("sha256").update(identity).digest("hex")}`;
}

function result(
  request: ArcSettlementRequest,
  expected: ArcSettlementResult["expected"],
  evidence: ArcSettlementEvidence[],
  outcome: Pick<
    ArcSettlementResult,
    "verdict" | "decision" | "reasonCode" | "reason"
  > &
    Partial<Pick<ArcSettlementResult, "transfer" | "receiptId">>,
): ArcSettlementResult {
  return {
    ...outcome,
    network: "arc-testnet",
    chainId: ARC_TESTNET_CHAIN_ID,
    transactionHash: request.transactionHash,
    usdcContract: ARC_USDC_CONTRACT,
    expected,
    evidence,
  };
}

export const verifyArcSettlement = createArcSettlementVerifier();
