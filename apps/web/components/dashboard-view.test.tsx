import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PublicReceiptV2 } from "../lib/public-receipt";
import { DashboardView } from "./dashboard-view";

vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("gsap", () => ({
  default: { registerPlugin: vi.fn() },
}));
vi.mock("./remove-receipt-control", () => ({
  RemoveReceiptControl: ({ receiptId }: { receiptId: string }) => (
    <button type="button">Remove {receiptId}</button>
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
  evidence: [{ check: "execution", passed: true, detail: "meta.err is null." }],
  created_at: "2026-09-04T19:00:00.000Z",
};

function render(value: PublicReceiptV2 = receipt, total = 1): string {
  return renderToStaticMarkup(
    <DashboardView
      filters={{ verdict: "all", cluster: "all", page: 1 }}
      receiptPage={{
        items:
          total === 0
            ? []
            : [
                {
                  receiptId: value.receipt_id,
                  savedAt: "2026-09-05T12:00:00.000Z",
                  receipt: value,
                },
              ],
        total,
        page: 1,
        pageSize: 8,
        totalPages: 1,
      }}
    />,
  );
}

describe("DashboardView", () => {
  it("renders only stored receipt identity and owner actions", () => {
    const html = render();
    expect(html).toContain("Your verification receipts.");
    expect(html).toContain("The expected program emitted this event.");
    expect(html).toContain(receipt.event_discriminator);
    expect(html).toContain("Devnet");
    expect(html).toContain(`Remove ${receipt.receipt_id}`);
    expect(html).not.toContain("Ethereum");
    expect(html).not.toContain("Polygon");
  });

  it("labels an indeterminate receipt as inconclusive", () => {
    const html = render({
      ...receipt,
      verdict: "indeterminate",
      reason_code: "RPC_UNAVAILABLE",
      reason: "The RPC evidence was unavailable.",
    });
    expect(html).toContain("Inconclusive");
    expect(html).toContain("RPC UNAVAILABLE");
  });

  it("renders a useful empty state without pretending a result exists", () => {
    const html = render(receipt, 0);
    expect(html).toContain("No receipts match this view.");
    expect(html).toContain("Clear filters");
    expect(html).not.toContain(receipt.event_discriminator);
  });
});
