import { describe, expect, it } from "vitest";

import { attributeAnchorLogEvent, createReceiptId } from "../src/index.js";

const expectedProgram = "Fg6PaFpoGXkYsidMpWxqSWYbe2y1yVt9xEoBNHZsXcyB";
const attackerProgram = "11111111111111111111111111111111";
const discriminator = "0102030405060708";
const eventData = Buffer.from("0102030405060708090a", "hex").toString("base64");

describe("Anchor log attribution", () => {
  it("attributes an event to the active program frame", () => {
    const result = attributeAnchorLogEvent(
      [
        `Program ${expectedProgram} invoke [1]`,
        `Program data: ${eventData}`,
        `Program ${expectedProgram} success`,
      ],
      expectedProgram,
      discriminator,
    );

    expect(result.reasonCode).toBe("VERIFIED");
    expect(result.event?.emitterProgramId).toBe(expectedProgram);
  });

  it("rejects identical event bytes emitted by a different program", () => {
    const result = attributeAnchorLogEvent(
      [
        `Program ${attackerProgram} invoke [1]`,
        `Program data: ${eventData}`,
        `Program ${attackerProgram} success`,
      ],
      expectedProgram,
      discriminator,
    );

    expect(result.reasonCode).toBe("PROGRAM_MISMATCH");
  });
});

describe("receipt identity", () => {
  it("is deterministic for duplicate deliveries", () => {
    const identity = {
      cluster: "devnet" as const,
      signature: "example-signature",
      event: {
        eventPosition: 0,
        emitterProgramId: expectedProgram,
        eventDataHash: "a".repeat(64),
      },
    };

    expect(createReceiptId(identity)).toBe(createReceiptId(identity));
    expect(createReceiptId(identity)).toMatch(/^es_[0-9a-f]{64}$/);
  });
});
