import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  LegacyPublicReceipt,
  PublicReceipt,
  PublicReceiptV2,
} from "../lib/public-receipt";
import { PublicReceiptView } from "./public-receipt-view";

vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    utils: { toArray: () => [] },
  },
}));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));
vi.mock("./save-receipt-button", () => ({
  SaveReceiptButton: ({ receiptId }: { receiptId: string }) => (
    <button type="button">Save {receiptId}</button>
  ),
}));

const receipt: PublicReceiptV2 = {
  receipt_version: 2,
  receipt_id: `es_${"a".repeat(64)}`,
  signature: "5UfDuXexampleSignature",
  cluster: "devnet",
  commitment: "finalized",
  slot: 100,
  verdict: "verified",
  reason_code: "VERIFIED",
  reason: "The expected program emitted this event.",
  expected_program_id: "EventSeal111111111111111111111111111111111",
  event_format: "anchor-log",
  event_discriminator: "0102030405060708",
  emitter_program_id: "EventSeal111111111111111111111111111111111",
  event_position: 0,
  event_data_hash: "b".repeat(64),
  evidence: [
    { check: "finality", passed: true, detail: "Transaction is finalized." },
    { check: "execution", passed: true, detail: "meta.err is null." },
  ],
  created_at: "2026-09-04T19:00:00.000Z",
};

function render(value: PublicReceipt = receipt, signedIn = false): string {
  return renderToStaticMarkup(
    <PublicReceiptView
      receipt={value}
      shareUrl={`https://eventseal.example/receipts/${value.receipt_id}`}
      signedIn={signedIn}
    />,
  );
}

describe("PublicReceiptView", () => {
  it.each([
    ["verified", "Event", "verified."],
    ["rejected", "Event", "rejected."],
    ["indeterminate", "Verification", "inconclusive."],
  ] as const)(
    "renders the %s verdict distinctly",
    (verdict, lead, emphasis) => {
      const html = render({ ...receipt, verdict });
      expect(html).toContain(lead);
      expect(html).toContain(emphasis);
      expect(html).toContain(`public-receipt--${verdict}`);
    },
  );

  it("renders the complete v2 identity and sanitized evidence", () => {
    const html = render();
    expect(html).toContain(receipt.receipt_id);
    expect(html).toContain(receipt.expected_program_id);
    expect(html).toContain(receipt.event_discriminator);
    expect(html).toContain(receipt.event_data_hash);
    expect(html).toContain("Transaction finality");
    expect(html).toContain("Transaction is finalized.");
    expect(html).toContain("Copy share link");
    expect(html).toContain("explorer.solana.com");
    expect(html).not.toContain("INSFORGE_API_KEY");
  });

  it("explains unavailable trusted identity on a legacy v1 receipt", () => {
    const legacyReceipt: LegacyPublicReceipt = {
      receipt_version: 1,
      receipt_id: receipt.receipt_id,
      signature: receipt.signature,
      cluster: receipt.cluster,
      commitment: null,
      slot: receipt.slot,
      verdict: receipt.verdict,
      reason_code: receipt.reason_code,
      reason: null,
      expected_program_id: null,
      event_format: null,
      event_discriminator: null,
      emitter_program_id: receipt.emitter_program_id,
      event_position: receipt.event_position,
      event_data_hash: receipt.event_data_hash,
      evidence: receipt.evidence,
      created_at: receipt.created_at,
    };

    const html = render(legacyReceipt);
    expect(html).toContain("Unavailable in legacy v1");
    expect(html).toContain("trusted request identity was not stored in v1");
  });

  it("offers saving only to signed-in users", () => {
    expect(render(receipt, false)).toContain("Sign in with GitHub to save");
    expect(render(receipt, true)).toContain(`Save ${receipt.receipt_id}`);
  });

  it("does not treat absent evidence as successful proof", () => {
    const html = render({ ...receipt, evidence: [] });
    expect(html).toContain("This does not establish a successful verification");
    expect(html).not.toContain('role="tab"');
  });
});
