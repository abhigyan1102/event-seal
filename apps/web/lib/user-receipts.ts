import "server-only";

import { createAuthenticatedClient } from "./auth-server";
import { isReceiptId } from "./receipt-id";

const HISTORY_LIMIT = 25;

export interface SavedReceipt {
  receiptId: string;
  savedAt: string;
}

export async function listSavedReceipts(): Promise<SavedReceipt[]> {
  const client = await createAuthenticatedClient();
  const { data, error } = await client.database
    .from("user_receipts")
    .select("receipt_id,saved_at")
    .order("saved_at", { ascending: false })
    .order("receipt_id", { ascending: true })
    .limit(HISTORY_LIMIT);

  if (error || !Array.isArray(data)) {
    throw new Error("Saved receipts are unavailable");
  }

  const rows: SavedReceipt[] = [];
  for (const value of data) {
    if (!isSavedReceiptRow(value)) {
      throw new Error("Saved receipt data is invalid");
    }
    rows.push({ receiptId: value.receipt_id, savedAt: value.saved_at });
  }
  return rows;
}

function isSavedReceiptRow(
  value: unknown,
): value is { receipt_id: string; saved_at: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "receipt_id" in value &&
    typeof value.receipt_id === "string" &&
    isReceiptId(value.receipt_id) &&
    "saved_at" in value &&
    typeof value.saved_at === "string" &&
    !Number.isNaN(Date.parse(value.saved_at))
  );
}
