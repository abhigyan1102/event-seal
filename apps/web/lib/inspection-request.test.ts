import { describe, expect, it } from "vitest";

import { validateBrowserInspectTransactionInput } from "./inspection-request";

const validInput = { signature: "1".repeat(64), cluster: "devnet" };

describe("browser inspection request validation", () => {
  it("accepts only a normalized signature and cluster", () => {
    expect(
      validateBrowserInspectTransactionInput({
        signature: ` ${validInput.signature} `,
        cluster: validInput.cluster,
      }),
    ).toEqual({ ok: true, value: validInput });
  });

  it.each([
    null,
    [],
    {},
    { ...validInput, rpcUrl: "https://attacker.test" },
    { ...validInput, expectedProgramId: "program" },
    { ...validInput, cluster: "localnet" },
    { ...validInput, signature: "" },
    { ...validInput, signature: "1".repeat(32) },
    { ...validInput, signature: "not-a-base58-signature!" },
  ])("rejects invalid or expanded browser input %j", (input) => {
    expect(validateBrowserInspectTransactionInput(input).ok).toBe(false);
  });
});
