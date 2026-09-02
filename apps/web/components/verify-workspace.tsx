"use client";

import { useGSAP } from "@gsap/react";
import type {
  LogEventCandidate,
  TransactionInspection,
  VerificationResult,
} from "@eventseal/sdk";
import gsap from "gsap";
import { type FormEvent, useRef, useState } from "react";

import { requestInspection } from "../lib/inspection-api";
import type { BrowserInspectTransactionInput } from "../lib/inspection-request";
import { requestVerification } from "../lib/verification-api";
import type { BrowserVerifyEventInput } from "../lib/verification-request";
import {
  emptyVerificationRequest,
  exampleRequest,
  inspectionMatchesRequest,
  normalizeInspectionRequest,
  normalizeRequest,
  resultMatchesRequest,
  validateInspectionWorkspaceRequest,
  validateWorkspaceRequest,
  type RequestField,
} from "../lib/verification-workspace";
import { TransactionInspectionView } from "./transaction-inspection";
import { VerificationReceipt } from "./verification-receipt";

gsap.registerPlugin(useGSAP);

type LoadingPhase = "inspection" | "verification";

export function VerifyWorkspace({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const [request, setRequest] = useState(emptyVerificationRequest);
  const [inspection, setInspection] = useState<{
    request: BrowserInspectTransactionInput;
    result: TransactionInspection;
  }>();
  const [verification, setVerification] = useState<{
    request: BrowserVerifyEventInput;
    result: VerificationResult;
  }>();
  const [error, setError] = useState<{
    phase: LoadingPhase;
    message: string;
  }>();
  const [loading, setLoading] = useState<LoadingPhase>();
  const [touched, setTouched] = useState<
    Partial<Record<RequestField, boolean>>
  >({});
  const [selectedCandidate, setSelectedCandidate] = useState<number>();
  const [example, setExample] = useState<"success" | "failure">();
  const verificationErrors = validateWorkspaceRequest(request);
  const inspectionErrors = validateInspectionWorkspaceRequest(request);
  const busy = loading !== undefined;

  function clearOutcomes() {
    setInspection(undefined);
    setVerification(undefined);
    setSelectedCandidate(undefined);
    setError(undefined);
  }

  function updateIdentity(
    changes: Partial<Pick<BrowserVerifyEventInput, "signature" | "cluster">>,
  ) {
    if (submitting.current) return;
    setRequest((current) => ({ ...current, ...changes }));
    clearOutcomes();
    setExample(undefined);
  }

  function updateVerificationFields(nextRequest: BrowserVerifyEventInput) {
    if (submitting.current) return;
    setRequest(nextRequest);
    setSelectedCandidate(undefined);
    setVerification(undefined);
    setError(undefined);
    setExample(undefined);
  }

  function loadExample(kind: "success" | "failure") {
    if (submitting.current) return;
    setRequest(exampleRequest(kind));
    clearOutcomes();
    setTouched({});
    setExample(kind);
  }

  function chooseCandidate(candidate: LogEventCandidate) {
    if (submitting.current) return;
    setSelectedCandidate(candidate.eventPosition);
    setRequest((current) => ({
      ...current,
      expectedProgramId: candidate.emitterProgramId,
      event: { ...current.event, discriminator: candidate.discriminator },
    }));
    setTouched((current) => ({
      ...current,
      expectedProgramId: false,
      discriminator: false,
    }));
    setVerification(undefined);
    setError(undefined);
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
      if (!inspection && !verification && !error) return;
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
    {
      dependencies: [inspection, verification, error],
      scope: root,
      revertOnUpdate: true,
    },
  );

  async function submitInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setTouched((current) => ({ ...current, signature: true }));
    if (inspectionErrors.signature) {
      root.current?.querySelector<HTMLInputElement>("#signature")?.focus();
      return;
    }

    const submittedRequest = normalizeInspectionRequest(request);
    submitting.current = true;
    setRequest((current) => ({
      ...current,
      signature: submittedRequest.signature,
      cluster: submittedRequest.cluster,
    }));
    setLoading("inspection");
    setError(undefined);
    setInspection(undefined);
    setVerification(undefined);
    setSelectedCandidate(undefined);
    try {
      const result = await requestInspection(submittedRequest);
      if (!inspectionMatchesRequest(result, submittedRequest)) {
        throw new Error(
          "The inspection response did not match this request. Please retry.",
        );
      }
      setInspection({ request: submittedRequest, result });
      const firstCandidate = result.candidates[0];
      if (firstCandidate) {
        setSelectedCandidate(firstCandidate.eventPosition);
        setRequest((current) => ({
          ...current,
          expectedProgramId: firstCandidate.emitterProgramId,
          event: {
            ...current.event,
            discriminator: firstCandidate.discriminator,
          },
        }));
      }
    } catch (caught) {
      setError({
        phase: "inspection",
        message:
          caught instanceof Error
            ? caught.message
            : "Inspection failed. Please retry.",
      });
    } finally {
      submitting.current = false;
      setLoading(undefined);
    }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !inspection) return;
    setTouched((current) => ({
      ...current,
      expectedProgramId: true,
      discriminator: true,
    }));
    const firstError = (["expectedProgramId", "discriminator"] as const).find(
      (field) => verificationErrors[field],
    );
    if (firstError) {
      const details = root.current?.querySelector<HTMLDetailsElement>(
        ".advanced-verification",
      );
      if (details) details.open = true;
      root.current?.querySelector<HTMLInputElement>(`#${firstError}`)?.focus();
      return;
    }

    const submittedRequest = normalizeRequest(request);
    submitting.current = true;
    setRequest(submittedRequest);
    setLoading("verification");
    setError(undefined);
    setVerification(undefined);
    try {
      const result = await requestVerification(submittedRequest);
      if (!resultMatchesRequest(result, submittedRequest)) {
        throw new Error(
          "The verification response did not match this request. Please retry.",
        );
      }
      setVerification({ request: submittedRequest, result });
    } catch (caught) {
      setError({
        phase: "verification",
        message:
          caught instanceof Error
            ? caught.message
            : "Verification failed. Please retry.",
      });
    } finally {
      submitting.current = false;
      setLoading(undefined);
    }
  }

  function fieldFeedback(field: RequestField, hint: string) {
    const message =
      field === "signature"
        ? inspectionErrors.signature
        : verificationErrors[field];
    return (
      <small
        id={`${field}-hint`}
        className={touched[field] && message ? "field-error" : undefined}
      >
        {touched[field] && message ? message : hint}
      </small>
    );
  }

  return (
    <main ref={root} className="verify-page">
      <header className="verify-intro" data-reveal>
        <div>
          <h1>Inspect a Solana transaction.</h1>
          <p>See what happened first. Verify an event only when one exists.</p>
        </div>
        <p className="verify-scope">Finalized evidence · Anchor logs</p>
      </header>
      <div className="verify-grid">
        <section
          className="request-panel"
          aria-labelledby="request-heading"
          data-reveal
        >
          <div className="panel-heading">
            <h2 id="request-heading">Transaction request</h2>
            <p>A signature and its network are enough to begin.</p>
          </div>
          <div className="example-actions" aria-label="Load a devnet example">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              aria-pressed={example === "success"}
              onClick={() => loadExample("success")}
            >
              Successful event
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              aria-pressed={example === "failure"}
              onClick={() => loadExample("failure")}
            >
              Failed transaction
            </button>
          </div>
          <form
            className="inspection-form"
            onSubmit={(event) => void submitInspection(event)}
            aria-busy={loading === "inspection"}
            noValidate
          >
            <label htmlFor="signature" className="field-wide">
              <span id="signature-label">Transaction signature</span>
              <input
                id="signature"
                name="signature"
                required
                disabled={busy}
                maxLength={128}
                autoComplete="off"
                spellCheck={false}
                value={request.signature}
                onBlur={() =>
                  setTouched((current) => ({ ...current, signature: true }))
                }
                aria-invalid={Boolean(
                  touched.signature && inspectionErrors.signature,
                )}
                aria-describedby="signature-hint"
                aria-labelledby="signature-label"
                onChange={(event) =>
                  updateIdentity({ signature: event.target.value })
                }
                placeholder="Paste the complete transaction signature"
              />
              {fieldFeedback(
                "signature",
                "Copy the signature from your wallet or Solana Explorer.",
              )}
            </label>
            <label htmlFor="cluster" className="field-wide">
              <span id="cluster-label">Solana network</span>
              <select
                id="cluster"
                disabled={busy}
                value={request.cluster}
                onChange={(event) =>
                  updateIdentity({
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
              <small id="cluster-hint">
                Select the network where the transaction was submitted.
              </small>
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              {loading === "inspection"
                ? "Inspecting transaction…"
                : "Inspect transaction"}
            </button>
          </form>

          {example && (
            <p className="example-note" role="status">
              Loaded a real devnet {example === "success" ? "event" : "failure"}
              . Inspect it live; no result is cached in the page.
            </p>
          )}

          {inspection && (
            <section
              className="verification-step"
              aria-labelledby="verification-step-heading"
            >
              <div className="step-marker" aria-hidden="true">
                2
              </div>
              <div className="panel-heading">
                <h2 id="verification-step-heading">Verify an event</h2>
                <p>
                  Optional. Candidate values are discovered from untrusted logs
                  and still require verification.
                </p>
              </div>
              <form
                className="verification-form"
                onSubmit={(event) => void submitVerification(event)}
                aria-busy={loading === "verification"}
                noValidate
              >
                {inspection.result.candidates.length > 0 && (
                  <fieldset className="candidate-picker">
                    <legend>Unverified log candidates</legend>
                    {inspection.result.candidates.map((candidate) => (
                      <label
                        className="candidate-option"
                        key={candidate.eventPosition}
                      >
                        <input
                          type="radio"
                          name="candidate"
                          checked={
                            selectedCandidate === candidate.eventPosition
                          }
                          disabled={busy}
                          onChange={() => chooseCandidate(candidate)}
                        />
                        <span>
                          <strong>
                            Candidate {candidate.eventPosition + 1}
                          </strong>
                          <code>{candidate.discriminator}</code>
                          <small>{candidate.emitterProgramId}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}

                <details
                  className="input-help advanced-verification"
                  open={inspection.result.candidates.length === 0}
                >
                  <summary>Advanced: enter trusted event identity</summary>
                  <p>
                    Confirm both values against the program’s trusted deployment
                    and IDL. Do not trust candidate bytes merely because they
                    appeared in transaction logs.
                  </p>
                  <div className="advanced-fields">
                    <label htmlFor="expectedProgramId" className="field-wide">
                      <span id="program-label">Expected program ID</span>
                      <input
                        id="expectedProgramId"
                        name="expectedProgramId"
                        required
                        disabled={busy}
                        maxLength={64}
                        autoComplete="off"
                        spellCheck={false}
                        value={request.expectedProgramId}
                        onBlur={() =>
                          setTouched((current) => ({
                            ...current,
                            expectedProgramId: true,
                          }))
                        }
                        aria-invalid={Boolean(
                          touched.expectedProgramId &&
                          verificationErrors.expectedProgramId,
                        )}
                        aria-describedby="expectedProgramId-hint"
                        aria-labelledby="program-label"
                        onChange={(event) =>
                          updateVerificationFields({
                            ...request,
                            expectedProgramId: event.target.value,
                          })
                        }
                        placeholder="Paste the trusted program address"
                      />
                      {fieldFeedback(
                        "expectedProgramId",
                        "Use the trusted deployment address of the expected emitter.",
                      )}
                    </label>
                    <label htmlFor="discriminator" className="field-wide">
                      <span id="discriminator-label">Event discriminator</span>
                      <input
                        id="discriminator"
                        name="discriminator"
                        required
                        disabled={busy}
                        maxLength={32}
                        autoComplete="off"
                        spellCheck={false}
                        value={request.event.discriminator}
                        onBlur={() =>
                          setTouched((current) => ({
                            ...current,
                            discriminator: true,
                          }))
                        }
                        aria-invalid={Boolean(
                          touched.discriminator &&
                          verificationErrors.discriminator,
                        )}
                        aria-describedby="discriminator-hint"
                        aria-labelledby="discriminator-label"
                        onChange={(event) =>
                          updateVerificationFields({
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
                        "Eight trusted bytes from the event IDL, in hex.",
                      )}
                    </label>
                  </div>
                </details>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={busy}
                >
                  {loading === "verification"
                    ? "Verifying event…"
                    : selectedCandidate !== undefined
                      ? "Verify selected candidate"
                      : "Verify event identity"}
                </button>
                <p className="verification-boundary">
                  Only this step can produce a verdict and receipt.
                </p>
              </form>
            </section>
          )}

          <details className="input-help">
            <summary>What can this inspector find?</summary>
            <p>
              It reports transaction finality, execution status, programs
              observed in complete logs, and possible Anchor log-event bytes.
              Candidate bytes are discovery only—not proof of event identity.
            </p>
            <p>
              Native transfers, protocol-specific formats, and Anchor CPI events
              may have no supported candidate. You can still inspect the
              transaction without reaching a compulsory event field.
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
            <h2 id="evidence-heading">
              {verification ? "Verification receipt" : "Inspection evidence"}
            </h2>
            <p>
              {verification
                ? "Trusted checks with an explicit verdict."
                : "Transaction facts first. No assumed event."}
            </p>
          </div>
          <div
            ref={feedback}
            className="feedback-region"
            tabIndex={-1}
            aria-label="Transaction feedback"
          >
            {loading ? (
              <div className="empty-state" role="status">
                <div className="progress-mark" aria-hidden="true" />
                <h3>
                  {loading === "inspection"
                    ? "Inspecting transaction evidence."
                    : "Verifying the selected event."}
                </h3>
                <p>
                  {loading === "inspection"
                    ? "Checking finality, execution, and complete program logs. No verdict yet."
                    : "Checking the expected program and discriminator against finalized evidence."}
                </p>
              </div>
            ) : error ? (
              <div className="error-state" role="alert">
                <strong>
                  {error.phase === "inspection"
                    ? "Inspection request failed"
                    : "Verification request failed"}
                </strong>
                <p>{error.message}</p>
                <p>
                  No new verdict or receipt was established. Your inputs are
                  preserved so you can retry.
                </p>
              </div>
            ) : verification ? (
              <VerificationReceipt
                result={verification.result}
                request={verification.request}
                signedIn={signedIn}
              />
            ) : inspection ? (
              <TransactionInspectionView result={inspection.result} />
            ) : (
              <div className="empty-state">
                <div className="receipt-icon" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <h3>Start with a transaction signature.</h3>
                <p>
                  We’ll show its finalized status, execution outcome, observed
                  programs, and any unverified event candidates.
                </p>
                <p className="empty-state__note">
                  Inspection is useful even when no supported event exists.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
