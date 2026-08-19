import { describe, expect, it } from "vitest";

import { attributeAnchorLogEvent } from "../src/events/anchor-log.js";

import {
  ATTACKER_PROGRAM,
  DISCRIMINATOR,
  EXPECTED_PROGRAM,
  WRONG_DISCRIMINATOR,
  attackerEventLogs,
  duplicateEventLogs,
  malformedBase64Logs,
  nestedCpiAttackerLogs,
  nestedCpiLogs,
  noDataLogs,
  shortDataLogs,
  successfulEventLogs,
  wrongDiscriminatorLogs,
} from "./fixtures.js";

describe("Anchor log attribution", () => {
  it("attributes an event to the active program frame", () => {
    const result = attributeAnchorLogEvent(
      successfulEventLogs(),
      EXPECTED_PROGRAM,
      DISCRIMINATOR,
    );

    expect(result.reasonCode).toBe("VERIFIED");
    expect(result.event?.emitterProgramId).toBe(EXPECTED_PROGRAM);
    expect(result.event?.eventPosition).toBe(0);
    expect(result.event?.eventDataHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects identical event bytes emitted by a different program", () => {
    const result = attributeAnchorLogEvent(
      attackerEventLogs(),
      EXPECTED_PROGRAM,
      DISCRIMINATOR,
    );

    expect(result.reasonCode).toBe("PROGRAM_MISMATCH");
    expect(result.event?.emitterProgramId).toBe(ATTACKER_PROGRAM);
  });

  it("rejects when the expected program emits a different discriminator", () => {
    const result = attributeAnchorLogEvent(
      wrongDiscriminatorLogs(),
      EXPECTED_PROGRAM,
      DISCRIMINATOR,
    );

    expect(result.reasonCode).toBe("DISCRIMINATOR_MISMATCH");
    expect(result.event).toBeUndefined();
  });

  it("returns AMBIGUOUS_EVENT when two events match program and discriminator", () => {
    const result = attributeAnchorLogEvent(
      duplicateEventLogs(),
      EXPECTED_PROGRAM,
      DISCRIMINATOR,
    );

    expect(result.reasonCode).toBe("AMBIGUOUS_EVENT");
    expect(result.event).toBeUndefined();
  });

  it("returns EVENT_NOT_FOUND when no data lines exist", () => {
    const result = attributeAnchorLogEvent(
      noDataLogs(),
      EXPECTED_PROGRAM,
      DISCRIMINATOR,
    );

    expect(result.reasonCode).toBe("EVENT_NOT_FOUND");
  });

  it("returns EVENT_NOT_FOUND for an empty log array", () => {
    const result = attributeAnchorLogEvent([], EXPECTED_PROGRAM, DISCRIMINATOR);

    expect(result.reasonCode).toBe("EVENT_NOT_FOUND");
  });

  it("attributes a nested CPI event to the inner (expected) program", () => {
    const result = attributeAnchorLogEvent(
      nestedCpiLogs(),
      EXPECTED_PROGRAM,
      DISCRIMINATOR,
    );

    expect(result.reasonCode).toBe("VERIFIED");
    expect(result.event?.emitterProgramId).toBe(EXPECTED_PROGRAM);
  });

  it("detects PROGRAM_MISMATCH when attacker emits inside the expected program's frame", () => {
    const result = attributeAnchorLogEvent(
      nestedCpiAttackerLogs(),
      EXPECTED_PROGRAM,
      DISCRIMINATOR,
    );

    expect(result.reasonCode).toBe("PROGRAM_MISMATCH");
    expect(result.event?.emitterProgramId).toBe(ATTACKER_PROGRAM);
  });

  it("skips malformed base64 data lines gracefully", () => {
    const result = attributeAnchorLogEvent(
      malformedBase64Logs(),
      EXPECTED_PROGRAM,
      DISCRIMINATOR,
    );

    expect(result.reasonCode).toBe("EVENT_NOT_FOUND");
  });

  it("skips data lines shorter than 8 bytes", () => {
    const result = attributeAnchorLogEvent(
      shortDataLogs(),
      EXPECTED_PROGRAM,
      DISCRIMINATOR,
    );

    // Short data has no valid discriminator, so no events are located
    expect(result.reasonCode).toBe("EVENT_NOT_FOUND");
  });

  it("returns DISCRIMINATOR_MISMATCH when requesting a different discriminator", () => {
    // Expected program emits matching data, but we ask for a different discriminator
    const result = attributeAnchorLogEvent(
      successfulEventLogs(),
      EXPECTED_PROGRAM,
      WRONG_DISCRIMINATOR,
    );

    expect(result.reasonCode).toBe("DISCRIMINATOR_MISMATCH");
  });
});
