import {
  createVerificationReceiptId,
  type VerificationResult,
  type VerifyEventInput,
} from "../../packages/sdk/src/index.ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildReceiptRecord,
  persistVerificationReceipt,
  type ReceiptPersistenceClient,
} from "./receipt-persistence.ts";

const input: VerifyEventInput = {
  signature: "5UfDuXexampleSignature",
  cluster: "devnet",
  expectedProgramId: "EventSeal111111111111111111111111111111111",
  event: { format: "anchor-log", discriminator: "0102030405060708" },
  commitment: "finalized",
};
const event = {
  emitterProgramId: input.expectedProgramId,
  eventPosition: 0,
  eventDataHash: "a".repeat(64),
};
const result: VerificationResult = {
  receiptId: createVerificationReceiptId({
    cluster: input.cluster,
    commitment: "finalized",
    signature: input.signature,
    expectedProgramId: input.expectedProgramId,
    eventFormat: input.event.format,
    eventDiscriminator: input.event.discriminator,
    event,
  }),
  signature: input.signature,
  cluster: input.cluster,
  commitment: "finalized",
  slot: 100,
  verdict: "verified",
  reasonCode: "VERIFIED",
  reason: "The event was verified.",
  expectedProgramId: input.expectedProgramId,
  event,
  evidence: [{ check: "execution", passed: true, detail: "meta.err is null." }],
};

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

const client = {
  database: { from: mocks.from },
} as unknown as ReceiptPersistenceClient;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.from.mockReturnValue({ upsert: mocks.upsert, select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.maybeSingle.mockResolvedValue({
    data: {
      ...buildReceiptRecord(input, result),
      created_at: "2026-09-04T19:00:00.000Z",
    },
    error: null,
  });
});

describe("receipt persistence", () => {
  it("writes a complete v2 record with immutable conflict handling", async () => {
    await persistVerificationReceipt(client, input, result);

    expect(mocks.upsert).toHaveBeenCalledWith(
      [buildReceiptRecord(input, result)],
      { onConflict: "receipt_id", ignoreDuplicates: true },
    );
    expect(mocks.select).toHaveBeenCalledWith(expect.not.stringContaining("*"));
    expect(mocks.eq).toHaveBeenCalledWith("receipt_id", result.receiptId);
  });

  it("treats an identical existing row as an idempotent success", async () => {
    await expect(
      persistVerificationReceipt(client, input, result),
    ).resolves.toBeUndefined();
  });

  it("rejects a conflicting row instead of overwriting receipt meaning", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        ...buildReceiptRecord(input, result),
        verdict: "rejected",
        created_at: "2026-09-04T19:00:00.000Z",
      },
      error: null,
    });

    await expect(
      persistVerificationReceipt(client, input, result),
    ).rejects.toThrow("Receipt persistence integrity check failed");
  });

  it("rejects a result ID that does not bind the trusted request", () => {
    expect(() =>
      buildReceiptRecord(input, {
        ...result,
        receiptId: `es_${"b".repeat(64)}`,
      }),
    ).toThrow("Receipt ID does not match its verification identity");
  });

  it("skips persistence when verification issued no receipt", async () => {
    await persistVerificationReceipt(client, input, {
      ...result,
      receiptId: undefined,
      event: undefined,
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });
});
