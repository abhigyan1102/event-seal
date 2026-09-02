import type { TransactionInspection } from "@eventseal/sdk";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TransactionInspectionView } from "./transaction-inspection";

const result: TransactionInspection = {
  kind: "transaction-inspection",
  signature: "1".repeat(64),
  cluster: "devnet",
  finality: "finalized",
  execution: "succeeded",
  slot: 0,
  reasonCode: "CANDIDATES_FOUND",
  invokedPrograms: ["1".repeat(32)],
  logsStatus: "available",
  candidates: [
    {
      eventPosition: 0,
      emitterProgramId: "1".repeat(32),
      eventDataHash: "a".repeat(64),
      discriminator: "0102030405060708",
      dataBase64: "AQIDBAUGBwg=",
    },
  ],
};

describe("transaction inspection presentation", () => {
  it("labels discovered bytes as unverified and denies receipt semantics", () => {
    const html = renderToStaticMarkup(
      <TransactionInspectionView result={result} />,
    );
    expect(html).toContain("Candidate event data found");
    expect(html).toContain("Unverified log candidates");
    expect(html).toContain(result.candidates[0]!.discriminator);
    expect(html).toContain("Inspection has no verification verdict");
    expect(html).not.toContain("Save receipt");
  });

  it("distinguishes an inspected transaction with no supported event", () => {
    const html = renderToStaticMarkup(
      <TransactionInspectionView
        result={{
          ...result,
          reasonCode: "NO_SUPPORTED_LOG_EVENT",
          candidates: [],
        }}
      />,
    );
    expect(html).toContain("No supported event data found");
    expect(html).toContain("This is not a verification failure");
  });

  it("does not imply candidate absence when logs are unavailable", () => {
    const html = renderToStaticMarkup(
      <TransactionInspectionView
        result={{
          ...result,
          reasonCode: "LOGS_UNAVAILABLE",
          logsStatus: "unavailable",
          candidates: [],
          invokedPrograms: [],
        }}
      />,
    );
    expect(html).toContain("Candidates are not reported as reliable");
    expect(html).not.toContain("No supported Anchor log candidates were found");
  });
});
