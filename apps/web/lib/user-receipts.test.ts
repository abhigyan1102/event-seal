import { beforeEach, describe, expect, it, vi } from "vitest";

import { listSavedReceipts } from "./user-receipts";

const mocks = vi.hoisted(() => ({
  createAuthenticatedClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  limit: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./auth-server", () => ({
  createAuthenticatedClient: mocks.createAuthenticatedClient,
}));

const row = {
  receipt_id: `es_${"a".repeat(64)}`,
  saved_at: "2026-08-27T12:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createAuthenticatedClient.mockResolvedValue({
    database: { from: mocks.from },
  });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ order: mocks.order });
  mocks.order.mockReturnValue({ order: mocks.order, limit: mocks.limit });
  mocks.limit.mockResolvedValue({ data: [row], error: null });
});

describe("listSavedReceipts", () => {
  it("loads a bounded, deterministically ordered history using the current authenticated client", async () => {
    await expect(listSavedReceipts()).resolves.toEqual([
      { receiptId: row.receipt_id, savedAt: row.saved_at },
    ]);
    expect(mocks.from).toHaveBeenCalledWith("user_receipts");
    expect(mocks.select).toHaveBeenCalledWith("receipt_id,saved_at");
    expect(mocks.order).toHaveBeenNthCalledWith(1, "saved_at", {
      ascending: false,
    });
    expect(mocks.order).toHaveBeenNthCalledWith(2, "receipt_id", {
      ascending: true,
    });
    expect(mocks.limit).toHaveBeenCalledWith(25);
  });

  it("reads the database again on subsequent loads instead of retaining an earlier list", async () => {
    mocks.limit
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [row], error: null });

    await expect(listSavedReceipts()).resolves.toEqual([]);
    await expect(listSavedReceipts()).resolves.toEqual([
      { receiptId: row.receipt_id, savedAt: row.saved_at },
    ]);
    expect(mocks.createAuthenticatedClient).toHaveBeenCalledTimes(2);
  });

  it("does not present a backend failure as an empty history", async () => {
    mocks.limit.mockResolvedValue({
      data: null,
      error: { message: "private database details" },
    });

    await expect(listSavedReceipts()).rejects.toThrow(
      "Saved receipts are unavailable",
    );
  });

  it("rejects non-array responses", async () => {
    mocks.limit.mockResolvedValue({ data: row, error: null });

    await expect(listSavedReceipts()).rejects.toThrow(
      "Saved receipts are unavailable",
    );
  });

  it.each([
    null,
    { ...row, receipt_id: "invalid" },
    { ...row, saved_at: "invalid" },
    { receipt_id: row.receipt_id },
  ])(
    "rejects malformed rows instead of rendering a partial history",
    async (invalid) => {
      mocks.limit.mockResolvedValue({ data: [row, invalid], error: null });

      await expect(listSavedReceipts()).rejects.toThrow(
        "Saved receipt data is invalid",
      );
    },
  );
});
