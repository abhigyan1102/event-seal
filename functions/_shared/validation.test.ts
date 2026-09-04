import { describe, expect, it } from "vitest";

import {
  applyServerRpcUrl,
  validateHeliusPayload,
  validateReceiptId,
  validateVerifyEventInput,
  validateWebhookConfiguration,
} from "./validation.ts";

const validInput = {
  signature: "5UfDuXexampleSignature",
  cluster: "devnet",
  expectedProgramId: "EventSeal111111111111111111111111111111111",
  event: {
    format: "anchor-log",
    discriminator: "0102030405060708",
  },
};

describe("applyServerRpcUrl", () => {
  it("adds the deployment-owned RPC URL to hosted verify-event input", () => {
    expect(
      applyServerRpcUrl(validInput, {
        SOLANA_RPC_DEVNET_URL: "https://private-rpc.example",
      }),
    ).toEqual({
      ok: true,
      value: { ...validInput, rpcUrl: "https://private-rpc.example" },
    });
  });

  it("leaves input unchanged when no deployment RPC URL is configured", () => {
    expect(applyServerRpcUrl(validInput, {})).toEqual({
      ok: true,
      value: validInput,
    });
  });

  it("rejects blank deployment RPC URL configuration", () => {
    expect(
      applyServerRpcUrl(validInput, { SOLANA_RPC_DEVNET_URL: "" }),
    ).toEqual({
      ok: false,
      error: "The configured cluster RPC URL must be non-empty",
    });
  });

  it("isolates per-network endpoints and explicitly bound legacy overrides", () => {
    const env = {
      SOLANA_RPC_MAINNET_URL: "https://mainnet.example",
      SOLANA_RPC_DEVNET_URL: "https://devnet.example",
    };
    expect(
      applyServerRpcUrl({ ...validInput, cluster: "mainnet-beta" }, env),
    ).toMatchObject({ value: { rpcUrl: "https://mainnet.example" } });
    expect(applyServerRpcUrl(validInput, env)).toMatchObject({
      value: { rpcUrl: "https://devnet.example" },
    });
    const legacy = {
      SOLANA_RPC_URL: "https://devnet.example",
      SOLANA_RPC_CLUSTER: "devnet",
    };
    expect(applyServerRpcUrl(validInput, legacy)).toMatchObject({
      value: { rpcUrl: legacy.SOLANA_RPC_URL },
    });
    expect(
      applyServerRpcUrl({ ...validInput, cluster: "mainnet-beta" }, legacy),
    ).toEqual({ ok: true, value: { ...validInput, cluster: "mainnet-beta" } });
    expect(
      applyServerRpcUrl(validInput, {
        SOLANA_RPC_URL: "https://unbound.example",
      }).ok,
    ).toBe(false);
    expect(
      applyServerRpcUrl(validInput, {
        SOLANA_RPC_DEVNET_URL: "file:///tmp/test",
      }).ok,
    ).toBe(false);
    expect(
      applyServerRpcUrl(validInput, {
        SOLANA_RPC_DEVNET_URL: "http://devnet.example",
      }),
    ).toEqual({
      ok: false,
      error: "The configured cluster RPC URL must use HTTPS",
    });
  });
});

describe("validateVerifyEventInput", () => {
  it("accepts a valid VerifyEventInput shape", () => {
    const result = validateVerifyEventInput({
      ...validInput,
      commitment: "finalized",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ...validInput,
        commitment: "finalized",
      },
    });
  });

  it("rejects non-object bodies", () => {
    const result = validateVerifyEventInput([]);

    expect(result).toEqual({
      ok: false,
      error: "Request body must be a JSON object",
    });
  });

  it("rejects empty identifiers", () => {
    expect(validateVerifyEventInput({ ...validInput, signature: " " })).toEqual(
      { ok: false, error: "signature must be a non-empty string" },
    );
    expect(
      validateVerifyEventInput({ ...validInput, expectedProgramId: "" }),
    ).toEqual({
      ok: false,
      error: "expectedProgramId must be a non-empty string",
    });
  });

  it("rejects unsupported clusters and event formats", () => {
    expect(
      validateVerifyEventInput({ ...validInput, cluster: "localnet" }),
    ).toEqual({
      ok: false,
      error: "cluster must be mainnet-beta, devnet, or testnet",
    });
    expect(
      validateVerifyEventInput({
        ...validInput,
        event: { ...validInput.event, format: "custom-log" },
      }),
    ).toEqual({
      ok: false,
      error: "event.format must be anchor-log or anchor-cpi",
    });
  });

  it("rejects uppercase or malformed discriminators", () => {
    expect(
      validateVerifyEventInput({
        ...validInput,
        event: { ...validInput.event, discriminator: "010203040506070A" },
      }),
    ).toEqual({
      ok: false,
      error: "event.discriminator must be 16 lowercase hexadecimal characters",
    });
  });

  it("rejects unsupported commitment values", () => {
    expect(
      validateVerifyEventInput({ ...validInput, commitment: "confirmed" }),
    ).toEqual({
      ok: false,
      error: "commitment must be finalized when provided",
    });
  });

  it("rejects client-controlled RPC URLs", () => {
    expect(
      validateVerifyEventInput({
        ...validInput,
        rpcUrl: "https://api.devnet.solana.com",
      }),
    ).toEqual({
      ok: false,
      error: "rpcUrl is not accepted by the hosted verify-event function",
    });
  });
});

