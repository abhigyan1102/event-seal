"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import { useRef, useState } from "react";

import { dashboardHref, type DashboardFilters } from "../lib/dashboard-filters";
import type { SavedReceipt, SavedReceiptPage } from "../lib/user-receipts";
import { RemoveReceiptControl } from "./remove-receipt-control";

gsap.registerPlugin(useGSAP);

const VERDICTS: Array<{ label: string; value: DashboardFilters["verdict"] }> = [
  { label: "All", value: "all" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
  { label: "Inconclusive", value: "indeterminate" },
];

export function DashboardView({
  filters,
  receiptPage,
}: {
  filters: DashboardFilters;
  receiptPage: SavedReceiptPage;
}) {
  const scope = useRef<HTMLElement>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(
    receiptPage.items[0]?.receiptId ?? null,
  );

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-dashboard-reveal]", {
          autoAlpha: 0,
          y: 24,
          duration: 0.72,
          ease: "power3.out",
          stagger: 0.08,
        });
        gsap.from(".account-dashboard__ledger-art", {
          autoAlpha: 0,
          scale: 0.94,
          duration: 0.9,
          ease: "power3.out",
        });
      });
      return () => media.revert();
    },
    { scope },
  );

  const firstResult =
    receiptPage.total === 0
      ? 0
      : (receiptPage.page - 1) * receiptPage.pageSize + 1;
  const lastResult = Math.min(
    receiptPage.page * receiptPage.pageSize,
    receiptPage.total,
  );

  return (
    <main className="account-dashboard" ref={scope}>
      <section className="account-dashboard__hero" data-dashboard-reveal>
        <div>
          <p className="eyebrow">Private account dashboard</p>
          <h1>Your verification receipts.</h1>
          <p>
            Review saved outcomes and trusted event identity without repeating
            verification. Only your signed-in account can read this list.
          </p>
        </div>
        <div className="account-dashboard__ledger-art" aria-hidden="true" />
      </section>

      <section
        className="dashboard-summary"
        aria-label="Receipt history summary"
        data-dashboard-reveal
      >
        <div>
          <span>Matching receipts</span>
          <strong>{receiptPage.total}</strong>
        </div>
        <div>
          <span>Showing now</span>
          <strong>
            {firstResult}–{lastResult}
          </strong>
        </div>
        <div>
          <span>Page</span>
          <strong>
            {receiptPage.page} / {receiptPage.totalPages}
          </strong>
        </div>
      </section>

      <section className="dashboard-ledger" data-dashboard-reveal>
        <div className="dashboard-ledger__heading">
          <div>
            <p className="eyebrow">Saved evidence</p>
            <h2>Receipt ledger</h2>
          </div>
          <p>
            Filter by the decision or Solana cluster stored on each receipt.
          </p>
        </div>

        <form className="dashboard-filters" action="/dashboard" method="get">
          <fieldset>
            <legend>Outcome</legend>
            <div className="dashboard-filters__verdicts">
              {VERDICTS.map((option) => (
                <label key={option.value}>
                  <input
                    defaultChecked={filters.verdict === option.value}
                    name="verdict"
                    type="radio"
                    value={option.value}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="dashboard-filters__cluster">
            <span>Network</span>
            <select defaultValue={filters.cluster} name="cluster">
              <option value="all">All Solana clusters</option>
              <option value="mainnet-beta">Mainnet Beta</option>
              <option value="devnet">Devnet</option>
              <option value="testnet">Testnet</option>
            </select>
          </label>
          <button className="dashboard-filters__apply" type="submit">
            Apply filters
          </button>
        </form>

        {receiptPage.items.length === 0 ? (
          <div className="dashboard-empty">
            <h3>No receipts match this view.</h3>
            <p>
              Clear the filters, or verify another transaction and save its
              receipt.
            </p>
            <div>
              <Link className="secondary-button" href="/dashboard">
                Clear filters
              </Link>
              <Link className="primary-button" href="/verify">
                Verify a transaction
              </Link>
            </div>
          </div>
        ) : (
          <div className="dashboard-receipts">
            <div className="dashboard-receipts__labels" aria-hidden="true">
              <span>Outcome</span>
              <span>Receipt</span>
              <span>Network</span>
              <span>Saved</span>
              <span />
            </div>
            {receiptPage.items.map((savedReceipt) => (
              <ReceiptRow
                expanded={savedReceipt.receiptId === expandedReceiptId}
                key={savedReceipt.receiptId}
                onToggle={() =>
                  setExpandedReceiptId((current) =>
                    current === savedReceipt.receiptId
                      ? null
                      : savedReceipt.receiptId,
                  )
                }
                savedReceipt={savedReceipt}
              />
            ))}
          </div>
        )}

        <div className="dashboard-pagination" aria-label="Receipt pages">
          {receiptPage.page > 1 ? (
            <Link href={dashboardHref(filters, receiptPage.page - 1)}>
              ← Previous
            </Link>
          ) : (
            <span aria-disabled="true">← Previous</span>
          )}
          <p>
            Page {receiptPage.page} of {receiptPage.totalPages}
          </p>
          {receiptPage.page < receiptPage.totalPages ? (
            <Link href={dashboardHref(filters, receiptPage.page + 1)}>
              Next →
            </Link>
          ) : (
            <span aria-disabled="true">Next →</span>
          )}
        </div>
      </section>

      <section className="dashboard-next" data-dashboard-reveal>
        <div>
          <p className="eyebrow">New evidence</p>
          <h2>Need to verify another transaction?</h2>
        </div>
        <Link className="primary-button" href="/verify">
          Open verifier <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}

function ReceiptRow({
  expanded,
  onToggle,
  savedReceipt,
}: {
  expanded: boolean;
  onToggle: () => void;
  savedReceipt: SavedReceipt;
}) {
  const { receipt } = savedReceipt;
  return (
    <article className="dashboard-receipt">
      <div className="dashboard-receipt__summary">
        <span
          className={`dashboard-verdict dashboard-verdict--${receipt.verdict}`}
        >
          {receipt.verdict === "indeterminate"
            ? "Inconclusive"
            : titleCase(receipt.verdict)}
        </span>
        <Link
          className="dashboard-receipt__id"
          href={`/receipts/${savedReceipt.receiptId}`}
        >
          <code>{shorten(savedReceipt.receiptId, 18, 10)}</code>
        </Link>
        <span>{clusterLabel(receipt.cluster)}</span>
        <time dateTime={savedReceipt.savedAt}>
          {formatSavedDate(savedReceipt.savedAt)}
        </time>
        <button
          aria-expanded={expanded}
          className="dashboard-receipt__toggle"
          type="button"
          onClick={onToggle}
        >
          {expanded ? "Close" : "Details"}
          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
      </div>

      {expanded ? (
        <div className="dashboard-receipt__details">
          <div>
            <span>Decision reason</span>
            <strong>{receipt.reason ?? "Legacy receipt"}</strong>
            <small>{receipt.reason_code.replaceAll("_", " ")}</small>
          </div>
          <dl>
            <div>
              <dt>Transaction</dt>
              <dd>
                <code>{shorten(receipt.signature, 22, 12)}</code>
              </dd>
            </div>
            <div>
              <dt>Expected program</dt>
              <dd>
                <code>
                  {receipt.expected_program_id
                    ? shorten(receipt.expected_program_id, 18, 10)
                    : "Not recorded in v1"}
                </code>
              </dd>
            </div>
            <div>
              <dt>Event discriminator</dt>
              <dd>
                <code>
                  {receipt.event_discriminator ?? "Not recorded in v1"}
                </code>
              </dd>
            </div>
            <div>
              <dt>Slot</dt>
              <dd>{receipt.slot?.toLocaleString("en-US") ?? "Unavailable"}</dd>
            </div>
          </dl>
          <div className="dashboard-receipt__actions">
            <Link href={`/receipts/${savedReceipt.receiptId}`}>
              Open public receipt <span aria-hidden="true">↗</span>
            </Link>
            <RemoveReceiptControl receiptId={savedReceipt.receiptId} />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function clusterLabel(cluster: string): string {
  return cluster === "mainnet-beta" ? "Mainnet Beta" : titleCase(cluster);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shorten(value: string, start: number, end: number): string {
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function formatSavedDate(value: string): string {
  return `${new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))} UTC`;
}
