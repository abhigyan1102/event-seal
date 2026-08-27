import { describe, expect, it } from "vitest";

import { validateBrowserVerifyEventInput } from "./verification-request";

const validInput = {
  signature: "5UfDuXexample",
  cluster: "devnet",
  expectedProgramId: "EventSealDemo11111111111111111111111111111",
  event: {
    format: "anchor-log",
    discriminator: "0102030405060708",
  },
  commitment: "finalized",
};

describe("validateBrowserVerifyEventInput", () => {
  it("normalizes a valid request and fixes commitment to finalized", () => {
    expect(
      validateBrowserVerifyEventInput({
        ...validInput,
        signature: `  ${validInput.signature}  `,
        commitment: undefined,
      }),
    ).toEqual({
      ok: true,
      value: { ...validInput, commitment: "finalized" },
    });
  });

  it("rejects a browser-supplied RPC endpoint", () => {
    expect(
      validateBrowserVerifyEventInput({
        ...validInput,
        rpcUrl: "https://private-rpc.example",
      }),
    ).toEqual({
      ok: false,
      error: "rpcUrl is not accepted by the browser adapter",
    });
  });

  it("rejects malformed discriminators", () => {
    const result = validateBrowserVerifyEventInput({
      ...validInput,
      event: { ...validInput.event, discriminator: "ABCDEF" },
    });

    expect(result).toEqual({
      ok: false,
      error: "event.discriminator must be 16 lowercase hexadecimal characters",
    });
  });

  it("rejects unbounded identifiers", () => {
    const result = validateBrowserVerifyEventInput({
      ...validInput,
      expectedProgramId: "a".repeat(65),
    });

    expect(result).toEqual({
      ok: false,
      error:
        "expectedProgramId must be a non-empty string of at most 64 characters",
    });
  });
});
