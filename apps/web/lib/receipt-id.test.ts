import { describe, expect, it } from "vitest";

import { isReceiptId } from "./receipt-id";

describe("isReceiptId", () => {
  it("accepts canonical receipt IDs", () => {
    expect(isReceiptId(`es_${"a".repeat(64)}`)).toBe(true);
  });

  it("rejects malformed or non-canonical receipt IDs", () => {
    expect(isReceiptId(`es_${"A".repeat(64)}`)).toBe(false);
    expect(isReceiptId(`es_${"a".repeat(63)}`)).toBe(false);
    expect(isReceiptId(`prefix_es_${"a".repeat(64)}`)).toBe(false);
  });
});
