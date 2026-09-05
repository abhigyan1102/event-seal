"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef, useState } from "react";

import type { PublicReceipt } from "../lib/public-receipt";
import {
  clusterLabels,
  evidenceLabel,
  reasonGuidance,
  transactionUrl,
} from "../lib/verification-workspace";
import { SaveReceiptButton } from "./save-receipt-button";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const headline = {
  verified: { lead: "Event", emphasis: "verified." },
  rejected: { lead: "Event", emphasis: "rejected." },
  indeterminate: { lead: "Verification", emphasis: "inconclusive." },
} as const;

export function PublicReceiptView({
  receipt,
  shareUrl,
  signedIn,
}: {
  receipt: PublicReceipt;
  shareUrl: string;
  signedIn: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [activeEvidence, setActiveEvidence] = useState(0);
  const title = headline[receipt.verdict];
  const activeItem = receipt.evidence[activeEvidence];

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const ledger = root.current?.querySelector(".public-receipt__ledger");
      if (ledger) {
        gsap
          .timeline({
            scrollTrigger: {
              trigger: ledger,
              start: "top 82%",
              end: "bottom 8%",
              scrub: 0.65,
            },
          })
          .fromTo(
            ledger,
            { opacity: 0.34, scale: 0.8 },
            { opacity: 1, scale: 1, duration: 0.58, ease: "none" },
          )
          .to(ledger, {
            opacity: 0.2,
            scale: 1.04,
            duration: 0.42,
            ease: "none",
          });
      }

      const modules = gsap.utils.toArray<HTMLElement>(
        root.current?.querySelectorAll(".public-receipt__module") ?? [],
      );
      gsap.fromTo(
        modules,
        { opacity: 0.2, y: 96, scale: 0.94 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.12,
          ease: "none",
          scrollTrigger: {
            trigger: ".public-receipt__grid",
            start: "top 86%",
            end: "bottom 48%",
            scrub: 0.7,
          },
        },
      );
    },
    { scope: root },
  );

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch {
      setCopyMessage(
        "Clipboard access is unavailable. Select the value to copy it manually.",
      );
    }
  }

  function selectEvidence(index: number) {
    setActiveEvidence(index);
  }

  return (
    <main
      ref={root}
      className={`public-receipt public-receipt--${receipt.verdict}`}
    >
      <header className="public-receipt__hero">
        <p className="public-receipt__kicker">
          Public EventSeal receipt · v{receipt.receipt_version}
        </p>
        <h1>
          {title.lead}
          <span className="public-receipt__inline-image" aria-hidden="true" />
          <span>{title.emphasis}</span>
        </h1>
        <p className="public-receipt__reason">
          {receipt.receipt_version === 2
            ? receipt.reason
            : "This legacy receipt preserves the observed event outcome. Its trusted request identity was not stored in v1."}
        </p>
        <p className="public-receipt__guidance">
          {reasonGuidance[receipt.reason_code]}
        </p>
        <div className="public-receipt__ledger" aria-hidden="true" />
      </header>

      <div className="public-receipt__grid">
        <section className="public-receipt__module public-receipt__module--receipt">
          <h2>Receipt identity</h2>
          <ReceiptRows
            rows={[
              ["Receipt ID", receipt.receipt_id, true],
              ["Schema", `Version ${receipt.receipt_version}`],
              ["Created", formatUtc(receipt.created_at)],
              ["Network", clusterLabels[receipt.cluster]],
              ["Verdict", sentenceCase(receipt.verdict)],
              ["Reason code", receipt.reason_code, true],
            ]}
          />
        </section>

        <section className="public-receipt__module public-receipt__module--trusted">
          <h2>Trusted event identity</h2>
          {receipt.receipt_version === 2 ? (
            <ReceiptRows
              rows={[
                ["Expected program", receipt.expected_program_id, true],
                ["Event format", receipt.event_format],
                ["Discriminator", receipt.event_discriminator, true],
                ["Commitment", receipt.commitment],
              ]}
            />
          ) : (
            <div className="public-receipt__legacy-note">
              <strong>Unavailable in legacy v1</strong>
              <p>
                The expected program, event format, discriminator, and
                commitment were not bound into legacy receipt IDs.
              </p>
            </div>
          )}
        </section>

        <section className="public-receipt__module public-receipt__module--transaction">
          <h2>Transaction</h2>
          <ReceiptRows
            rows={[
              ["Signature", receipt.signature, true],
              [
                "Slot",
                receipt.slot === null ? "Unavailable" : String(receipt.slot),
              ],
              ["Emitter program", receipt.emitter_program_id, true],
              ["Event position", String(receipt.event_position)],
              ["Event data hash", receipt.event_data_hash, true],
            ]}
          />
          <a
            className="public-receipt__explorer-link"
            href={transactionUrl(receipt.signature, receipt.cluster)}
            target="_blank"
            rel="noreferrer"
          >
            Open in Solana Explorer <span aria-hidden="true">↗</span>
          </a>
        </section>

        <section className="public-receipt__module public-receipt__module--evidence">
          <div className="public-receipt__module-heading">
            <div>
              <h2>Verification evidence</h2>
              <p>Each check records the decision the verifier made.</p>
            </div>
            <span>
              {receipt.evidence.length}{" "}
              {receipt.evidence.length === 1 ? "check" : "checks"}
            </span>
          </div>

          {receipt.evidence.length > 0 && activeItem ? (
            <>
              <div
                className="receipt-evidence-accordion"
                role="tablist"
                aria-label="Receipt evidence"
              >
                {receipt.evidence.map((item, index) => (
                  <button
                    key={`${item.check}-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={activeEvidence === index}
                    className="receipt-evidence-accordion__item"
                    onClick={() => selectEvidence(index)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{evidenceLabel(item.check)}</strong>
                    <small>{item.passed ? "Passed" : "Not passed"}</small>
                  </button>
                ))}
              </div>
              <div
                className="receipt-evidence-detail"
                role="tabpanel"
                aria-live="polite"
              >
                <div>
                  <span
                    className={`receipt-evidence-detail__status receipt-evidence-detail__status--${activeItem.passed ? "passed" : "failed"}`}
                  >
                    {activeItem.passed ? "Passed" : "Not passed"}
                  </span>
                  <h3>{evidenceLabel(activeItem.check)}</h3>
                </div>
                <p>{activeItem.detail}</p>
              </div>
              <nav
                className="receipt-evidence-pager"
                aria-label="Choose evidence check"
              >
                <button
                  type="button"
                  aria-label="Previous evidence check"
                  onClick={() =>
                    selectEvidence(
                      (activeEvidence - 1 + receipt.evidence.length) %
                        receipt.evidence.length,
                    )
                  }
                >
                  ←
                </button>
                <div>
                  {receipt.evidence.map((item, index) => (
                    <button
                      key={`${item.check}-page-${index}`}
                      type="button"
                      aria-label={`Show evidence check ${index + 1}`}
                      aria-current={
                        activeEvidence === index ? "step" : undefined
                      }
                      onClick={() => selectEvidence(index)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Next evidence check"
                  onClick={() =>
                    selectEvidence(
                      (activeEvidence + 1) % receipt.evidence.length,
                    )
                  }
                >
                  →
                </button>
              </nav>
            </>
          ) : (
            <p className="public-receipt__empty-evidence">
              No individual checks were stored. This does not establish a
              successful verification.
            </p>
          )}
        </section>
      </div>

      <section className="public-receipt__actions" aria-label="Receipt actions">
        <button
          type="button"
          onClick={() => void copy(receipt.receipt_id, "Receipt ID")}
        >
          Copy receipt ID
        </button>
        <button type="button" onClick={() => void copy(shareUrl, "Share link")}>
          Copy share link
        </button>
        <Link href="/verify">Verify another transaction</Link>
        <p role="status">{copyMessage}</p>
        {signedIn ? (
          <SaveReceiptButton receiptId={receipt.receipt_id} />
        ) : (
          <p className="public-receipt__save-note">
            Sign in with GitHub to save this public receipt to your private
            history.
          </p>
        )}
      </section>
    </main>
  );
}

function ReceiptRows({
  rows,
}: {
  rows: readonly (readonly [label: string, value: string, code?: boolean])[];
}) {
  return (
    <dl className="public-receipt__rows">
      {rows.map(([label, value, code]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{code ? <code>{value}</code> : value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatUtc(timestamp: string): string {
  return `${new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(timestamp))} UTC`;
}

function sentenceCase(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
