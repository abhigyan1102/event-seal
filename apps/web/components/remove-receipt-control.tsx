"use client";

import { useActionState, useState } from "react";

import { removeReceipt } from "../app/receipt-actions";
import { initialRemoveReceiptState } from "../lib/receipt-action-state";

export function RemoveReceiptControl({ receiptId }: { receiptId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(
    removeReceipt,
    initialRemoveReceiptState,
  );

  if (!confirming) {
    return (
      <button
        className="dashboard-remove__trigger"
        type="button"
        onClick={() => setConfirming(true)}
      >
        Remove from dashboard
      </button>
    );
  }

  return (
    <div className="dashboard-remove">
      <form action={action}>
        <input name="receiptId" type="hidden" value={receiptId} />
        <button disabled={pending} type="submit">
          {pending ? "Removing…" : "Confirm removal"}
        </button>
        <button
          disabled={pending}
          type="button"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
      </form>
      {state.message ? (
        <p
          className={`dashboard-remove__message dashboard-remove__message--${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
