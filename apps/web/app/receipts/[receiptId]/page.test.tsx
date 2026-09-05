import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadPublicReceipt: vi.fn(),
  getCurrentUser: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("../../../lib/public-receipt", () => ({
  loadPublicReceipt: mocks.loadPublicReceipt,
}));
vi.mock("../../../lib/auth-server", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("../../../lib/auth-config", () => ({
  getAuthConfig: () => ({ appUrl: "https://eventseal.example" }),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("../../../components/public-receipt-view", () => ({
  PublicReceiptView: ({
    receipt,
    shareUrl,
    signedIn,
  }: {
    receipt: { receipt_id: string };
    shareUrl: string;
    signedIn: boolean;
  }) => (
    <div>
      {receipt.receipt_id} {shareUrl} {signedIn ? "signed in" : "anonymous"}
    </div>
  ),
}));

import ReceiptPage, { generateMetadata } from "./page";

const receipt = {
  receipt_version: 2,
  receipt_id: `es_${"a".repeat(64)}`,
  signature: "signature",
  cluster: "devnet",
  commitment: "finalized",
  slot: 100,
  verdict: "verified",
  reason_code: "VERIFIED",
  reason: "The expected program emitted this event.",
  expected_program_id: "expected-program",
  event_format: "anchor-log",
  event_discriminator: "0102030405060708",
  emitter_program_id: "expected-program",
  event_position: 0,
  event_data_hash: "b".repeat(64),
  evidence: [],
  created_at: "2026-09-04T19:00:00.000Z",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadPublicReceipt.mockResolvedValue({ status: "found", receipt });
  mocks.getCurrentUser.mockResolvedValue(null);
});

describe("public receipt page", () => {
  it("renders a found receipt with its canonical share URL", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user" });
    const page = await ReceiptPage({
      params: Promise.resolve({ receiptId: receipt.receipt_id }),
    });
    const html = renderToStaticMarkup(page);
    expect(html).toContain(receipt.receipt_id);
    expect(html).toContain(
      `https://eventseal.example/receipts/${receipt.receipt_id}`,
    );
    expect(html).toContain("signed in");
  });

  it.each(["malformed", "unavailable"] as const)(
    "renders the %s boundary without a receipt shell",
    async (status) => {
      mocks.loadPublicReceipt.mockResolvedValue({ status });
      const page = await ReceiptPage({
        params: Promise.resolve({ receiptId: "invalid" }),
      });
      const html = renderToStaticMarkup(page);
      expect(html).toContain(
        status === "malformed"
          ? "Receipt link is invalid."
          : "Receipt lookup is unavailable.",
      );
      expect(html).not.toContain("Receipt identity");
      expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    },
  );

  it("uses the route not-found boundary for a missing receipt", async () => {
    mocks.loadPublicReceipt.mockResolvedValue({ status: "missing" });
    await expect(
      ReceiptPage({
        params: Promise.resolve({ receiptId: receipt.receipt_id }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("publishes verdict-specific share metadata for a valid receipt", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ receiptId: receipt.receipt_id }),
    });
    expect(metadata.title).toBe("Verified Solana event — EventSeal");
    expect(metadata.description).toBe(receipt.reason);
    expect(metadata.alternates).toEqual({
      canonical: `https://eventseal.example/receipts/${receipt.receipt_id}`,
    });
    expect(metadata.openGraph).toMatchObject({
      title: "Verified Solana event — EventSeal",
      url: `https://eventseal.example/receipts/${receipt.receipt_id}`,
    });
  });

  it.each([
    ["malformed", "Invalid receipt link — EventSeal"],
    ["missing", "Receipt not found — EventSeal"],
    ["unavailable", "Receipt unavailable — EventSeal"],
  ] as const)(
    "keeps %s receipt metadata out of indexes",
    async (status, title) => {
      mocks.loadPublicReceipt.mockResolvedValue({ status });
      const metadata = await generateMetadata({
        params: Promise.resolve({ receiptId: receipt.receipt_id }),
      });
      expect(metadata.title).toBe(title);
      expect(metadata.robots).toEqual({ index: false, follow: false });
    },
  );
});
