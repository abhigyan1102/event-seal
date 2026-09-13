import { describe, expect, it, vi } from "vitest";

import type { ArcSettlementResult } from "./arc-settlement";
import {
  ARC_SETTLEMENT_MAX_REQUEST_BODY_BYTES,
  createArcSettlementRoute,
} from "./arc-settlement-route";

const requestBody = {
  transactionHash:
    "0xedaf47800669bd77029f6a779a3c2824a84e2e46385d45d53091a226e65769f0",
  expectedSender: "0xe398777ab152fc44893415a731ceab226478f5ae",
  expectedRecipient: "0xbbc2a38ab48fa953ec68ee6115bd518d3a226f6e",
  expectedAmount: "8.388778",
};

const verifiedResult: ArcSettlementResult = {
  verdict: "verified",
  decision: "release",
  reasonCode: "VERIFIED",
  reason: "The finalized Arc transaction contains the expected settlement.",
  network: "arc-testnet",
  chainId: 5_042_002,
  transactionHash: requestBody.transactionHash,
  usdcContract: "0x3600000000000000000000000000000000000000",
  expected: {
    sender: requestBody.expectedSender,
    recipient: requestBody.expectedRecipient,
    amount: requestBody.expectedAmount,
    amountBaseUnits: "8388778",
  },
  transfer: {
    sender: requestBody.expectedSender,
    recipient: requestBody.expectedRecipient,
    amount: requestBody.expectedAmount,
    amountBaseUnits: "8388778",
    logIndex: 1,
    blockNumber: 61_899_564,
  },
  receiptId: "es_arc_" + "a".repeat(64),
  evidence: [],
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/arc/verify-settlement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Arc settlement route", () => {
  it("validates, normalizes, and returns a no-store decision", async () => {
    const verify = vi.fn().mockResolvedValue(verifiedResult);
    const response = await createArcSettlementRoute(verify)(
      jsonRequest(requestBody),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(verifiedResult);
    expect(verify).toHaveBeenCalledWith(requestBody);
  });

  it("rejects unsupported content and invalid identities", async () => {
    const verify = vi.fn();
    const unsupported = await createArcSettlementRoute(verify)(
      new Request("http://localhost/api/arc/verify-settlement", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }),
    );
    expect(unsupported.status).toBe(415);

    const invalid = await createArcSettlementRoute(verify)(
      jsonRequest({ ...requestBody, transactionHash: "0x1234" }),
    );
    expect(invalid.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
  });

  it("stops reading oversized bodies", async () => {
    const response = await createArcSettlementRoute(vi.fn())(
      jsonRequest({
        ...requestBody,
        padding: "x".repeat(ARC_SETTLEMENT_MAX_REQUEST_BODY_BYTES),
      }),
    );
    expect(response.status).toBe(413);
  });

  it("does not expose verifier failures", async () => {
    const response = await createArcSettlementRoute(() =>
      Promise.reject(new Error("provider details")),
    )(jsonRequest(requestBody));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Arc settlement verification failed",
    });
  });
});
