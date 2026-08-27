import Link from "next/link";

import { signInWithGitHub } from "../auth/actions";
import { getCurrentUser } from "../../lib/auth-server";
import { listSavedReceipts, type SavedReceipt } from "../../lib/user-receipts";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="history-page">
        <div className="history-page__header">
          <p className="eyebrow">Private receipt history</p>
          <h1>Sign in to view saved receipts.</h1>
          <p>
            Verification stays available without an account. GitHub sign-in is
            only required to save receipt references privately.
          </p>
          <form action={signInWithGitHub}>
            <button className="primary-button" type="submit">
              Sign in with GitHub
            </button>
          </form>
        </div>
      </main>
    );
  }

  let receipts: SavedReceipt[] = [];
  let loadFailed = false;
  try {
    receipts = await listSavedReceipts();
  } catch {
    loadFailed = true;
  }

  return (
    <main className="history-page">
      <header className="history-page__header">
        <p className="eyebrow">Private receipt history</p>
        <h1>Saved receipt references.</h1>
        <p>
          Only your account can read this list. Each entry preserves the receipt
          reference without duplicating its verification evidence.
        </p>
      </header>

      {loadFailed ? (
        <div className="error-state" role="alert">
          <strong>Saved receipts are unavailable</strong>
          <p>Try loading this page again.</p>
        </div>
      ) : receipts.length === 0 ? (
        <div className="history-empty">
          <h2>No saved receipts yet.</h2>
          <p>Verify an event, then save the issued receipt.</p>
          <Link className="text-link" href="/verify">
            Open verifier
          </Link>
        </div>
      ) : (
        <ol className="history-list">
          {receipts.map((receipt) => (
            <li key={receipt.receiptId}>
              <code>{receipt.receiptId}</code>
              <time dateTime={receipt.savedAt}>
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "UTC",
                }).format(new Date(receipt.savedAt))}{" "}
                UTC
              </time>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
