"use client";

import type { VerificationResult } from "@eventseal/sdk";
import Link from "next/link";
import { useState } from "react";

import type { BrowserVerifyEventInput } from "../lib/verification-request";
import {
  clusterLabels,
  evidenceLabel,
  reasonGuidance,
  transactionUrl,
  verdictTitles,
} from "../lib/verification-workspace";
import { SaveReceiptButton } from "./save-receipt-button";

export function VerificationReceipt({
  result,
  request,
  signedIn,
}: {
  result: VerificationResult;
  request: BrowserVerifyEventInput;
  signedIn: boolean;
}) {
  const [copyMessage, setCopyMessage] = useState("");
  const receiptId = result.receiptId;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch {
      setCopyMessage(
        "Clipboard access is unavailable. Select the receipt text or open Result JSON below to copy it manually.",
      );
    }
  }

  return (
    <article
      className={`receipt receipt--${result.verdict}`}
      aria-label="Verification result"
    >
      <p className="verdict">{result.verdict}</p>
      <h3>{verdictTitles[result.verdict]}</h3>
      <p className="receipt__code">
        <code>{result.reasonCode}</code>
      </p>
      <p className="receipt__reason">{result.reason}</p>
      <p className="receipt__guidance">{reasonGuidance[result.reasonCode]}</p>
      <h4>Checks performed</h4>
      {result.evidence.length ? (
        <ol className="evidence-list" aria-label="Verification evidence">
          {result.evidence.map((item, index) => (
            <li key={`${item.check}-${index}`}>
              <span
                className={`evidence-list__status evidence-list__status--${item.passed ? "passed" : "failed"}`}
              >
                {item.passed ? "Passed" : "Not passed"}
              </span>
              <div>
                <strong>{evidenceLabel(item.check)}</strong>
                <p>{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="receipt__reason">
          No individual checks were returned. This is not proof of a successful
          verification.
        </p>
      )}
      <details className="receipt-details">
        <summary>Transaction and receipt details</summary>
        <dl className="receipt__identity">
          <div>
            <dt>Transaction</dt>
            <dd>{result.signature}</dd>
          </div>
          <div>
            <dt>Cluster</dt>
            <dd>{clusterLabels[result.cluster]}</dd>
          </div>
          <div>
            <dt>Commitment</dt>
            <dd>{result.commitment}</dd>
          </div>
          <div>
            <dt>Slot</dt>
            <dd>{result.slot ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Expected program</dt>
            <dd>{result.expectedProgramId}</dd>
          </div>
          <div>
            <dt>Discriminator</dt>
            <dd>{request.event.discriminator}</dd>
          </div>
          {result.event && (
            <>
              <div>
                <dt>Emitter program</dt>
                <dd>{result.event.emitterProgramId}</dd>
              </div>
              <div>
                <dt>Event position</dt>
                <dd>{result.event.eventPosition}</dd>
              </div>
              <div>
                <dt>Event data hash</dt>
                <dd>{result.event.eventDataHash}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Receipt ID</dt>
            <dd>{receiptId ?? "Not issued"}</dd>
          </div>
        </dl>
      </details>
      <a
        className="text-link transaction-link"
        href={transactionUrl(result.signature, result.cluster)}
        target="_blank"
        rel="noreferrer"
      >
        View transaction on Solana Explorer <span aria-hidden="true">↗</span>
      </a>
      <div className="receipt__actions">
        <button
          className="text-button"
          type="button"
          onClick={() => {
            void copy(JSON.stringify(result, null, 2), "Result JSON");
          }}
        >
          Copy result JSON
        </button>
        {receiptId && (
          <>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                void copy(receiptId, "Receipt ID");
              }}
            >
              Copy receipt ID
            </button>
            <Link className="text-link" href={`/receipts/${receiptId}`}>
              Open public receipt
            </Link>
          </>
        )}
      </div>
      <p className="copy-status" role="status">
        {copyMessage}
      </p>
      {receiptId ? (
        signedIn ? (
          <SaveReceiptButton key={receiptId} receiptId={receiptId} />
        ) : (
          <p className="save-receipt__hint">
            Sign in with GitHub to save a private reference to this receipt.
            Receipt evidence remains public by ID.
          </p>
        )
      ) : (
        <p className="save-receipt__hint">
          No receipt was issued for this result. There is nothing to save.
        </p>
      )}
      <details className="result-json">
        <summary>Result JSON</summary>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </details>
    </article>
  );
}
