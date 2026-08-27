import type { VerificationResult } from "@eventseal/sdk";
import { describe, expect, it } from "vitest";

import demo from "../../../tests/fixtures/devnet-demo.json";
import { validateBrowserVerifyEventInput } from "./verification-request";
import {
  clusterLabels,
  emptyVerificationRequest,
  evidenceLabel,
  exampleRequest,
  normalizeRequest,
  resultMatchesRequest,
  transactionUrl,
  validateWorkspaceRequest,
} from "./verification-workspace";

describe("verification workspace requests", () => {
  it.each(["success", "failure"] as const)(
    "loads the real %s fixture without a precomputed result",
    (kind) => {
      const input = exampleRequest(kind);
      expect(input.signature).toBe(demo.transactions[kind].signature);
      expect(input.expectedProgramId).toBe(demo.programId);
      expect(input.event.discriminator).toBe(demo.event.discriminator);
      expect(input.cluster).toBe(demo.cluster);
      expect(validateWorkspaceRequest(input)).toEqual({});
      expect(validateBrowserVerifyEventInput(input).ok).toBe(true);
      expect(input).not.toHaveProperty("verdict");
      expect(input).not.toHaveProperty("rpcUrl");
    },
  );

  it("normalizes pasted values without mutating the original", () => {
    const good = exampleRequest("success");
    const pasted = {
      ...good,
      signature: ` ${good.signature} `,
      expectedProgramId: ` ${good.expectedProgramId} `,
      event: {
        ...good.event,
        discriminator: ` ${good.event.discriminator.toUpperCase()} `,
      },
    };
    expect(normalizeRequest(pasted)).toEqual(good);
    expect(validateWorkspaceRequest(pasted)).toEqual({});
    expect(pasted.signature.startsWith(" ")).toBe(true);
  });

  it("returns field-level errors for an empty form", () => {
    expect(
      Object.keys(validateWorkspaceRequest(emptyVerificationRequest())),
    ).toEqual(["signature", "expectedProgramId", "discriminator"]);
  });

  it.each([
    "0".repeat(88),
    "1".repeat(63),
    "1".repeat(65),
    "z".repeat(88),
    "x".repeat(129),
    "https://explorer.solana.com/tx/example",
  ])("rejects invalid signature %s", (signature) => {
    expect(
      validateWorkspaceRequest({ ...exampleRequest("success"), signature })
        .signature,
    ).toBeDefined();
  });

  it.each(["1".repeat(31), "1".repeat(33), "z".repeat(44), "O".repeat(32)])(
    "rejects invalid program address %s",
    (expectedProgramId) => {
      expect(
        validateWorkspaceRequest({
          ...exampleRequest("success"),
          expectedProgramId,
        }).expectedProgramId,
      ).toBeDefined();
    },
  );

  it("counts leading zero bytes correctly", () => {
    expect(
      validateWorkspaceRequest({
        ...exampleRequest("success"),
        signature: "1".repeat(64),
        expectedProgramId: "1".repeat(32),
      }),
    ).toEqual({});
  });

  it.each(["0x1234567890abcdef", "1234", "gggggggggggggggg"])(
    "rejects invalid discriminator %s",
    (discriminator) => {
      const input = exampleRequest("success");
      input.event.discriminator = discriminator;
      expect(validateWorkspaceRequest(input).discriminator).toBeDefined();
    },
  );

  it("returns separate example objects", () => {
    const input = exampleRequest("success");
    input.event.discriminator = "";
    expect(exampleRequest("success").event.discriminator).toBe(
      demo.event.discriminator,
    );
  });
});

describe("result identity and links", () => {
  const request = exampleRequest("success");
  const result: VerificationResult = {
    ...request,
    commitment: "finalized",
    event: undefined,
    verdict: "verified",
    reasonCode: "VERIFIED",
    reason: "Verified",
    evidence: [],
  };
  it("accepts only the submitted transaction identity", () => {
    expect(resultMatchesRequest(result, request)).toBe(true);
    expect(
      resultMatchesRequest(
        { ...result, signature: exampleRequest("failure").signature },
        request,
      ),
    ).toBe(false);
    expect(
      resultMatchesRequest({ ...result, cluster: "testnet" }, request),
    ).toBe(false);
    expect(
      resultMatchesRequest(
        { ...result, expectedProgramId: "another-program" },
        request,
      ),
    ).toBe(false);
  });
  it.each(["devnet", "testnet", "mainnet-beta"] as const)(
    "links to the correct %s cluster",
    (cluster) => {
      const url = new URL(transactionUrl(request.signature, cluster));
      expect(url.origin).toBe("https://explorer.solana.com");
      expect(url.pathname).toBe(`/tx/${request.signature}`);
      expect(url.searchParams.get("cluster")).toBe(
        cluster === "mainnet-beta" ? null : cluster,
      );
      expect(clusterLabels[cluster]).toBeTruthy();
    },
  );
  it("encodes untrusted signature text instead of letting it alter the link", () => {
    const url = new URL(
      transactionUrl("a?cluster=mainnet-beta#fragment", "devnet"),
    );
    expect(url.searchParams.get("cluster")).toBe("devnet");
    expect(url.hash).toBe("");
    expect(url.pathname).toContain("%3F");
  });
  it("never resolves evidence labels through the prototype", () => {
    expect(evidenceLabel("__proto__")).toBe("__proto__");
    expect(evidenceLabel("constructor")).toBe("constructor");
    expect(evidenceLabel("attribution")).toBe("Event attribution");
  });
});
