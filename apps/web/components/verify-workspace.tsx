"use client";

import { useGSAP } from "@gsap/react";
import type { VerificationResult } from "@eventseal/sdk";
import gsap from "gsap";
import { type FormEvent, useRef, useState } from "react";

import { requestVerification } from "../lib/verification-api";
import type { BrowserVerifyEventInput } from "../lib/verification-request";
import {
  emptyVerificationRequest,
  exampleRequest,
  normalizeRequest,
  resultMatchesRequest,
  validateWorkspaceRequest,
  type RequestField,
} from "../lib/verification-workspace";
import { VerificationReceipt } from "./verification-receipt";

gsap.registerPlugin(useGSAP);

export function VerifyWorkspace({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const [request, setRequest] = useState(emptyVerificationRequest);
  const [completed, setCompleted] = useState<{
    request: BrowserVerifyEventInput;
    result: VerificationResult;
  }>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<
    Partial<Record<RequestField, boolean>>
  >({});
  const [example, setExample] = useState<"success" | "failure">();
  const errors = validateWorkspaceRequest(request);

  function updateRequest(nextRequest: BrowserVerifyEventInput) {
    if (submitting.current) return;
    setRequest(nextRequest);
    setCompleted(undefined);
    setError(undefined);
    setExample(undefined);
  }

  function loadExample(kind: "success" | "failure") {
    if (submitting.current) return;
    updateRequest(exampleRequest(kind));
    setTouched({});
    setExample(kind);
  }

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-reveal]", {
          opacity: 0,
          y: 8,
          duration: 0.3,
          stagger: 0.04,
          clearProps: "opacity,transform",
        });
      });
      return () => media.revert();
    },
    { scope: root },
  );

  useGSAP(
    () => {
      if (!completed && !error) return;
      feedback.current?.focus({ preventScroll: true });
      feedback.current?.scrollIntoView({ block: "start", behavior: "instant" });
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          feedback.current,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.2, clearProps: "opacity,transform" },
        );
      });
      return () => media.revert();
    },
    { dependencies: [completed, error], scope: root, revertOnUpdate: true },
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setTouched({
      signature: true,
      expectedProgramId: true,
      discriminator: true,
    });
    const firstError = (Object.keys(errors) as RequestField[])[0];
    if (firstError) {
      root.current?.querySelector<HTMLInputElement>(`#${firstError}`)?.focus();
      return;
    }
    const submittedRequest = normalizeRequest(request);
    submitting.current = true;
    setRequest(submittedRequest);
    setLoading(true);
    setError(undefined);
    setCompleted(undefined);
    try {
      const result = await requestVerification(submittedRequest);
      if (!resultMatchesRequest(result, submittedRequest))
        throw new Error(
          "The response did not match this request. Please retry.",
        );
      setCompleted({ request: submittedRequest, result });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Verification failed. Please retry.",
      );
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  function fieldFeedback(field: RequestField, hint: string) {
    return (
      <small
        id={`${field}-hint`}
        className={touched[field] && errors[field] ? "field-error" : undefined}
      >
        {touched[field] && errors[field] ? errors[field] : hint}
      </small>
    );
  }

  return (
    <main ref={root} className="verify-page">
      <header className="verify-intro" data-reveal>
        <div>
          <h1>Verify a Solana event.</h1>
          <p>Check finalized evidence before your app acts.</p>
        </div>
        <p className="verify-scope">Anchor logs only · Accounts optional</p>
      </header>
      <div className="verify-grid">
        <section
          className="request-panel"
          aria-labelledby="request-heading"
          data-reveal
        >
          <div className="panel-heading">
            <h2 id="request-heading">Verification request</h2>
            <p>Try a real devnet transaction, or enter your own.</p>
          </div>
          <div className="example-actions" aria-label="Load a devnet example">
            <button
              type="button"
              className="secondary-button"
              disabled={loading}
              aria-pressed={example === "success"}
              onClick={() => loadExample("success")}
            >
              Successful event
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={loading}
              aria-pressed={example === "failure"}
              onClick={() => loadExample("failure")}
            >
              Failed transaction
            </button>
          </div>
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            aria-busy={loading}
            noValidate
          >
            <label htmlFor="signature" className="field-wide">
              <span id="signature-label">Transaction signature</span>
              <input
                id="signature"
                name="signature"
                required
                disabled={loading}
                maxLength={128}
                autoComplete="off"
                spellCheck={false}
                value={request.signature}
                onBlur={() => setTouched({ ...touched, signature: true })}
                aria-invalid={Boolean(touched.signature && errors.signature)}
                aria-describedby="signature-hint"
                aria-labelledby="signature-label"
                onChange={(event) =>
                  updateRequest({ ...request, signature: event.target.value })
                }
                placeholder="Paste the complete transaction signature"
              />
              {fieldFeedback(
                "signature",
                "Copy the signature from your wallet or Solana Explorer.",
              )}
            </label>
            <label htmlFor="expectedProgramId" className="field-wide">
              <span id="program-label">Expected program ID</span>
              <input
                id="expectedProgramId"
                name="expectedProgramId"
                required
                disabled={loading}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                value={request.expectedProgramId}
                onBlur={() =>
                  setTouched({ ...touched, expectedProgramId: true })
                }
                aria-invalid={Boolean(
                  touched.expectedProgramId && errors.expectedProgramId,
                )}
                aria-describedby="expectedProgramId-hint"
                aria-labelledby="program-label"
                onChange={(event) =>
                  updateRequest({
                    ...request,
                    expectedProgramId: event.target.value,
                  })
                }
                placeholder="Paste the emitting program’s address"
              />
              {fieldFeedback(
                "expectedProgramId",
                "Use the trusted deployment address of the expected emitter.",
              )}
            </label>
            <label htmlFor="cluster">
              <span id="cluster-label">Cluster</span>
              <select
                id="cluster"
                disabled={loading}
                value={request.cluster}
                onChange={(event) =>
                  updateRequest({
                    ...request,
                    cluster: event.target
                      .value as BrowserVerifyEventInput["cluster"],
                  })
                }
                aria-describedby="cluster-hint"
                aria-labelledby="cluster-label"
              >
                <option value="devnet">Devnet</option>
                <option value="mainnet-beta">Mainnet beta</option>
                <option value="testnet">Testnet</option>
              </select>
              <small id="cluster-hint">The transaction’s network.</small>
            </label>
            <label htmlFor="discriminator">
              <span id="discriminator-label">Event discriminator</span>
              <input
                id="discriminator"
                name="discriminator"
                required
                disabled={loading}
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
                value={request.event.discriminator}
                onBlur={() => setTouched({ ...touched, discriminator: true })}
                aria-invalid={Boolean(
                  touched.discriminator && errors.discriminator,
                )}
                aria-describedby="discriminator-hint"
                aria-labelledby="discriminator-label"
                onChange={(event) =>
                  updateRequest({
                    ...request,
                    event: {
                      ...request.event,
                      discriminator: event.target.value,
                    },
                  })
                }
                placeholder="e.g. bf91ff47ac4cb187"
              />
              {fieldFeedback(
                "discriminator",
                "Eight bytes from the event IDL, in hex.",
              )}
            </label>
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Inspecting evidence…" : "Verify event"}
            </button>
          </form>
          {example && (
            <p className="example-note" role="status">
              {example === "success"
                ? "Expected: verified event."
                : "Expected: rejected transaction, with no receipt."}{" "}
              Submit to check live evidence; this is not a cached result.
            </p>
          )}
          <details className="input-help">
            <summary>Where do I find these values?</summary>
            <p>
              <strong>Program ID:</strong> inspect the transaction’s
              instructions and program logs in Solana Explorer, then confirm the
              expected emitter against the program’s official deployment
              address. One transaction can invoke several programs. This is not
              your wallet address.
            </p>
            <p>
              <strong>Discriminator:</strong> use the event’s discriminator
              bytes from a trusted Anchor IDL, encoded as lowercase hexadecimal.
              For a default eight-byte Anchor discriminator, hash{" "}
              <code>event:ExactEventName</code> with SHA-256 and take the first
              eight bytes. Custom discriminators must come from the actual
              program definition.
            </p>
            <p>
              Not every transaction emits an Anchor event. Native transfers and
              CPI events are not supported by this log-only verifier.
            </p>
            <a
              className="text-link"
              href="https://www.anchor-lang.com/docs/features/events"
              target="_blank"
              rel="noreferrer"
            >
              Read Anchor’s event documentation ↗
            </a>
          </details>
        </section>
        <section
          className="evidence-panel"
          aria-labelledby="evidence-heading"
          data-reveal
        >
          <div className="panel-heading">
            <h2 id="evidence-heading">Evidence</h2>
            <p>Finalized transaction checks. Explicit verdicts.</p>
          </div>
          <div
            ref={feedback}
            className="feedback-region"
            tabIndex={-1}
            aria-label="Verification feedback"
          >
            {loading ? (
              <div className="empty-state" role="status">
                <div className="progress-mark" aria-hidden="true" />
                <h3>Inspecting transaction evidence.</h3>
                <p>
                  Checking the submitted transaction against your expected
                  program and event. No verdict yet.
                </p>
              </div>
            ) : error ? (
              <div className="error-state" role="alert">
                <strong>Verification request failed</strong>
                <p>{error}</p>
                <p>
                  No verdict was established. Your inputs are preserved; use
                  Verify event to retry.
                </p>
              </div>
            ) : completed ? (
              <VerificationReceipt
                result={completed.result}
                request={completed.request}
                signedIn={signedIn}
              />
            ) : (
              <div className="empty-state">
                <div className="receipt-icon" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <h3>Evidence starts with a transaction.</h3>
                <p>
                  Load an example or enter a transaction. We’ll show what was
                  checked and whether it is safe to trust the event.
                </p>
                <p className="empty-state__note">
                  Verified, rejected, or inconclusive—never an assumed success.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
