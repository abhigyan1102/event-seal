"use client";

import { type FormEvent, useState } from "react";

import { requestArcSettlementVerification } from "../lib/arc-settlement-api";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_EXPLORER_URL,
  ARC_USDC_CONTRACT,
  validateArcSettlementRequest,
  type ArcSettlementRequest,
  type ArcSettlementResult,
} from "../lib/arc-settlement";

import styles from "./arc-settlement-verifier.module.css";

const LIVE_EXAMPLE: ArcSettlementRequest = {
  transactionHash:
    "0xedaf47800669bd77029f6a779a3c2824a84e2e46385d45d53091a226e65769f0",
  expectedSender: "0xe398777ab152fc44893415a731ceab226478f5ae",
  expectedRecipient: "0xbbc2a38ab48fa953ec68ee6115bd518d3a226f6e",
  expectedAmount: "8.388778",
};

const EMPTY_REQUEST: ArcSettlementRequest = {
  transactionHash: "",
  expectedSender: "",
  expectedRecipient: "",
  expectedAmount: "",
};

export function ArcSettlementVerifier() {
  const [request, setRequest] = useState(EMPTY_REQUEST);
  const [result, setResult] = useState<ArcSettlementResult>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  function update(field: keyof ArcSettlementRequest, value: string) {
    setRequest((current) => ({ ...current, [field]: value }));
    setResult(undefined);
    setError(undefined);
  }

  function loadExample() {
    setRequest(LIVE_EXAMPLE);
    setResult(undefined);
    setError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const validation = validateArcSettlementRequest(request);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    setError(undefined);
    setResult(undefined);
    try {
      setResult(await requestArcSettlementVerification(validation.value));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Arc settlement verification failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Arc Testnet · USDC settlement gate</p>
          <h1>Prove the payment before you release the value.</h1>
          <p className={styles.lede}>
            EventSeal reads the finalized Arc receipt, isolates Circle&apos;s
            canonical USDC transfer, and compares it with the sender, recipient,
            and amount your application expected.
          </p>
        </div>
        <dl className={styles.networkFacts} aria-label="Arc network facts">
          <div>
            <dt>Network</dt>
            <dd>Arc Testnet</dd>
          </div>
          <div>
            <dt>Chain ID</dt>
            <dd>{ARC_TESTNET_CHAIN_ID}</dd>
          </div>
          <div>
            <dt>Finality</dt>
            <dd>1 confirmation</dd>
          </div>
          <div>
            <dt>Gas</dt>
            <dd>USDC</dd>
          </div>
        </dl>
      </header>

      <section className={styles.workflow} aria-label="Settlement workflow">
        <div>
          <span>01</span>
          <strong>Set the expectation</strong>
          <p>Supply trusted payment terms from your order or policy.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Read live Arc evidence</strong>
          <p>The server fetches the receipt from Arc Testnet JSON-RPC.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Make one decision</strong>
          <p>Release only after one exact, successful USDC transfer.</p>
        </div>
      </section>

      <div className={styles.workspace}>
        <section
          className={styles.formPanel}
          aria-labelledby="arc-request-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionIndex}>Trusted request</p>
              <h2 id="arc-request-title">Expected settlement</h2>
            </div>
            <button
              className={styles.exampleButton}
              type="button"
              onClick={loadExample}
              disabled={loading}
            >
              Load live example
            </button>
          </div>

          <form onSubmit={(event) => void submit(event)}>
            <label>
              Arc transaction hash
              <input
                name="transactionHash"
                value={request.transactionHash}
                onChange={(event) =>
                  update("transactionHash", event.target.value)
                }
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                required
              />
              <small>32-byte transaction hash from Arc Testnet.</small>
            </label>

            <div className={styles.addressGrid}>
              <label>
                Expected sender
                <input
                  name="expectedSender"
                  value={request.expectedSender}
                  onChange={(event) =>
                    update("expectedSender", event.target.value)
                  }
                  placeholder="0x…"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </label>
              <label>
                Expected recipient
                <input
                  name="expectedRecipient"
                  value={request.expectedRecipient}
                  onChange={(event) =>
                    update("expectedRecipient", event.target.value)
                  }
                  placeholder="0x…"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </label>
            </div>

            <label className={styles.amountField}>
              Expected amount
              <span>
                <input
                  name="expectedAmount"
                  inputMode="decimal"
                  value={request.expectedAmount}
                  onChange={(event) =>
                    update("expectedAmount", event.target.value)
                  }
                  placeholder="25.00"
                  autoComplete="off"
                  required
                />
                <strong>USDC</strong>
              </span>
              <small>
                Compared as an integer using the Arc USDC interface&apos;s 6
                decimals.
              </small>
            </label>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button
              className={styles.verifyButton}
              type="submit"
              disabled={loading}
            >
              {loading ? "Reading Arc evidence…" : "Verify Arc settlement"}
            </button>
          </form>
        </section>

        <section
          className={styles.resultPanel}
          aria-labelledby="arc-decision-title"
          aria-live="polite"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionIndex}>Backend decision</p>
              <h2 id="arc-decision-title">Release gate</h2>
            </div>
            <span className={styles.rpcStatus}>Live JSON-RPC</span>
          </div>

          {result ? (
            <ResultView result={result} />
          ) : (
            <div className={styles.emptyResult}>
              <div aria-hidden="true" className={styles.emptyMark}>
                ES
              </div>
              <p>
                No decision yet. EventSeal returns <strong>release</strong> only
                after every trusted payment term matches one finalized transfer.
              </p>
              <code>{ARC_USDC_CONTRACT}</code>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ResultView({ result }: { result: ArcSettlementResult }) {
  const explorerUrl =
    ARC_TESTNET_EXPLORER_URL + "/tx/" + result.transactionHash;

  return (
    <div className={styles.result} data-verdict={result.verdict}>
      <div className={styles.decisionRow}>
        <div>
          <span>Decision</span>
          <strong>{result.decision}</strong>
        </div>
        <span className={styles.verdict}>{result.verdict}</span>
      </div>
      <p className={styles.reason}>{result.reason}</p>

      {result.transfer && (
        <dl className={styles.transferDetails}>
          <div>
            <dt>Amount</dt>
            <dd>{result.transfer.amount} USDC</dd>
          </div>
          <div>
            <dt>Arc block</dt>
            <dd>{result.transfer.blockNumber}</dd>
          </div>
          <div>
            <dt>Log index</dt>
            <dd>{result.transfer.logIndex}</dd>
          </div>
          <div>
            <dt>Receipt ID</dt>
            <dd title={result.receiptId}>{shorten(result.receiptId ?? "")}</dd>
          </div>
        </dl>
      )}

      <ol className={styles.evidenceList} aria-label="Verification evidence">
        {result.evidence.map((item) => (
          <li key={item.check} data-passed={item.passed}>
            <span aria-hidden="true">{item.passed ? "✓" : "×"}</span>
            <div>
              <strong>{item.check.replaceAll("-", " ")}</strong>
              <p>{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <a href={explorerUrl} target="_blank" rel="noreferrer">
        Open transaction on Arcscan <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

function shorten(value: string): string {
  if (value.length <= 24) return value;
  return value.slice(0, 14) + "…" + value.slice(-8);
}
