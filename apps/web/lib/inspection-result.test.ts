import type { TransactionInspection } from "@eventseal/sdk";
import { describe, expect, it } from "vitest";

import { isTransactionInspection } from "./inspection-result";

const valid: TransactionInspection = {
  kind: "transaction-inspection",
  signature: "1".repeat(64),
  cluster: "devnet",
  finality: "finalized",
  execution: "succeeded",
  slot: 0,
  reasonCode: "CANDIDATES_FOUND",
  invokedPrograms: ["1".repeat(32)],
  logsStatus: "available",
  candidates: [
    {
      eventPosition: 0,
      emitterProgramId: "1".repeat(32),
      eventDataHash: "a".repeat(64),
      discriminator: "0102030405060708",
      dataBase64: "AQIDBAUGBwg=",
    },
  ],
};

describe("transaction inspection result validation", () => {
  it("accepts the complete SDK response shape", () => {
    expect(isTransactionInspection(valid)).toBe(true);
  });

  it.each([
    { ...valid, kind: "verification" },
    { ...valid, finality: "complete" },
    { ...valid, invokedPrograms: ["not-base58"] },
    { ...valid, candidates: [{ ...valid.candidates[0], dataBase64: "!!!" }] },
    {
      ...valid,
      candidates: [{ ...valid.candidates[0], discriminator: "ABCDEF" }],
    },
  ])("rejects malformed upstream result %j", (result) => {
    expect(isTransactionInspection(result)).toBe(false);
  });
});
