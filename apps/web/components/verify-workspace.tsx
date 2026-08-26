"use client";

import { useGSAP } from "@gsap/react";
import type { VerificationResult } from "@eventseal/sdk";
import gsap from "gsap";
import { type FormEvent, useRef, useState } from "react";

import { requestVerification } from "../lib/verification-api";
import type { BrowserVerifyEventInput } from "../lib/verification-request";

gsap.registerPlugin(useGSAP);

const emptyRequest: BrowserVerifyEventInput = {
  signature: "",
  cluster: "devnet",
  expectedProgramId: "",
  event: { format: "anchor-log", discriminator: "" },
  commitment: "finalized",
};

export function VerifyWorkspace() {
  const root = useRef<HTMLElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const [request, setRequest] = useState(emptyRequest);
  const [result, setResult] = useState<VerificationResult>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  function updateRequest(nextRequest: BrowserVerifyEventInput) {
    setRequest(nextRequest);
    setResult(undefined);
    setError(undefined);
  }

  useGSAP(
    () => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reducedMotion) {
        gsap.set("[data-reveal]", { clearProps: "all" });
        return;
      }
      gsap.from("[data-reveal]", {
        autoAlpha: 0,
        y: 18,
        duration: 0.48,
        stagger: 0.07,
        ease: "power2.out",
      });
    },
    { scope: root },
  );

  useGSAP(
    () => {
      if (!feedback.current) return;
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      gsap.fromTo(
        feedback.current,
        { autoAlpha: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 12 },
        { autoAlpha: 1, y: 0, duration: reducedMotion ? 0 : 0.34 },
      );
    },
    { dependencies: [result, error], scope: root },
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    setResult(undefined);

    try {
      setResult(await requestVerification(request));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Verification failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main ref={root} className="verify-page">
      <section className="verify-grid" aria-label="Solana event verifier">
        <header className="verify-intro" data-reveal>
          <div>
            <h1>Verify Solana events before your app acts.</h1>
            <p>
              Inspect finalized transaction evidence before your backend
              releases funds, issues access, or changes state.
            </p>
          </div>
        </header>

        <section className="request-panel" data-reveal>
          <div className="panel-heading">
            <h2>Verification request</h2>
            <p>Finalized Anchor log evidence only.</p>
          </div>

          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            aria-busy={loading}
          >
            <label>
              <span>Transaction signature</span>
              <input
                required
                disabled={loading}
                maxLength={128}
                autoComplete="off"
                spellCheck={false}
                value={request.signature}
                onChange={(event) =>
                  updateRequest({
                    ...request,
                    signature: event.target.value,
                  })
                }
                placeholder="Enter transaction signature"
              />
              <small>The transaction that may contain the event.</small>
            </label>

            <label>
              <span>Cluster</span>
              <select
                disabled={loading}
                value={request.cluster}
                onChange={(event) =>
                  updateRequest({
                    ...request,
                    cluster: event.target
                      .value as BrowserVerifyEventInput["cluster"],
                  })
                }
              >
                <option value="devnet">Devnet</option>
                <option value="mainnet-beta">Mainnet beta</option>
                <option value="testnet">Testnet</option>
              </select>
              <small>The cluster where the transaction was finalized.</small>
            </label>

            <label>
              <span>Expected program ID</span>
              <input
                required
                disabled={loading}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                value={request.expectedProgramId}
                onChange={(event) =>
                  updateRequest({
                    ...request,
                    expectedProgramId: event.target.value,
                  })
                }
                placeholder="Enter program ID"
              />
              <small>The program expected to have emitted the event.</small>
            </label>

            <label>
              <span>Event discriminator</span>
              <input
                required
                disabled={loading}
                minLength={16}
                maxLength={16}
                pattern="[0-9a-f]{16}"
                autoComplete="off"
                spellCheck={false}
                value={request.event.discriminator}
                onChange={(event) =>
                  updateRequest({
                    ...request,
                    event: {
                      ...request.event,
                      discriminator: event.target.value.trim().toLowerCase(),
                    },
                  })
                }
                placeholder="16 lowercase hex characters"
              />
              <small>The eight-byte Anchor event discriminator.</small>
            </label>

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Inspecting evidence" : "Verify event"}
            </button>
          </form>
        </section>

        <section className="evidence-panel" data-reveal aria-live="polite">
          <div className="panel-heading">
            <h2>Evidence receipt</h2>
            <p>Finalized evidence. Explicit verdicts.</p>
          </div>

          <div ref={feedback} className="feedback-region">
            {!result && !error && (
              <div className="empty-state">
                <div className="receipt-icon" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <h3>Waiting for a transaction to inspect.</h3>
                <p>Submit a verification request to review its evidence.</p>
              </div>
            )}

            {error && (
              <div className="error-state" role="alert">
                <strong>Verification request failed</strong>
                <p>{error}</p>
              </div>
            )}

            {result && <VerificationReceipt result={result} />}
          </div>
        </section>
      </section>
    </main>
  );
}

function VerificationReceipt({ result }: { result: VerificationResult }) {
  return (
    <article className={`receipt receipt--${result.verdict}`}>
      <p className="verdict">{result.verdict}</p>
      <h3>{result.reasonCode}</h3>
      <p className="receipt__reason">{result.reason}</p>

      <dl className="receipt__identity">
        <div>
          <dt>Slot</dt>
          <dd>{result.slot ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt>Receipt</dt>
          <dd>{result.receiptId ?? "Not issued"}</dd>
        </div>
      </dl>

      <ul className="evidence-list" aria-label="Verification evidence">
        {result.evidence.map((item, index) => (
          <li key={`${item.check}-${index}`}>
            <span
              className={`evidence-list__status evidence-list__status--${
                item.passed ? "passed" : "failed"
              }`}
            >
              {item.passed ? "Passed" : "Failed"}
            </span>
            <div>
              <strong>{item.check}</strong>
              <p>{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
