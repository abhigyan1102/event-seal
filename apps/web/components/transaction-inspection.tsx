import type { TransactionInspection } from "@eventseal/sdk";

import {
  clusterLabels,
  inspectionReasonCopy,
  transactionUrl,
} from "../lib/verification-workspace";

export function TransactionInspectionView({
  result,
}: {
  result: TransactionInspection;
}) {
  const copy = inspectionReasonCopy[result.reasonCode];
  const canDiscover =
    result.logsStatus === "available" && result.execution === "succeeded";

  return (
    <article className="inspection" aria-label="Transaction inspection">
      <p className="inspection__eyebrow">Transaction inspection</p>
      <h3>{copy.title}</h3>
      <p className="inspection__guidance">{copy.guidance}</p>
      <dl className="inspection__status">
        <div>
          <dt>Network</dt>
          <dd>{clusterLabels[result.cluster]}</dd>
        </div>
        <div>
          <dt>Finality</dt>
          <dd>{sentenceCase(result.finality)}</dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>{sentenceCase(result.execution)}</dd>
        </div>
        <div>
          <dt>Logs</dt>
          <dd>{sentenceCase(result.logsStatus)}</dd>
        </div>
        {result.slot !== undefined && (
          <div>
            <dt>Slot</dt>
            <dd>{result.slot.toLocaleString("en-US")}</dd>
          </div>
        )}
      </dl>

      <section className="inspection__section" aria-labelledby="programs-title">
        <div className="inspection__section-heading">
          <h4 id="programs-title">Programs observed in logs</h4>
          <span>{result.invokedPrograms.length}</span>
        </div>
        {result.invokedPrograms.length ? (
          <ol className="program-list">
            {result.invokedPrograms.map((program) => (
              <li key={program}>
                <code>{program}</code>
              </li>
            ))}
          </ol>
        ) : (
          <p className="inspection__empty">
            {result.logsStatus === "available"
              ? "No program invocation frames were found in the returned logs."
              : "Program observations are unavailable without complete logs."}
          </p>
        )}
      </section>

      <section
        className="inspection__section"
        aria-labelledby="candidates-title"
      >
        <div className="inspection__section-heading">
          <h4 id="candidates-title">Unverified log candidates</h4>
          <span>{result.candidates.length}</span>
        </div>
        {result.candidates.length ? (
          <ol className="candidate-summary-list">
            {result.candidates.map((candidate) => (
              <li key={candidate.eventPosition}>
                <span>Candidate {candidate.eventPosition + 1}</span>
                <code>{candidate.discriminator}</code>
                <small>{candidate.emitterProgramId}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p className="inspection__empty">
            {canDiscover
              ? "No supported Anchor log candidates were found."
              : "Candidates are not reported as reliable from this evidence."}
          </p>
        )}
      </section>

      <a
        className="transaction-link"
        href={transactionUrl(result.signature, result.cluster)}
        target="_blank"
        rel="noreferrer"
      >
        Open transaction in Solana Explorer ↗
      </a>
      <p className="inspection__boundary">
        Inspection has no verification verdict and issues no receipt.
      </p>
    </article>
  );
}

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
