"use client";

import { useActionState } from "react";

import { saveReceipt } from "../app/receipt-actions";
import { initialSaveReceiptState } from "../lib/receipt-action-state";

export function SaveReceiptButton({ receiptId }: { receiptId: string }) {
  const [state, action, pending] = useActionState(
    saveReceipt,
    initialSaveReceiptState,
  );

  return (
    <form className="save-receipt" action={action}>
      <input type="hidden" name="receiptId" value={receiptId} />
      <button
        className="secondary-button"
        type="submit"
        disabled={pending || state.status === "saved"}
      >
        {pending
          ? "Saving receipt"
          : state.status === "saved"
            ? "Receipt saved"
            : "Save receipt"}
      </button>
      {state.message && (
        <p
          className={`save-receipt__message save-receipt__message--${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
