import { describe, expect, it } from "vitest";

import {
  formatUsdcAmount,
  parseUsdcAmount,
  validateArcSettlementRequest,
} from "./arc-settlement";

const validRequest = {
  transactionHash:
    "0xEDAF47800669BD77029F6A779A3C2824A84E2E46385D45D53091A226E65769F0",
  expectedSender: "0xE398777AB152FC44893415A731CEAB226478F5AE",
  expectedRecipient: "0xBBC2A38AB48FA953EC68EE6115BD518D3A226F6E",
  expectedAmount: "8.388778",
};

describe("Arc settlement request validation", () => {
  it("normalizes hashes, addresses, and exact USDC base units", () => {
    const validation = validateArcSettlementRequest({
      ...validRequest,
      expectedAmount: "8.388778",
    });

    expect(validation).toEqual({
      ok: true,
      value: {
        transactionHash: validRequest.transactionHash.toLowerCase(),
        expectedSender: validRequest.expectedSender.toLowerCase(),
        expectedRecipient: validRequest.expectedRecipient.toLowerCase(),
        expectedAmount: "8.388778",
      },
    });
  });

  it("rejects malformed identities and imprecise or zero amounts", () => {
    expect(
      validateArcSettlementRequest({
        ...validRequest,
        transactionHash: "0x1234",
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateArcSettlementRequest({
        ...validRequest,
        expectedRecipient: "recipient.eth",
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateArcSettlementRequest({
        ...validRequest,
        expectedAmount: "1.0000001",
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateArcSettlementRequest({
        ...validRequest,
        expectedAmount: "0",
      }),
    ).toMatchObject({ ok: false });
  });

  it("converts USDC without floating-point arithmetic", () => {
    expect(parseUsdcAmount("25.0102")).toEqual({
      baseUnits: 25_010_200n,
      formatted: "25.0102",
    });
    expect(formatUsdcAmount(1_000_001n)).toBe("1.000001");
  });
});
