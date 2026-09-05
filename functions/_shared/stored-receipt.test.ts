import {
  createReceiptId,
  createVerificationReceiptId,
} from "../../packages/sdk/src/index.ts";
import { describe, expect, it } from "vitest";

import { isStoredVerificationReceipt } from "./stored-receipt.ts";

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
const evidence = [
  { check: "execution", passed: true, detail: "meta.err is null." },
];
const v2Receipt = {
  receipt_version: 2,
  receipt_id: createVerificationReceiptId(identity),
  signature: identity.signature,
  cluster: identity.cluster,
  commitment: identity.commitment,
  slot: 100,
  verdict: "verified",
  reason_code: "VERIFIED",
  reason: "The event was verified.",
  expected_program_id: identity.expectedProgramId,
  event_format: identity.eventFormat,
  event_discriminator: identity.eventDiscriminator,
  emitter_program_id: event.emitterProgramId,
  event_position: event.eventPosition,
  event_data_hash: event.eventDataHash,
  evidence,
  created_at: "2026-09-04T19:00:00.000Z",
};

describe("stored receipt validation", () => {
  it("accepts a complete v2 receipt whose ID matches its identity", () => {
    expect(isStoredVerificationReceipt(v2Receipt)).toBe(true);
  });

  it("accepts PostgreSQL timestamptz precision and offsets", () => {
    expect(
      isStoredVerificationReceipt({
        ...v2Receipt,
        created_at: "2026-08-23T14:41:07.516608+00:00",
      }),
    ).toBe(true);
  });

  it("accepts a self-consistent legacy v1 receipt with unavailable trust fields", () => {
    const legacy = {
      ...v2Receipt,
      receipt_version: 1,
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

    expect(isStoredVerificationReceipt(legacy)).toBe(true);
  });

  it("rejects a v2 row when a trusted identity field no longer matches its ID", () => {
    expect(
      isStoredVerificationReceipt({
        ...v2Receipt,
        expected_program_id: "11111111111111111111111111111111",
      }),
    ).toBe(false);
  });

  it.each([
    { ...v2Receipt, unexpected: "provider detail" },
    { ...v2Receipt, receipt_version: 3 },
    { ...v2Receipt, event_discriminator: "ABCDEF0123456789" },
    { ...v2Receipt, evidence: [{ ...evidence[0], unexpected: true }] },
    { ...v2Receipt, created_at: "2026-02-31T00:00:00.000Z" },
    { ...v2Receipt, created_at: "2026-09-04T19:00:00+24:00" },
  ])("rejects malformed or unexpected stored data", (value) => {
    expect(isStoredVerificationReceipt(value)).toBe(false);
  });
});
