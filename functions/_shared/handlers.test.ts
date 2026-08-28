import { describe, expect, it, vi } from "vitest";

import {
  createGetReceiptHandler,
  createHeliusWebhookHandler,
  createVerifyEventHandler,
} from "./handlers.ts";

const validVerifyInput = {
  signature: "5UfDuXexampleSignature",
  cluster: "devnet",
  expectedProgramId: "EventSeal111111111111111111111111111111111",
  event: {
    format: "anchor-log",
    discriminator: "0102030405060708",
  },
};

const verificationResult = {
  verdict: "verified",
  reasonCode: "VERIFIED",
  reason: "The event was verified.",
  signature: validVerifyInput.signature,
  cluster: validVerifyInput.cluster,
  commitment: "finalized",
  expectedProgramId: validVerifyInput.expectedProgramId,
  evidence: [],
};

function getEnv(values: Record<string, string | undefined>) {
  return (name: string) => values[name];
}

function logger() {
  return { error: vi.fn() };
}

function jsonRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://eventseal.test/functions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function jsonBody(response: Response): Promise<unknown> {
  return response.json();
}

describe("createVerifyEventHandler", () => {
  it("returns CORS preflight response", async () => {
    const handler = createVerifyEventHandler({
      getEnv: getEnv({}),
      logger: logger(),
      verifyAndPersist: vi.fn(),
    });

    const response = await handler(
      new Request("https://eventseal.test/functions", { method: "OPTIONS" }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS",
    );
  });

  it("verifies valid requests with the server-owned RPC URL", async () => {
    const verifyAndPersist = vi.fn().mockResolvedValue(verificationResult);
    const handler = createVerifyEventHandler({
      getEnv: getEnv({ SOLANA_RPC_DEVNET_URL: "https://private-rpc.example" }),
      logger: logger(),
      verifyAndPersist,
    });

    const response = await handler(jsonRequest(validVerifyInput));

    expect(response.status).toBe(200);
    expect(await jsonBody(response)).toEqual(verificationResult);
    expect(verifyAndPersist).toHaveBeenCalledWith({
      ...validVerifyInput,
      rpcUrl: "https://private-rpc.example",
    });
  });

  it("rejects client-controlled RPC URLs", async () => {
    const verifyAndPersist = vi.fn();
    const handler = createVerifyEventHandler({
      getEnv: getEnv({}),
      logger: logger(),
      verifyAndPersist,
    });

    const response = await handler(
      jsonRequest({
        ...validVerifyInput,
        rpcUrl: "https://client-rpc.example",
      }),
    );

    expect(response.status).toBe(400);
    expect(await jsonBody(response)).toEqual({
      error: "rpcUrl is not accepted by the hosted verify-event function",
    });
    expect(verifyAndPersist).not.toHaveBeenCalled();
  });

  it("masks verification failures and logs the original error", async () => {
    const testLogger = logger();
    const failure = new Error("receipt persistence leaked detail");
    const handler = createVerifyEventHandler({
      getEnv: getEnv({}),
      logger: testLogger,
      verifyAndPersist: vi.fn().mockRejectedValue(failure),
    });

    const response = await handler(jsonRequest(validVerifyInput));

    expect(response.status).toBe(500);
    expect(await jsonBody(response)).toEqual({ error: "Verification failed" });
    expect(testLogger.error).toHaveBeenCalledWith(
      "EventSeal verification failed",
      failure,
    );
  });
});

describe("createGetReceiptHandler", () => {
  const receiptId = `es_${"a".repeat(64)}`;
  const receipt = { receipt_id: receiptId, verdict: "verified" };

  function receiptClient(result: {
    data: unknown;
    error: { message: string } | null;
  }) {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    return {
      client: { database: { from } },
      spies: { eq, from, maybeSingle, select },
    };
  }

  it("returns a stored receipt by receiptId", async () => {
    const { client, spies } = receiptClient({ data: receipt, error: null });
    const createAdminClient = vi.fn(() => client);
    const handler = createGetReceiptHandler({
      createAdminClient,
      getEnv: getEnv({
        INSFORGE_API_KEY: "server-key",
        INSFORGE_BASE_URL: "https://project.insforge.app",
      }),
      logger: logger(),
    });

    const response = await handler(
      new Request(
        `https://eventseal.test/functions/get-receipt?receiptId=${receiptId}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(await jsonBody(response)).toEqual(receipt);
    expect(createAdminClient).toHaveBeenCalledWith({
      apiKey: "server-key",
      baseUrl: "https://project.insforge.app",
    });
    expect(spies.from).toHaveBeenCalledWith("verification_receipts");
    expect(spies.eq).toHaveBeenCalledWith("receipt_id", receiptId);
  });

  it("requires a valid receiptId", async () => {
    const handler = createGetReceiptHandler({
      createAdminClient: vi.fn(),
      getEnv: getEnv({}),
      logger: logger(),
    });

    const response = await handler(
      new Request("https://eventseal.test/functions/get-receipt"),
    );

    expect(response.status).toBe(400);
    expect(await jsonBody(response)).toEqual({
      error: "receiptId is required",
    });
  });

  it("reports missing receipt storage configuration", async () => {
    const handler = createGetReceiptHandler({
      createAdminClient: vi.fn(),
      getEnv: getEnv({ INSFORGE_BASE_URL: "https://project.insforge.app" }),
      logger: logger(),
    });

    const response = await handler(
      new Request(
        `https://eventseal.test/functions/get-receipt?receiptId=${receiptId}`,
      ),
    );

    expect(response.status).toBe(500);
    expect(await jsonBody(response)).toEqual({
      error: "Receipt storage is not configured",
    });
  });

  it("masks database lookup errors and logs the original error", async () => {
    const testLogger = logger();
    const databaseError = { message: "database table missing" };
    const { client } = receiptClient({ data: null, error: databaseError });
    const handler = createGetReceiptHandler({
      createAdminClient: vi.fn(() => client),
      getEnv: getEnv({
        INSFORGE_API_KEY: "server-key",
        INSFORGE_BASE_URL: "https://project.insforge.app",
      }),
      logger: testLogger,
    });

    const response = await handler(
      new Request(
        `https://eventseal.test/functions/get-receipt?receiptId=${receiptId}`,
      ),
    );

    expect(response.status).toBe(500);
    expect(await jsonBody(response)).toEqual({
      error: "Receipt lookup failed",
    });
    expect(testLogger.error).toHaveBeenCalledWith(
      "EventSeal receipt lookup failed",
      databaseError,
    );
  });
});

describe("createHeliusWebhookHandler", () => {
  const webhookEnv = {
    EVENTSEAL_CLUSTER: "devnet",
    EVENTSEAL_EVENT_DISCRIMINATOR: validVerifyInput.event.discriminator,
    EVENTSEAL_EVENT_FORMAT: "anchor-log",
    EVENTSEAL_EXPECTED_PROGRAM_ID: validVerifyInput.expectedProgramId,
    EVENTSEAL_WEBHOOK_SECRET: "webhook-secret",
    SOLANA_RPC_DEVNET_URL: "https://private-rpc.example",
  };

  it("rejects unauthorized requests before processing the payload", async () => {
    const verifyAndPersist = vi.fn();
    const handler = createHeliusWebhookHandler({
      getEnv: getEnv(webhookEnv),
      logger: logger(),
      verifyAndPersist,
    });

    const response = await handler(jsonRequest([{ signature: "sig-1" }]));

    expect(response.status).toBe(401);
    expect(await jsonBody(response)).toEqual({ error: "Unauthorized" });
    expect(verifyAndPersist).not.toHaveBeenCalled();
  });

  it("deduplicates signatures and verifies with configured event identity", async () => {
    const verifyAndPersist = vi.fn().mockResolvedValue(verificationResult);
    const handler = createHeliusWebhookHandler({
      getEnv: getEnv(webhookEnv),
      logger: logger(),
      verifyAndPersist,
    });

    const response = await handler(
      jsonRequest(
        [
          { signature: "sig-1" },
          { signature: "sig-1" },
          { signature: "sig-2" },
        ],
        { "X-EventSeal-Webhook-Secret": "webhook-secret" },
      ),
    );

    expect(response.status).toBe(200);
    expect(await jsonBody(response)).toEqual({
      failed: 0,
      processed: 2,
      results: [
        {
          result: verificationResult,
          signature: "sig-1",
          status: "verified",
        },
        {
          result: verificationResult,
          signature: "sig-2",
          status: "verified",
        },
      ],
    });
    expect(verifyAndPersist).toHaveBeenCalledTimes(2);
    expect(verifyAndPersist).toHaveBeenNthCalledWith(1, {
      cluster: "devnet",
      commitment: "finalized",
      event: validVerifyInput.event,
      expectedProgramId: validVerifyInput.expectedProgramId,
      rpcUrl: "https://private-rpc.example",
      signature: "sig-1",
    });
    expect(verifyAndPersist).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ signature: "sig-2" }),
    );
  });

  it("rejects payloads with too many unique signatures", async () => {
    const verifyAndPersist = vi.fn();
    const handler = createHeliusWebhookHandler({
      getEnv: getEnv(webhookEnv),
      logger: logger(),
      verifyAndPersist,
    });

    const response = await handler(
      jsonRequest(
        Array.from({ length: 26 }, (_, index) => ({
          signature: `sig-${index}`,
        })),
        { "X-EventSeal-Webhook-Secret": "webhook-secret" },
      ),
    );

    expect(response.status).toBe(400);
    expect(await jsonBody(response)).toEqual({
      error: "Webhook payload must include no more than 25 unique signatures",
    });
    expect(verifyAndPersist).not.toHaveBeenCalled();
  });

  it("limits concurrent webhook verification work", async () => {
    let active = 0;
    let maxActive = 0;
    const verifyAndPersist = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return verificationResult;
    });
    const handler = createHeliusWebhookHandler({
      getEnv: getEnv(webhookEnv),
      logger: logger(),
      verifyAndPersist,
    });

    const response = await handler(
      jsonRequest(
        Array.from({ length: 10 }, (_, index) => ({
          signature: `sig-${index}`,
        })),
        { "X-EventSeal-Webhook-Secret": "webhook-secret" },
      ),
    );

    expect(response.status).toBe(200);
    expect(verifyAndPersist).toHaveBeenCalledTimes(10);
    expect(maxActive).toBeLessThanOrEqual(4);
  });

  it("preserves successful webhook results when one signature fails", async () => {
    const failure = new Error("private RPC failed");
    const testLogger = logger();
    const verifyAndPersist = vi.fn(async ({ signature }) => {
      if (signature === "sig-2") throw failure;
      return { ...verificationResult, signature };
    });
    const handler = createHeliusWebhookHandler({
      getEnv: getEnv(webhookEnv),
      logger: testLogger,
      verifyAndPersist,
    });

    const response = await handler(
      jsonRequest([{ signature: "sig-1" }, { signature: "sig-2" }], {
        "X-EventSeal-Webhook-Secret": "webhook-secret",
      }),
    );

    expect(response.status).toBe(200);
    expect(await jsonBody(response)).toEqual({
      failed: 1,
      processed: 2,
      results: [
        {
          result: { ...verificationResult, signature: "sig-1" },
          signature: "sig-1",
          status: "verified",
        },
        {
          error: "Verification failed",
          signature: "sig-2",
          status: "failed",
        },
      ],
    });
    expect(testLogger.error).toHaveBeenCalledWith(
      "EventSeal webhook signature verification failed",
      { error: failure, signature: "sig-2" },
    );
  });

  it("rejects malformed webhook payloads", async () => {
    const handler = createHeliusWebhookHandler({
      getEnv: getEnv(webhookEnv),
      logger: logger(),
      verifyAndPersist: vi.fn(),
    });

    const response = await handler(
      jsonRequest([{ signature: " " }], {
        "X-EventSeal-Webhook-Secret": "webhook-secret",
      }),
    );

    expect(response.status).toBe(400);
    expect(await jsonBody(response)).toEqual({
      error: "Transaction at index 0 requires a non-empty signature",
    });
  });

  it("masks invalid webhook configuration and logs the original error", async () => {
    const testLogger = logger();
    const handler = createHeliusWebhookHandler({
      getEnv: getEnv({ ...webhookEnv, EVENTSEAL_EVENT_FORMAT: "custom-log" }),
      logger: testLogger,
      verifyAndPersist: vi.fn(),
    });

    const response = await handler(
      jsonRequest([{ signature: "sig-1" }], {
        "X-EventSeal-Webhook-Secret": "webhook-secret",
      }),
    );

    expect(response.status).toBe(500);
    expect(await jsonBody(response)).toEqual({
      error: "Webhook processing failed",
    });
    expect(testLogger.error).toHaveBeenCalledWith(
      "EventSeal webhook processing failed",
      expect.any(Error),
    );
  });
});
