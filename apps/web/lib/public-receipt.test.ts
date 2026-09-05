import { createReceiptId, createVerificationReceiptId } from "@eventseal/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadPublicReceipt, PUBLIC_RECEIPT_COLUMNS } from "./public-receipt";

vi.mock("server-only", () => ({}));

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
const v2Receipt = {
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

const mocks = {
  configuration: vi.fn(() => ({
    baseUrl: "https://example.insforge.app",
    anonKey: "public-anon-key",
  })),
  client: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockReturnValue({ database: { from: mocks.from } });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: v2Receipt, error: null });
});

describe("public receipt lookup", () => {
  it("rejects malformed IDs before configuration or database access", async () => {
    await expect(loadPublicReceipt("not-a-receipt", mocks)).resolves.toEqual({
      status: "malformed",
    });
    expect(mocks.configuration).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("reads one exact public receipt with the anonymous client", async () => {
    await expect(
      loadPublicReceipt(v2Receipt.receipt_id, mocks),
    ).resolves.toEqual({ status: "found", receipt: v2Receipt });
    expect(mocks.client).toHaveBeenCalledWith({
      baseUrl: "https://example.insforge.app",
      anonKey: "public-anon-key",
    });
    expect(mocks.from).toHaveBeenCalledWith("verification_receipts");
    expect(mocks.select).toHaveBeenCalledWith(PUBLIC_RECEIPT_COLUMNS);
    expect(mocks.eq).toHaveBeenCalledWith("receipt_id", v2Receipt.receipt_id);
  });

  it("distinguishes a missing receipt from an unavailable lookup", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(
      loadPublicReceipt(v2Receipt.receipt_id, mocks),
    ).resolves.toEqual({ status: "missing" });

    mocks.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "private database detail" },
    });
    await expect(
      loadPublicReceipt(v2Receipt.receipt_id, mocks),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("accepts a self-consistent legacy v1 receipt", async () => {
    const legacy = {
      ...v2Receipt,
      receipt_version: 1 as const,
      receipt_id: createReceiptId({
        cluster: identity.cluster,
        signature: identity.signature,
        event,
      }),
      commitment: null,
      reason: null,
      expected_program_id: null,
      event_format: null,
      event_discriminator: null,
    };
    mocks.maybeSingle.mockResolvedValue({ data: legacy, error: null });

    await expect(loadPublicReceipt(legacy.receipt_id, mocks)).resolves.toEqual({
      status: "found",
      receipt: legacy,
    });
  });

  it.each([
    { verdict: "verified", reason_code: "VERIFIED" },
    { verdict: "rejected", reason_code: "PROGRAM_MISMATCH" },
    { verdict: "indeterminate", reason_code: "RPC_UNAVAILABLE" },
  ] as const)("accepts a complete $verdict receipt", async (state) => {
    const receipt = { ...v2Receipt, ...state };
    mocks.maybeSingle.mockResolvedValue({ data: receipt, error: null });
    await expect(loadPublicReceipt(receipt.receipt_id, mocks)).resolves.toEqual(
      { status: "found", receipt },
    );
  });

  it.each([
    { verdict: "verified", reason_code: "TX_FAILED" },
    { verdict: "rejected", reason_code: "VERIFIED" },
    { verdict: "indeterminate", reason_code: "PROGRAM_MISMATCH" },
  ] as const)(
    "fails closed for a $verdict/$reason_code receipt state mismatch",
    async (state) => {
      const receipt = { ...v2Receipt, ...state };
      mocks.maybeSingle.mockResolvedValue({ data: receipt, error: null });
      await expect(
        loadPublicReceipt(receipt.receipt_id, mocks),
      ).resolves.toEqual({ status: "unavailable" });
    },
  );

  it.each([
    { ...v2Receipt, unexpected: "provider detail" },
    { ...v2Receipt, expected_program_id: "11111111111111111111111111111111" },
    { ...v2Receipt, event_discriminator: "ABCDEF0123456789" },
    { ...v2Receipt, evidence: [{ ...v2Receipt.evidence[0], extra: true }] },
    { ...v2Receipt, created_at: "2026-02-31T00:00:00.000Z" },
  ])("fails closed for malformed or inconsistent stored data", async (data) => {
    mocks.maybeSingle.mockResolvedValue({ data, error: null });
    await expect(
      loadPublicReceipt(v2Receipt.receipt_id, mocks),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("sanitizes thrown configuration and client failures", async () => {
    mocks.configuration.mockImplementationOnce(() => {
      throw new Error("private configuration detail");
    });
    await expect(
      loadPublicReceipt(v2Receipt.receipt_id, mocks),
    ).resolves.toEqual({ status: "unavailable" });
  });
});
