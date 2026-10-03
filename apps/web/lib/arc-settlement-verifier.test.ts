import { describe, expect, it, vi } from "vitest";

import {
  ARC_TESTNET_CHAIN_ID_HEX,
  ARC_USDC_CONTRACT,
  ARC_USDC_TRANSFER_TOPIC,
  type ArcSettlementRequest,
} from "./arc-settlement";
import { createArcSettlementVerifier } from "./arc-settlement-verifier";

const request: ArcSettlementRequest = {
  transactionHash:
    "0xedaf47800669bd77029f6a779a3c2824a84e2e46385d45d53091a226e65769f0",
  expectedSender: "0xe398777ab152fc44893415a731ceab226478f5ae",
  expectedRecipient: "0xbbc2a38ab48fa953ec68ee6115bd518d3a226f6e",
  expectedAmount: "8.388778",
};

function topicAddress(address: string): string {
  return "0x" + "0".repeat(24) + address.slice(2);
}

function transferLog(
  overrides: Partial<{
    address: string;
    sender: string;
    recipient: string;
    data: string;
    logIndex: string;
    removed: boolean;
  }> = {},
) {
  return {
    address: overrides.address ?? ARC_USDC_CONTRACT,
    topics: [
      ARC_USDC_TRANSFER_TOPIC,
      topicAddress(overrides.sender ?? request.expectedSender),
      topicAddress(overrides.recipient ?? request.expectedRecipient),
    ],
    data: overrides.data ?? "0x" + "0".repeat(58) + "8000aa",
    logIndex: overrides.logIndex ?? "0x1",
    blockNumber: "0x10",
    removed: overrides.removed ?? false,
  };
}

function receipt(logs = [transferLog()], status = "0x1") {
  return {
    status,
    blockNumber: "0x10",
    transactionHash: request.transactionHash,
    logs,
  };
}

function rpcFetch(values: Partial<Record<string, unknown>> = {}): typeof fetch {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof init?.body !== "string") {
      throw new Error("Expected a JSON string body");
    }
    const body = JSON.parse(init.body) as { method: string };
    const defaults: Record<string, unknown> = {
      eth_chainId: ARC_TESTNET_CHAIN_ID_HEX,
      eth_getTransactionReceipt: receipt(),
      eth_blockNumber: "0x11",
    };
    return Promise.resolve(
      Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: Object.hasOwn(values, body.method)
          ? values[body.method]
          : defaults[body.method],
      }),
    );
  }) as typeof fetch;
}

describe("Arc USDC settlement verifier", () => {
  it("releases only one exact canonical Arc USDC transfer", async () => {
    const result = await createArcSettlementVerifier(rpcFetch())(request);

    expect(result).toMatchObject({
      verdict: "verified",
      decision: "release",
      reasonCode: "VERIFIED",
      transfer: {
        sender: request.expectedSender,
        recipient: request.expectedRecipient,
        amount: "8.388778",
        amountBaseUnits: "8388778",
        logIndex: 1,
        blockNumber: 16,
      },
    });
    expect(result.receiptId).toMatch(/^es_arc_[0-9a-f]{64}$/);
    expect(result.evidence.every((item) => item.passed)).toBe(true);
  });

  it("stops on failed execution or mismatched payment terms", async () => {
    const failed = await createArcSettlementVerifier(
      rpcFetch({ eth_getTransactionReceipt: receipt([], "0x0") }),
    )(request);
    expect(failed).toMatchObject({
      verdict: "rejected",
      decision: "stop",
      reasonCode: "TX_FAILED",
    });

    const wrongRecipient = await createArcSettlementVerifier(
      rpcFetch({
        eth_getTransactionReceipt: receipt([
          transferLog({
            recipient: "0x1111111111111111111111111111111111111111",
          }),
        ]),
      }),
    )(request);
    expect(wrongRecipient).toMatchObject({
      verdict: "rejected",
      decision: "stop",
      reasonCode: "RECIPIENT_MISMATCH",
    });

    const wrongAmount = await createArcSettlementVerifier(
      rpcFetch({
        eth_getTransactionReceipt: receipt([
          transferLog({ data: "0x" + "0".repeat(63) + "1" }),
        ]),
      }),
    )(request);
    expect(wrongAmount).toMatchObject({
      verdict: "rejected",
      decision: "stop",
      reasonCode: "AMOUNT_MISMATCH",
    });
  });

  it("retries when finality, network identity, or uniqueness is uncertain", async () => {
    const pending = await createArcSettlementVerifier(
      rpcFetch({ eth_getTransactionReceipt: null }),
    )(request);
    expect(pending).toMatchObject({
      verdict: "indeterminate",
      decision: "retry",
      reasonCode: "TX_NOT_FINAL",
    });

    const wrongChain = await createArcSettlementVerifier(
      rpcFetch({ eth_chainId: "0x1" }),
    )(request);
    expect(wrongChain).toMatchObject({
      verdict: "indeterminate",
      decision: "retry",
      reasonCode: "ARC_CHAIN_MISMATCH",
    });

    const ambiguous = await createArcSettlementVerifier(
      rpcFetch({
        eth_getTransactionReceipt: receipt([
          transferLog(),
          transferLog({ logIndex: "0x2" }),
        ]),
      }),
    )(request);
    expect(ambiguous).toMatchObject({
      verdict: "indeterminate",
      decision: "retry",
      reasonCode: "AMBIGUOUS_TRANSFER",
    });
  });

  it("fails closed when Arc RPC is unavailable or malformed", async () => {
    const unavailableFetch = vi.fn().mockRejectedValue(new Error("timeout"));
    const unavailable = await createArcSettlementVerifier(
      unavailableFetch as typeof fetch,
    )(request);
    expect(unavailable).toMatchObject({
      verdict: "indeterminate",
      decision: "retry",
      reasonCode: "RPC_UNAVAILABLE",
    });

    const malformed = await createArcSettlementVerifier(
      rpcFetch({ eth_getTransactionReceipt: { status: "0x1" } }),
    )(request);
    expect(malformed).toMatchObject({
      verdict: "indeterminate",
      decision: "retry",
      reasonCode: "RPC_MALFORMED",
    });
  });
});
