import { describe, expect, it } from "vitest";

import {
  createReceiptId,
  createVerificationReceiptId,
  hashEventData,
} from "../src/index.js";

import { EXPECTED_PROGRAM } from "./fixtures.js";

const baseIdentity = {
  cluster: "devnet" as const,
  signature: "5UfDuX1234567890abcdef",
  event: {
    eventPosition: 0,
    emitterProgramId: EXPECTED_PROGRAM,
    eventDataHash: "a".repeat(64),
  },
};

describe("createReceiptId", () => {
  it("is deterministic for the same inputs", () => {
    const id1 = createReceiptId(baseIdentity);
    const id2 = createReceiptId(baseIdentity);

    expect(id1).toBe(id2);
  });

  it("produces an es_ prefixed 64-character hex string", () => {
    const id = createReceiptId(baseIdentity);

    expect(id).toMatch(/^es_[0-9a-f]{64}$/);
  });

  it("changes when the cluster differs", () => {
    const devnet = createReceiptId(baseIdentity);
    const mainnet = createReceiptId({
      ...baseIdentity,
      cluster: "mainnet-beta",
    });

    expect(devnet).not.toBe(mainnet);
  });

  it("changes when the signature differs", () => {
    const original = createReceiptId(baseIdentity);
    const different = createReceiptId({
      ...baseIdentity,
      signature: "differentSignature123",
    });

    expect(original).not.toBe(different);
  });

  it("changes when the event position differs", () => {
    const pos0 = createReceiptId(baseIdentity);
    const pos1 = createReceiptId({
      ...baseIdentity,
      event: { ...baseIdentity.event, eventPosition: 1 },
    });

    expect(pos0).not.toBe(pos1);
  });

  it("changes when the emitter program differs", () => {
    const original = createReceiptId(baseIdentity);
    const different = createReceiptId({
      ...baseIdentity,
      event: {
        ...baseIdentity.event,
        emitterProgramId: "11111111111111111111111111111111",
      },
    });

    expect(original).not.toBe(different);
  });

  it("changes when the event data hash differs", () => {
    const original = createReceiptId(baseIdentity);
    const different = createReceiptId({
      ...baseIdentity,
      event: { ...baseIdentity.event, eventDataHash: "b".repeat(64) },
    });

    expect(original).not.toBe(different);
  });
});

describe("createVerificationReceiptId", () => {
  const verificationIdentity = {
    ...baseIdentity,
    commitment: "finalized" as const,
    expectedProgramId: EXPECTED_PROGRAM,
    eventFormat: "anchor-log" as const,
    eventDiscriminator: "0102030405060708",
  };

  it("is deterministic for the same complete verification identity", () => {
    expect(createVerificationReceiptId(verificationIdentity)).toBe(
      createVerificationReceiptId(verificationIdentity),
    );
  });

  it("uses a different namespace from the legacy observed-event ID", () => {
    expect(createVerificationReceiptId(verificationIdentity)).not.toBe(
      createReceiptId(baseIdentity),
    );
  });

  it.each([
    [
      "expected program",
      { expectedProgramId: "11111111111111111111111111111111" },
    ],
    ["event format", { eventFormat: "anchor-cpi" as const }],
    ["event discriminator", { eventDiscriminator: "1111111111111111" }],
  ])("changes when the trusted %s changes", (_label, change) => {
    expect(
      createVerificationReceiptId({ ...verificationIdentity, ...change }),
    ).not.toBe(createVerificationReceiptId(verificationIdentity));
  });
});

describe("hashEventData", () => {
  it("returns a 64-character hex string", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const hash = hashEventData(data);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const data = new Uint8Array([10, 20, 30]);
    expect(hashEventData(data)).toBe(hashEventData(data));
  });

  it("differs for different inputs", () => {
    const a = hashEventData(new Uint8Array([1, 2, 3]));
    const b = hashEventData(new Uint8Array([4, 5, 6]));

    expect(a).not.toBe(b);
  });
});
