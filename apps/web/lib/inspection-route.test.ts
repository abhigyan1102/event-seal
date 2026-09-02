import type { TransactionInspection } from "@eventseal/sdk";
import { describe, expect, it, vi } from "vitest";

import {
  createInspectionRoute,
  InspectionAdapterError,
  MAX_INSPECTION_BODY_BYTES,
} from "./inspection-route";

const input = { signature: "1".repeat(64), cluster: "devnet" } as const;
const result: TransactionInspection = {
  kind: "transaction-inspection",
  ...input,
  finality: "finalized",
  execution: "succeeded",
  reasonCode: "NO_SUPPORTED_LOG_EVENT",
  invokedPrograms: [],
  logsStatus: "available",
  candidates: [],
};

function request(body: unknown, contentType = "application/json") {
  return new Request("http://localhost/api/inspect", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: JSON.stringify(body),
  });
}

describe("createInspectionRoute", () => {
  it("forwards normalized input and preserves a validated response", async () => {
    const invoke = vi.fn().mockResolvedValue(result);
    const response = await createInspectionRoute(invoke)(
      request(
        { ...input, signature: ` ${input.signature} ` },
        "Application/JSON; charset=utf-8",
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(result);
    expect(invoke).toHaveBeenCalledWith(input);
  });

  it("rejects JSON lookalikes, expanded input, and malformed bodies", async () => {
    const invoke = vi.fn();
    expect(
      (await createInspectionRoute(invoke)(request(input, "application/jsonp")))
        .status,
    ).toBe(415);
    expect(
      (
        await createInspectionRoute(invoke)(
          request({ ...input, rpcUrl: "https://attacker.test" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await createInspectionRoute(invoke)(
          new Request("http://localhost/api/inspect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("stops reading an undeclared oversized request body", async () => {
    const invoke = vi.fn();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(1_024));
      },
      cancel,
    });
    const response = await createInspectionRoute(invoke)(
      new Request("http://localhost/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects a declared oversized request before invoking upstream", async () => {
    const invoke = vi.fn();
    const response = await createInspectionRoute(invoke)(
      request({ ...input, padding: "x".repeat(MAX_INSPECTION_BODY_BYTES) }),
    );
    expect(response.status).toBe(413);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sanitizes configuration, provider, and malformed upstream failures", async () => {
    const unavailable = await createInspectionRoute(() =>
      Promise.reject(new InspectionAdapterError("NOT_CONFIGURED")),
    )(request(input));
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({
      error: "Inspection is not configured",
    });

    const failed = await createInspectionRoute(() =>
      Promise.reject(new Error("private provider detail")),
    )(request(input));
    expect(failed.status).toBe(502);
    await expect(failed.json()).resolves.toEqual({
      error: "Inspection failed",
    });

    const malformed = await createInspectionRoute(() =>
      Promise.resolve({ ...result, candidates: [{}] } as TransactionInspection),
    )(request(input));
    expect(malformed.status).toBe(502);
  });
});
