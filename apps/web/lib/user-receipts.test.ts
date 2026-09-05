import { createVerificationReceiptId } from "@eventseal/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardHref, parseDashboardFilters } from "./dashboard-filters";
import { PUBLIC_RECEIPT_COLUMNS } from "./public-receipt";
import { DASHBOARD_PAGE_SIZE, listSavedReceipts } from "./user-receipts";

const mocks = vi.hoisted(() => ({
  createAuthenticatedClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
  range:
    vi.fn<() => Promise<{ data: unknown; error: unknown; count: unknown }>>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./auth-server", () => ({
  createAuthenticatedClient: mocks.createAuthenticatedClient,
}));

const event = {
  emitterProgramId: "EventSeal111111111111111111111111111111111",
  eventPosition: 0,
  eventDataHash: "a".repeat(64),
};
const identity = {
  cluster: "devnet" as const,
  commitment: "finalized" as const,
  signature: "5UfDuXexampleSignature",
  expectedProgramId: event.emitterProgramId,
  eventFormat: "anchor-log" as const,
  eventDiscriminator: "0102030405060708",
  event,
};
const receipt = {
  receipt_version: 2 as const,
  receipt_id: createVerificationReceiptId(identity),
  signature: identity.signature,
  cluster: identity.cluster,
  commitment: identity.commitment,
  slot: 100,
  verdict: "verified" as const,
  reason_code: "VERIFIED" as const,
  reason: "The event was verified.",
  expected_program_id: identity.expectedProgramId,
  event_format: identity.eventFormat,
  event_discriminator: identity.eventDiscriminator,
  emitter_program_id: event.emitterProgramId,
  event_position: event.eventPosition,
  event_data_hash: event.eventDataHash,
  evidence: [{ check: "execution", passed: true, detail: "meta.err is null." }],
  created_at: "2026-09-04T19:00:00.000Z",
};
const row = {
  receipt_id: receipt.receipt_id,
  saved_at: "2026-09-05T12:00:00.000Z",
  verification_receipts: receipt,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createAuthenticatedClient.mockResolvedValue({
    database: { from: mocks.from },
  });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ order: mocks.order });
  mocks.order.mockReturnValue({
    order: mocks.order,
    eq: mocks.eq,
    range: mocks.range,
  });
  mocks.eq.mockReturnValue({ eq: mocks.eq, range: mocks.range });
  mocks.range.mockResolvedValue({ data: [row], error: null, count: 1 });
});

describe("dashboard filters", () => {
  it("accepts only supported verdicts, clusters, and bounded pages", () => {
    expect(
      parseDashboardFilters({
        verdict: "rejected",
        cluster: "mainnet-beta",
        page: "12",
      }),
    ).toEqual({ verdict: "rejected", cluster: "mainnet-beta", page: 12 });

    expect(
      parseDashboardFilters({
        verdict: "approved",
        cluster: "polygon",
        page: "10001",
      }),
    ).toEqual({ verdict: "all", cluster: "all", page: 1 });
    expect(parseDashboardFilters({ page: ["2", "3"] })).toEqual({
      verdict: "all",
      cluster: "all",
      page: 1,
    });
  });

  it("preserves active filters in pagination links", () => {
    expect(
      dashboardHref(
        { verdict: "indeterminate", cluster: "devnet", page: 2 },
        3,
      ),
    ).toBe("/dashboard?verdict=indeterminate&cluster=devnet&page=3");
    expect(dashboardHref({ verdict: "all", cluster: "all", page: 2 }, 1)).toBe(
      "/dashboard",
    );
  });
});

describe("listSavedReceipts", () => {
  it("loads exact receipt fields through a bounded authenticated query", async () => {
    await expect(
      listSavedReceipts({ verdict: "all", cluster: "all", page: 2 }),
    ).resolves.toEqual({
      items: [{ receiptId: row.receipt_id, savedAt: row.saved_at, receipt }],
      total: 1,
      page: 2,
      pageSize: DASHBOARD_PAGE_SIZE,
      totalPages: 1,
    });
    expect(mocks.from).toHaveBeenCalledWith("user_receipts");
    expect(mocks.select).toHaveBeenCalledWith(
      `receipt_id,saved_at,verification_receipts!inner(${PUBLIC_RECEIPT_COLUMNS})`,
      { count: "exact" },
    );
    expect(mocks.order).toHaveBeenNthCalledWith(1, "saved_at", {
      ascending: false,
    });
    expect(mocks.order).toHaveBeenNthCalledWith(2, "receipt_id", {
      ascending: true,
    });
    expect(mocks.range).toHaveBeenCalledWith(8, 15);
  });

  it("applies only canonical receipt-side filters", async () => {
    await listSavedReceipts({
      verdict: "indeterminate",
      cluster: "testnet",
      page: 1,
    });
    expect(mocks.eq).toHaveBeenNthCalledWith(
      1,
      "verification_receipts.verdict",
      "indeterminate",
    );
    expect(mocks.eq).toHaveBeenNthCalledWith(
      2,
      "verification_receipts.cluster",
      "testnet",
    );
    expect(mocks.range).toHaveBeenCalledWith(0, 7);
  });

  it("does not present a backend failure or missing count as empty history", async () => {
    mocks.range.mockResolvedValueOnce({
      data: null,
      error: { message: "private database details" },
      count: null,
    });
    await expect(listSavedReceipts()).rejects.toThrow(
      "Saved receipts are unavailable",
    );

    mocks.range.mockResolvedValueOnce({ data: [], error: null, count: null });
    await expect(listSavedReceipts()).rejects.toThrow(
      "Saved receipts are unavailable",
    );
  });

  it.each([
    { ...row, receipt_id: `es_${"b".repeat(64)}` },
    { ...row, saved_at: "2026-02-31T00:00:00.000Z" },
    { ...row, verification_receipts: [] },
    {
      ...row,
      verification_receipts: { ...receipt, reason_code: "TX_FAILED" },
    },
  ])(
    "fails closed for malformed or inconsistent joined data",
    async (invalid) => {
      mocks.range.mockResolvedValue({ data: [invalid], error: null, count: 1 });
      await expect(listSavedReceipts()).rejects.toThrow(
        "Saved receipt data is invalid",
      );
    },
  );
});