describe("validateReceiptId", () => {
  it("accepts EventSeal receipt IDs", () => {
    const receiptId = `es_${"a".repeat(64)}`;

    expect(validateReceiptId(receiptId)).toEqual({
      ok: true,
      value: receiptId,
    });
  });

  it("rejects missing or malformed receipt IDs", () => {
    expect(validateReceiptId("")).toEqual({
      ok: false,
      error: "receiptId is required",
    });
    expect(validateReceiptId("not-a-receipt")).toEqual({
      ok: false,
      error: "receiptId must match the EventSeal receipt format",
    });
  });
});

describe("validateHeliusPayload", () => {
  it("deduplicates valid transaction signatures", () => {
    expect(
      validateHeliusPayload([
        { signature: "sig-1", ignored: true },
        { signature: "sig-1" },
        { signature: "sig-2" },
      ]),
    ).toEqual({ ok: true, value: ["sig-1", "sig-2"] });
  });

  it("accepts an empty transaction array", () => {
    expect(validateHeliusPayload([])).toEqual({ ok: true, value: [] });
  });

  it("rejects non-array payloads and malformed transaction entries", () => {
    expect(validateHeliusPayload({ signature: "sig-1" })).toEqual({
      ok: false,
      error: "Expected an array of transactions",
    });
    expect(validateHeliusPayload([null])).toEqual({
      ok: false,
      error: "Transaction at index 0 must be a JSON object",
    });
    expect(validateHeliusPayload([{ signature: " " }])).toEqual({
      ok: false,
      error: "Transaction at index 0 requires a non-empty signature",
    });
  });
});

describe("validateWebhookConfiguration", () => {
  const validEnv = {
    EVENTSEAL_CLUSTER: "devnet",
    EVENTSEAL_EXPECTED_PROGRAM_ID: validInput.expectedProgramId,
    EVENTSEAL_EVENT_FORMAT: "anchor-log",
    EVENTSEAL_EVENT_DISCRIMINATOR: validInput.event.discriminator,
    SOLANA_RPC_DEVNET_URL: "https://api.devnet.solana.com",
  };

  it("accepts valid webhook configuration", () => {
    expect(validateWebhookConfiguration(validEnv)).toEqual({
      ok: true,
      value: {
        cluster: "devnet",
        expectedProgramId: validInput.expectedProgramId,
        event: validInput.event,
        commitment: "finalized",
        rpcUrl: "https://api.devnet.solana.com",
      },
    });
  });

  it("rejects invalid webhook configuration values", () => {
    expect(
      validateWebhookConfiguration({
        ...validEnv,
        EVENTSEAL_EXPECTED_PROGRAM_ID: "",
      }),
    ).toEqual({
      ok: false,
      error: "EVENTSEAL_EXPECTED_PROGRAM_ID is required",
    });
    expect(
      validateWebhookConfiguration({
        ...validEnv,
        EVENTSEAL_EVENT_FORMAT: "custom-log",
      }),
    ).toEqual({
      ok: false,
      error: "EVENTSEAL_EVENT_FORMAT must be anchor-log or anchor-cpi",
    });
    expect(
      validateWebhookConfiguration({
        ...validEnv,
        SOLANA_RPC_DEVNET_URL: " ",
      }),
    ).toEqual({
      ok: false,
      error: "The configured cluster RPC URL must be non-empty",
    });
    expect(
      validateWebhookConfiguration({
        ...validEnv,
        EVENTSEAL_CLUSTER: "localnet",
      }),
    ).toEqual({
      ok: false,
      error: "EVENTSEAL_CLUSTER must be mainnet-beta, devnet, or testnet",
    });
    expect(
      validateWebhookConfiguration({
        ...validEnv,
        EVENTSEAL_EVENT_DISCRIMINATOR: "010203040506070Z",
      }),
    ).toEqual({
      ok: false,
      error:
        "EVENTSEAL_EVENT_DISCRIMINATOR must be 16 lowercase hexadecimal characters",
    });
  });
});
