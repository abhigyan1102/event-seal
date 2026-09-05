import { afterEach, describe, expect, it, vi } from "vitest";

import * as fetchModule from "../src/transaction/fetch.js";
import { verifyEvent } from "../src/verify-event.js";
import type { VerifyEventInput } from "../src/types.js";

import {
  DISCRIMINATOR,
  EVENT_DATA_B64,
  EXPECTED_PROGRAM,
  confirmedOnlyTx,
  finalizedFailedTx,
  finalizedSuccessTx,
  noLogsTx,
  noMetadataTx,
  notFoundTx,
  successfulEventLogs,
} from "./fixtures.js";

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

function mockFetch(factory: () => ReturnType<typeof notFoundTx>) {
  vi.spyOn(fetchModule, "fetchFinalizedTransaction").mockResolvedValue(
    factory(),
  );
}

function mockFetchThrow(error: Error) {
  vi.spyOn(fetchModule, "fetchFinalizedTransaction").mockRejectedValue(error);
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Valid base input
// ---------------------------------------------------------------------------

const validInput: VerifyEventInput = {
  signature: "5UfDuXexampleSignature",
  cluster: "devnet",
  expectedProgramId: EXPECTED_PROGRAM,
  event: {
    format: "anchor-log",
    discriminator: DISCRIMINATOR,
  },
  commitment: "finalized",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("verifyEvent", () => {
  // --- INVALID_REQUEST ---------------------------------------------------

  describe("INVALID_REQUEST", () => {
    it("returns indeterminate when signature is empty", async () => {
      const result = await verifyEvent({ ...validInput, signature: "" });

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("INVALID_REQUEST");
    });

    it("returns indeterminate when expectedProgramId is empty", async () => {
      const result = await verifyEvent({
        ...validInput,
        expectedProgramId: "",
      });

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("INVALID_REQUEST");
    });

    it("returns indeterminate for uppercase discriminator", async () => {
      const result = await verifyEvent({
        ...validInput,
        event: {
          ...validInput.event,
          discriminator: "a1b2c3d4e5f60708".toUpperCase(),
        },
      });

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("INVALID_REQUEST");
    });

    it("returns indeterminate for short discriminator", async () => {
      const result = await verifyEvent({
        ...validInput,
        event: { ...validInput.event, discriminator: "0102030405" },
      });

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("INVALID_REQUEST");
    });

    it("returns indeterminate for discriminator with invalid characters", async () => {
      const result = await verifyEvent({
        ...validInput,
        event: { ...validInput.event, discriminator: "01020304050607zz" },
      });

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("INVALID_REQUEST");
    });

    it("returns indeterminate for an unsupported runtime event format", async () => {
      const fetchSpy = vi.spyOn(fetchModule, "fetchFinalizedTransaction");
      const result = await verifyEvent({
        ...validInput,
        event: { ...validInput.event, format: "other" },
      } as unknown as VerifyEventInput);

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("INVALID_REQUEST");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // --- RPC_UNAVAILABLE ---------------------------------------------------

  describe("RPC_UNAVAILABLE", () => {
    it("returns indeterminate when RPC throws", async () => {
      mockFetchThrow(new Error("Connection refused"));

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("RPC_UNAVAILABLE");
      expect(result.reason).toContain("Connection refused");
      expect(result.evidence).toContainEqual(
        expect.objectContaining({ check: "rpc", passed: false }),
      );
    });

    it("handles non-Error throws gracefully", async () => {
      vi.spyOn(fetchModule, "fetchFinalizedTransaction").mockRejectedValue(
        "string error",
      );

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("RPC_UNAVAILABLE");
      expect(result.reason).toBe("Solana RPC request failed.");
    });
  });

  // --- TX_NOT_FOUND ------------------------------------------------------

  describe("TX_NOT_FOUND", () => {
    it("returns indeterminate when transaction is null", async () => {
      mockFetch(notFoundTx);

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("TX_NOT_FOUND");
    });
  });

  // --- TX_NOT_FINALIZED --------------------------------------------------

  describe("TX_NOT_FINALIZED", () => {
    it("returns indeterminate when confirmation is only confirmed", async () => {
      mockFetch(confirmedOnlyTx);

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("TX_NOT_FINALIZED");
      expect(result.evidence).toContainEqual(
        expect.objectContaining({ check: "finality", passed: false }),
      );
    });
  });

  // --- METADATA_MISSING --------------------------------------------------

  describe("METADATA_MISSING", () => {
    it("returns indeterminate when meta is null", async () => {
      mockFetch(noMetadataTx);

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("METADATA_MISSING");
    });
  });

  // --- TX_FAILED ---------------------------------------------------------

  describe("TX_FAILED", () => {
    it("returns rejected when meta.err is non-null", async () => {
      mockFetch(() => finalizedFailedTx(successfulEventLogs()));

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("rejected");
      expect(result.reasonCode).toBe("TX_FAILED");
      expect(result.evidence).toContainEqual(
        expect.objectContaining({ check: "execution", passed: false }),
      );
      expect(result.evidence).toContainEqual(
        expect.objectContaining({ check: "finality", passed: true }),
      );
    });
  });

  // --- LOGS_UNAVAILABLE --------------------------------------------------

  describe("LOGS_UNAVAILABLE", () => {
    it("returns indeterminate when logMessages is null", async () => {
      mockFetch(noLogsTx);

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("LOGS_UNAVAILABLE");
    });
  });

  // --- CPI_EVENT_UNSUPPORTED ---------------------------------------------

  describe("CPI_EVENT_UNSUPPORTED", () => {
    it("returns indeterminate for anchor-cpi format", async () => {
      mockFetch(() => finalizedSuccessTx(successfulEventLogs()));

      const result = await verifyEvent({
        ...validInput,
        event: { ...validInput.event, format: "anchor-cpi" },
      });

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("CPI_EVENT_UNSUPPORTED");
      expect(result.evidence).toContainEqual(
        expect.objectContaining({ check: "attribution", passed: false }),
      );
    });
  });

  // --- VERIFIED (happy path) --------------------------------------------

  describe("VERIFIED", () => {
    it("returns verified with receiptId for a valid finalized event", async () => {
      mockFetch(() => finalizedSuccessTx(successfulEventLogs()));

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("verified");
      expect(result.reasonCode).toBe("VERIFIED");
      expect(result.receiptId).toMatch(/^es_[0-9a-f]{64}$/);
      expect(result.event?.emitterProgramId).toBe(EXPECTED_PROGRAM);
      expect(result.event?.eventPosition).toBe(0);
      expect(result.event?.eventDataHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.slot).toBe(100);
      expect(result.evidence).toContainEqual(
        expect.objectContaining({ check: "finality", passed: true }),
      );
      expect(result.evidence).toContainEqual(
        expect.objectContaining({ check: "execution", passed: true }),
      );
      expect(result.evidence).toContainEqual(
        expect.objectContaining({ check: "attribution", passed: true }),
      );
    });

    it("always returns commitment as finalized", async () => {
      mockFetch(() => finalizedSuccessTx(successfulEventLogs()));

      const result = await verifyEvent(validInput);

      expect(result.commitment).toBe("finalized");
    });

    it("echoes the input signature and cluster", async () => {
      mockFetch(() => finalizedSuccessTx(successfulEventLogs()));

      const result = await verifyEvent(validInput);

      expect(result.signature).toBe(validInput.signature);
      expect(result.cluster).toBe(validInput.cluster);
      expect(result.expectedProgramId).toBe(validInput.expectedProgramId);
    });
  });

  // --- Attribution pass-throughs -----------------------------------------

  describe("attribution pass-throughs", () => {
    it("returns rejected for PROGRAM_MISMATCH", async () => {
      mockFetch(() =>
        finalizedSuccessTx([
          `Program 11111111111111111111111111111111 invoke [1]`,
          `Program data: ${EVENT_DATA_B64}`,
          `Program 11111111111111111111111111111111 success`,
        ]),
      );

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("rejected");
      expect(result.reasonCode).toBe("PROGRAM_MISMATCH");
      expect(result.receiptId).toMatch(/^es_[0-9a-f]{64}$/);
    });

    it("binds receipt IDs to the trusted program identity", async () => {
      const observedProgram = "11111111111111111111111111111111";
      mockFetch(() =>
        finalizedSuccessTx([
          `Program ${observedProgram} invoke [1]`,
          `Program data: ${EVENT_DATA_B64}`,
          `Program ${observedProgram} success`,
        ]),
      );

      const rejected = await verifyEvent(validInput);
      const verified = await verifyEvent({
        ...validInput,
        expectedProgramId: observedProgram,
      });

      expect(rejected.reasonCode).toBe("PROGRAM_MISMATCH");
      expect(verified.reasonCode).toBe("VERIFIED");
      expect(rejected.receiptId).toBeDefined();
      expect(verified.receiptId).toBeDefined();
      expect(rejected.receiptId).not.toBe(verified.receiptId);
    });

    it("returns rejected for DISCRIMINATOR_MISMATCH", async () => {
      mockFetch(() =>
        finalizedSuccessTx([
          `Program ${EXPECTED_PROGRAM} invoke [1]`,
          `Program data: ${Buffer.from("aabbccddeeff00110203", "hex").toString("base64")}`,
          `Program ${EXPECTED_PROGRAM} success`,
        ]),
      );

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("rejected");
      expect(result.reasonCode).toBe("DISCRIMINATOR_MISMATCH");
    });

    it("returns indeterminate for EVENT_NOT_FOUND", async () => {
      mockFetch(() =>
        finalizedSuccessTx([
          `Program ${EXPECTED_PROGRAM} invoke [1]`,
          `Program ${EXPECTED_PROGRAM} success`,
        ]),
      );

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("EVENT_NOT_FOUND");
      expect(result.receiptId).toBeUndefined();
    });

    it("returns indeterminate for AMBIGUOUS_EVENT", async () => {
      mockFetch(() =>
        finalizedSuccessTx([
          `Program ${EXPECTED_PROGRAM} invoke [1]`,
          `Program data: ${EVENT_DATA_B64}`,
          `Program data: ${EVENT_DATA_B64}`,
          `Program ${EXPECTED_PROGRAM} success`,
        ]),
      );

      const result = await verifyEvent(validInput);

      expect(result.verdict).toBe("indeterminate");
      expect(result.reasonCode).toBe("AMBIGUOUS_EVENT");
    });
  });
});
