import { beforeEach, describe, expect, it, vi } from "vitest";

import { initialSaveReceiptState } from "../lib/receipt-action-state";
import { saveReceipt } from "./receipt-actions";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<{ id: string } | null>>(),
  createAuthenticatedClient: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn<() => Promise<{ error: unknown }>>(),
  revalidatePath: vi.fn(),
}));

vi.mock("../lib/auth-server", () => ({
  getCurrentUser: mocks.getCurrentUser,
  createAuthenticatedClient: mocks.createAuthenticatedClient,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const receiptId = `es_${"a".repeat(64)}`;

function receiptForm(value = receiptId): FormData {
  const form = new FormData();
  form.set("receiptId", value);
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "signed-in-user" });
  mocks.createAuthenticatedClient.mockResolvedValue({
    database: { from: mocks.from },
  });
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
  mocks.upsert.mockResolvedValue({ error: null });
});

describe("saveReceipt", () => {
  it("rejects malformed or missing IDs before accessing authentication or the database", async () => {
    for (const form of [receiptForm("invalid"), new FormData()]) {
      await expect(saveReceipt(initialSaveReceiptState, form)).resolves.toEqual(
        {
          status: "error",
          message: "This receipt ID is invalid.",
        },
      );
    }
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.createAuthenticatedClient).not.toHaveBeenCalled();
  });

  it("rejects anonymous saves without writing or invalidating history", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(
      saveReceipt(initialSaveReceiptState, receiptForm()),
    ).resolves.toEqual({
      status: "error",
      message: "Sign in to save this receipt.",
    });
    expect(mocks.createAuthenticatedClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("saves only the reference through the authenticated client and ignores submitted ownership", async () => {
    const form = receiptForm();
    form.set("user_id", "another-user");
    form.set("saved_at", "2000-01-01T00:00:00Z");

    await expect(saveReceipt(initialSaveReceiptState, form)).resolves.toEqual({
      status: "saved",
      message: "Receipt saved to your history.",
    });
    expect(mocks.from).toHaveBeenCalledWith("user_receipts");
    expect(mocks.upsert).toHaveBeenCalledWith([{ receipt_id: receiptId }], {
      onConflict: "user_id,receipt_id",
      ignoreDuplicates: true,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/history");
  });

  it("uses the same conflict handling for repeated saves", async () => {
    await saveReceipt(initialSaveReceiptState, receiptForm());
    await expect(
      saveReceipt(initialSaveReceiptState, receiptForm()),
    ).resolves.toMatchObject({ status: "saved" });
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).toHaveBeenLastCalledWith([{ receipt_id: receiptId }], {
      onConflict: "user_id,receipt_id",
      ignoreDuplicates: true,
    });
  });

  it("sanitizes database errors, including a receipt that does not exist", async () => {
    mocks.upsert.mockResolvedValue({
      error: { code: "23503", message: "private database details" },
    });

    await expect(
      saveReceipt(initialSaveReceiptState, receiptForm()),
    ).resolves.toEqual({
      status: "error",
      message: "The receipt could not be saved.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not report success when creating the authenticated client fails", async () => {
    mocks.createAuthenticatedClient.mockRejectedValue(
      new Error("private configuration details"),
    );

    await expect(
      saveReceipt(initialSaveReceiptState, receiptForm()),
    ).resolves.toEqual({
      status: "error",
      message: "The receipt could not be saved.",
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
