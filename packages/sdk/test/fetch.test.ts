import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFinalizedTransaction } from "../src/transaction/fetch.js";

const input = { signature: "1".repeat(64), cluster: "devnet" as const };
const genesis = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const status = { slot: 1, err: null, confirmationStatus: "finalized" };
const transaction = { slot: 1, meta: { err: null, logMessages: [] } };
const responses: Record<string, unknown> = {
  getGenesisHash: genesis,
  getSignatureStatuses: { value: [status] },
  getTransaction: transaction,
};
function mockRpc(overrides: Record<string, unknown> = {}) {
  const fetch = vi.fn((_url: string, init: RequestInit) => {
    const { method } = JSON.parse(init.body as string) as { method: string };
    return Promise.resolve(
      Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: { ...responses, ...overrides }[method],
      }),
    );
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
afterEach(() => vi.unstubAllGlobals());

describe("fetchFinalizedTransaction network boundary", () => {
  it("validates network and fetches finalized evidence with bounded requests", async () => {
    const fetch = mockRpc();
    expect(await fetchFinalizedTransaction(input)).toEqual({
      status,
      transaction,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetch.mock.calls) {
      expect(url).toBe("https://api.devnet.solana.com");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.redirect).toBe("error");
    }
    expect(
      (
        JSON.parse(fetch.mock.calls[2]?.[1].body as string) as {
          params: unknown[];
        }
      ).params[1],
    ).toMatchObject({
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
  });
  it("rejects a misconfigured custom RPC before fetching or verifying a transaction", async () => {
    const fetch = mockRpc({ getGenesisHash: "wrong-network" });
    await expect(
      fetchFinalizedTransaction({ ...input, rpcUrl: "https://custom.example" }),
    ).rejects.toThrow("network");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    { getSignatureStatuses: { value: [] } },
    { getSignatureStatuses: { value: [42] } },
    { getSignatureStatuses: { value: [{ ...status, err: undefined }] } },
    {
      getSignatureStatuses: {
        value: [{ ...status, confirmationStatus: "invalid" }],
      },
    },
    { getTransaction: {} },
    { getTransaction: { slot: 1, meta: { logMessages: [] } } },
    { getTransaction: { slot: 1, meta: { err: null, logMessages: [1] } } },
    { getTransaction: { ...transaction, slot: 2 } },
    { getTransaction: { slot: 1, meta: { err: "failure", logMessages: [] } } },
  ])("rejects malformed or contradictory evidence: %j", async (overrides) => {
    mockRpc(overrides);
    await expect(fetchFinalizedTransaction(input)).rejects.toThrow();
  });
  it("preserves missing evidence distinctly", async () => {
    mockRpc({ getTransaction: { slot: 1, meta: null } });
    expect(
      (await fetchFinalizedTransaction(input)).transaction?.meta,
    ).toBeNull();
    mockRpc({ getSignatureStatuses: { value: [null] }, getTransaction: null });
    expect(await fetchFinalizedTransaction(input)).toEqual({
      status: null,
      transaction: null,
    });
  });
  it("aborts oversized streamed RPC bodies and does not leak upstream errors", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
      cancel,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    await expect(fetchFinalizedTransaction(input)).rejects.toThrow("too large");
    expect(cancel).toHaveBeenCalled();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          jsonrpc: "2.0",
          id: 1,
          error: { message: "private RPC credential" },
        }),
      ),
    );
    await expect(fetchFinalizedTransaction(input)).rejects.not.toThrow(
      "credential",
    );
  });
});
