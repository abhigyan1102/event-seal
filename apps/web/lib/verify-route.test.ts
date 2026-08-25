import type { VerificationResult } from "@eventseal/sdk";
import { describe, expect, it, vi } from "vitest";

import {
  createVerifyRoute,
  MAX_REQUEST_BODY_BYTES,
  VerificationAdapterError,
} from "./verify-route";

const validInput = {
  signature: "5UfDuXexample",
  cluster: "devnet",
  expectedProgramId: "EventSealDemo11111111111111111111111111111",
  event: {
    format: "anchor-log",
    discriminator: "0102030405060708",
  },
  commitment: "finalized",
} as const;

const verifiedResult: VerificationResult = {
  verdict: "verified",
  reasonCode: "VERIFIED",
  reason: "The finalized transaction contains the expected event.",
  signature: validInput.signature,
  cluster: "devnet",
  commitment: "finalized",
  slot: 123,
  expectedProgramId: validInput.expectedProgramId,
  receiptId: `es_${"a".repeat(64)}`,
  evidence: [],
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("createVerifyRoute", () => {
  it("forwards the normalized input and preserves the success body", async () => {
    const invoke = vi.fn().mockResolvedValue(verifiedResult);
    const response = await createVerifyRoute(invoke)(jsonRequest(validInput));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(verifiedResult);
    expect(invoke).toHaveBeenCalledWith(validInput);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("requires a JSON content type", async () => {
    const response = await createVerifyRoute(vi.fn())(
      new Request("http://localhost/api/verify", {
        method: "POST",
        body: JSON.stringify(validInput),
      }),
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: "Content-Type must be application/json",
    });
  });

  it("rejects invalid JSON before invoking the backend", async () => {
    const invoke = vi.fn();
    const response = await createVerifyRoute(invoke)(
      new Request("http://localhost/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects request bodies over the adapter limit", async () => {
    const invoke = vi.fn();
    const response = await createVerifyRoute(invoke)(
      jsonRequest({
        ...validInput,
        padding: "x".repeat(MAX_REQUEST_BODY_BYTES),
      }),
    );

    expect(response.status).toBe(413);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("stops reading an undeclared oversized request body", async () => {
    const invoke = vi.fn();
    let pullCount = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        controller.enqueue(new Uint8Array(1_024));
      },
      cancel() {
        cancelled = true;
      },
    });
    const response = await createVerifyRoute(invoke)(
      new Request("http://localhost/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );

    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pullCount).toBeLessThan(10);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects malformed successful upstream results", async () => {
    const response = await createVerifyRoute(() =>
      Promise.resolve({
        ...verifiedResult,
        evidence: { check: "metadata", passed: true, detail: "present" },
      } as unknown as VerificationResult),
    )(jsonRequest(validInput));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Verification failed",
    });
  });

  it("returns a safe unavailable response when configuration is missing", async () => {
    const response = await createVerifyRoute(() =>
      Promise.reject(new VerificationAdapterError("NOT_CONFIGURED")),
    )(jsonRequest(validInput));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Verification is not configured",
    });
  });

  it("does not expose upstream failure details", async () => {
    const response = await createVerifyRoute(() =>
      Promise.reject(new Error("sensitive provider detail")),
    )(jsonRequest(validInput));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Verification failed",
    });
  });
});
