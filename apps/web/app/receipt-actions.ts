"use server";

import { revalidatePath } from "next/cache";

import { createAuthenticatedClient, getCurrentUser } from "../lib/auth-server";
import type { SaveReceiptState } from "../lib/receipt-action-state";
import { isReceiptId } from "../lib/receipt-id";

export async function saveReceipt(
  _previous: SaveReceiptState,
  formData: FormData,
): Promise<SaveReceiptState> {
  const receiptId = formData.get("receiptId");
  if (typeof receiptId !== "string" || !isReceiptId(receiptId)) {
    return { status: "error", message: "This receipt ID is invalid." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Sign in to save this receipt." };
  }

  try {
    const client = await createAuthenticatedClient();
    const { error } = await client.database
      .from("user_receipts")
      .upsert([{ receipt_id: receiptId }], {
        onConflict: "user_id,receipt_id",
        ignoreDuplicates: true,
      });
    if (error) {
      return { status: "error", message: "The receipt could not be saved." };
    }
    revalidatePath("/history");
    return { status: "saved", message: "Receipt saved to your history." };
  } catch {
    return { status: "error", message: "The receipt could not be saved." };
  }
}
