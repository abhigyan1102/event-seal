import { describe, expect, it, vi } from "vitest";
import { createInspectTransactionHandler } from "./inspect-handler.ts";
import { inspectTransaction } from "../../packages/sdk/src/index.ts";

const input = { signature: "1".repeat(64), cluster: "mainnet-beta" };
const request = (body: unknown = input, type = "application/json") =>
  new Request("https://app.test", {
    method: "POST",
    headers: { "Content-Type": type },
    body: JSON.stringify(body),
  });
const response = {
  kind: "transaction-inspection",
  ...input,
  reasonCode: "NO_SUPPORTED_LOG_EVENT",
  finality: "finalized",
  execution: "succeeded",
  invokedPrograms: [],
  logsStatus: "available",
  candidates: [],
};

describe("inspection handler", () => {
  it("accepts signature and cluster with no verification or storage dependency", async () => {
    const inspect = vi.fn().mockResolvedValue(response);
    const handler = createInspectTransactionHandler({
      getEnv: (name) =>
        name === "SOLANA_RPC_MAINNET_URL"
          ? "https://mainnet.example"
          : undefined,
      inspectTransaction: inspect,
    });
    const result = await handler(
      request(input, "Application/JSON; charset=utf-8"),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toEqual(response);
    expect(inspect).toHaveBeenCalledWith({
      ...input,
      rpcUrl: "https://mainnet.example",
    });
    expect(
      (await handler(new Request("https://app.test", { method: "OPTIONS" })))
        .status,
    ).toBe(204);
    expect((await handler(new Request("https://app.test"))).status).toBe(405);
  });
  it.each([
    {},
    null,
    [],
    { ...input, signature: "invalid" },
    { ...input, cluster: "localnet" },
    { ...input, rpcUrl: "https://attacker.test" },
    { ...input, expectedProgramId: "x" },
  ])("rejects invalid or expanded input %j", async (body) => {
    const inspect = vi.fn();
    const handler = createInspectTransactionHandler({
      getEnv: () => undefined,
      inspectTransaction: inspect,
    });
    expect((await handler(request(body))).status).toBe(400);
    expect(inspect).not.toHaveBeenCalled();
  });
  it("rejects JSON lookalikes and sanitizes configuration/provider failures", async () => {
    const inspect = vi
      .fn()
      .mockRejectedValue(new Error("private RPC credential"));
    const handler = createInspectTransactionHandler({
      getEnv: () => undefined,
      inspectTransaction: inspect,
    });
    expect((await handler(request(input, "application/jsonp"))).status).toBe(
      415,
    );
    const result = await handler(request());
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({ error: "Inspection failed" });
    const unbound = createInspectTransactionHandler({
      getEnv: (name) =>
        name === "SOLANA_RPC_URL" ? "https://devnet.example" : undefined,
      inspectTransaction: inspect,
    });
    expect((await unbound(request())).status).toBe(500);
  });
  it.each([undefined, "1"])(
    "limits bytes before buffering even with content-length %s",
    async (length) => {
      const cancel = vi.fn();
      const inspect = vi.fn();
      const handler = createInspectTransactionHandler({
        getEnv: () => undefined,
        inspectTransaction: inspect,
      });
      const body = new ReadableStream({
        pull(controller) {
          controller.enqueue(new Uint8Array(2048));
        },
        cancel,
      });
      const streamed = new Request("https://app.test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(length ? { "Content-Length": length } : {}),
        },
        body,
        duplex: "half",
      } as RequestInit);
      expect((await handler(streamed)).status).toBe(413);
      expect(cancel).toHaveBeenCalled();
      expect(inspect).not.toHaveBeenCalled();
    },
  );
  it("runs the SDK through the handler with mocked RPC, without issuing a receipt", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) => {
        const { method } = JSON.parse(String(init?.body));
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result:
            method === "getGenesisHash"
              ? "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
              : method === "getTransaction"
                ? { slot: 1, meta: { err: null, logMessages: [] } }
                : {
                    value: [
                      { slot: 1, err: null, confirmationStatus: "finalized" },
                    ],
                  },
        });
      });
    try {
      const handler = createInspectTransactionHandler({
        getEnv: () => undefined,
        inspectTransaction,
      });
      expect(await (await handler(request())).json()).toEqual({
        ...response,
        slot: 1,
      });
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(
        fetch.mock.calls.every(([, init]) =>
          ["getGenesisHash", "getTransaction", "getSignatureStatuses"].includes(
            JSON.parse(String(init?.body)).method,
          ),
        ),
      ).toBe(true);
    } finally {
      fetch.mockRestore();
    }
  });
});
