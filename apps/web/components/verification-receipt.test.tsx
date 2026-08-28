import type {
  VerificationReasonCode,
  VerificationResult,
} from "@eventseal/sdk";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  exampleRequest,
  reasonGuidance,
  verdictTitles,
} from "../lib/verification-workspace";
import { VerificationReceipt } from "./verification-receipt";

vi.mock("./save-receipt-button", () => ({
  SaveReceiptButton: ({ receiptId }: { receiptId: string }) => (
    <button data-receipt={receiptId}>Save receipt</button>
  ),
}));

const request = exampleRequest("success");
const base: VerificationResult = {
  signature: request.signature,
  cluster: request.cluster,
  expectedProgramId: request.expectedProgramId,
  commitment: "finalized",
  verdict: "verified",
  reasonCode: "VERIFIED",
  reason: "Evidence matched.",
  evidence: [{ check: "execution", passed: true, detail: "meta.err is null." }],
};
const render = (result: VerificationResult, signedIn = false) =>
  renderToStaticMarkup(
    <VerificationReceipt
      result={result}
      request={request}
      signedIn={signedIn}
    />,
  );

describe("verification result presentation", () => {
  it.each(["verified", "rejected", "indeterminate"] as const)(
    "renders the %s verdict explicitly",
    (verdict) => {
      const html = render({ ...base, verdict });
      expect(html).toContain(verdictTitles[verdict]);
      expect(html).toContain(`receipt--${verdict}`);
    },
  );

  it.each(Object.keys(reasonGuidance) as VerificationReasonCode[])(
    "provides actionable guidance for %s",
    (reasonCode) => {
      const html = render({ ...base, reasonCode });
      expect(html).toContain(reasonCode);
      // React escapes apostrophes; render the text through the same renderer.
      expect(html).toContain(
        renderToStaticMarkup(
          <p className="receipt__guidance">{reasonGuidance[reasonCode]}</p>,
        ),
      );
    },
  );

  it("renders zero slots and event positions, full identity, and only returned checks", () => {
    const html = render({
      ...base,
      slot: 0,
      event: {
        eventPosition: 0,
        emitterProgramId: request.expectedProgramId,
        eventDataHash: "hash",
      },
    });
    expect(html).toContain("<dt>Slot</dt><dd>0</dd>");
    expect(html).toContain("<dt>Event position</dt><dd>0</dd>");
    expect(html).toContain(request.signature);
    expect(html).toContain(request.event.discriminator);
    expect(html).toContain("Transaction execution");
    expect(html).not.toContain("Transaction finality");
  });

  it("does not invent checks or offer saving/copying an unissued receipt", () => {
    const html = render(
      {
        ...base,
        verdict: "indeterminate",
        reasonCode: "RPC_UNAVAILABLE",
        evidence: [],
      },
      true,
    );
    expect(html).toContain("No individual checks were returned");
    expect(html).toContain("Not issued");
    expect(html).toContain("Copy result JSON");
    expect(html).not.toContain("Copy receipt ID");
    expect(html).not.toContain("Save receipt");
  });

  it("offers saving only to signed-in users with a receipt", () => {
    const result = { ...base, receiptId: `es_${"a".repeat(64)}` };
    expect(render(result, true)).toContain("Save receipt");
    expect(render(result)).not.toContain("Save receipt");
    expect(render(result)).toContain("Sign in with GitHub");
    expect(render(result)).toContain("Receipt evidence remains public");
  });

  it("escapes backend detail text and provides selectable JSON", () => {
    const html = render({
      ...base,
      reason: "<script>bad()</script>",
      evidence: [{ check: "__proto__", passed: false, detail: "<img src=x>" }],
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("Not passed");
    expect(html).toContain("<summary>Result JSON</summary>");
  });
});
