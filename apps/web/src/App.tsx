import { type FormEvent, useState } from "react";
import type { VerificationResult, VerifyEventInput } from "@eventseal/sdk";

import { requestVerification } from "./api";

const emptyRequest: VerifyEventInput = {
  signature: "",
  cluster: "devnet",
  expectedProgramId: "",
  event: { format: "anchor-log", discriminator: "" },
  commitment: "finalized",
};

export function App() {
  const [request, setRequest] = useState(emptyRequest);
  const [result, setResult] = useState<VerificationResult>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

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
    <main>
      <header className="masthead">
        <a className="brand" href="/" aria-label="EventSeal home">
          <span className="mark">ES</span>
          EventSeal
        </a>
        <a href="https://github.com/abhigyan1102/event-seal">GitHub ↗</a>
      </header>

      <section className="hero">
        <p className="eyebrow">Solana event verification</p>
        <h1>Trust the execution, not just the log.</h1>
        <p className="lede">
          Verify finality, transaction success, event discriminator, and the
          active program frame before an off-chain system releases funds or
          changes state.
        </p>
      </section>

      <section className="workspace" aria-label="Verification playground">
        <form
          onSubmit={(e) => {
            void submit(e);
          }}
        >
          <div className="section-heading">
            <span>01</span>
            <div>
              <h2>Verification request</h2>
              <p>
                Use a finalized transaction signature and the expected Anchor
                event identity.
              </p>
            </div>
          </div>

          <label>
            Transaction signature
            <input
              required
              value={request.signature}
              onChange={(event) =>
                setRequest({ ...request, signature: event.target.value.trim() })
              }
              placeholder="5UfDuX…"
            />
          </label>

          <div className="field-grid">
            <label>
              Cluster
              <select
                value={request.cluster}
                onChange={(event) =>
                  setRequest({
                    ...request,
                    cluster: event.target.value as VerifyEventInput["cluster"],
                  })
                }
              >
                <option value="devnet">Devnet</option>
                <option value="mainnet-beta">Mainnet beta</option>
                <option value="testnet">Testnet</option>
              </select>
            </label>
            <label>
              Event format
              <select
                value={request.event.format}
                onChange={(event) =>
                  setRequest({
                    ...request,
                    event: {
                      ...request.event,
                      format: event.target
                        .value as VerifyEventInput["event"]["format"],
                    },
                  })
                }
              >
                <option value="anchor-log">Anchor log</option>
                <option value="anchor-cpi">Anchor CPI</option>
              </select>
            </label>
          </div>

          <label>
            Expected program ID
            <input
              required
              value={request.expectedProgramId}
              onChange={(event) =>
                setRequest({
                  ...request,
                  expectedProgramId: event.target.value.trim(),
                })
              }
              placeholder="Fg6PaFpo…"
            />
          </label>

          <label>
            Event discriminator
            <input
              required
              minLength={16}
              maxLength={16}
              pattern="[0-9a-f]{16}"
              value={request.event.discriminator}
              onChange={(event) =>
                setRequest({
                  ...request,
                  event: {
                    ...request.event,
                    discriminator: event.target.value.trim().toLowerCase(),
                  },
                })
              }
              placeholder="8-byte lowercase hex"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Inspecting evidence…" : "Verify event"}
          </button>
        </form>

        <aside className="result-panel">
          <div className="section-heading">
            <span>02</span>
            <div>
              <h2>Evidence receipt</h2>
              <p>Every verdict is explicit and machine-readable.</p>
            </div>
          </div>

          {!result && !error && (
            <div className="empty-state">
              <div className="pulse" />
              <p>Waiting for a transaction to inspect.</p>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          {result && (
            <div className={`receipt ${result.verdict}`}>
              <p className="verdict">{result.verdict}</p>
              <h3>{result.reasonCode}</h3>
              <p>{result.reason}</p>
              <dl>
                <div>
                  <dt>Slot</dt>
                  <dd>{result.slot ?? "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Receipt</dt>
                  <dd>{result.receiptId ?? "Not issued"}</dd>
                </div>
              </dl>
              <ul>
                {result.evidence.map((item) => (
                  <li key={item.check}>
                    <span>{item.passed ? "✓" : "×"}</span>
                    <div>
                      <strong>{item.check}</strong>
                      <small>{item.detail}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
