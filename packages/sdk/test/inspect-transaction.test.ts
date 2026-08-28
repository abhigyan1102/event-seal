import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectTransaction } from "../src/inspect-transaction.js";
import { inspectLogs } from "../src/events/inspect-logs.js";
import * as rpc from "../src/transaction/fetch.js";
import {
  DISCRIMINATOR,
  EXPECTED_PROGRAM,
  OUTER_PROGRAM,
  EVENT_DATA_B64,
  dataLog,
  invokeLog,
  successLog,
  successfulEventLogs,
} from "./fixtures.js";

const input = { signature: "1".repeat(64), cluster: "devnet" as const };
const tx = (
  logs: string[] | null = successfulEventLogs(),
  err: unknown = null,
) => ({
  status: { slot: 100, err, confirmationStatus: "finalized" as const },
  transaction: { slot: 100, meta: { err, logMessages: logs } },
});
afterEach(() => vi.restoreAllMocks());

describe("inspectTransaction", () => {
  it("discovers candidates without an expected program, discriminator, verdict or receipt", async () => {
    vi.spyOn(rpc, "fetchFinalizedTransaction").mockResolvedValue(tx());
    const result = await inspectTransaction(input);
    expect(result).toMatchObject({
      kind: "transaction-inspection",
      reasonCode: "CANDIDATES_FOUND",
      finality: "finalized",
      execution: "succeeded",
      invokedPrograms: [EXPECTED_PROGRAM],
      logsStatus: "available",
    });
    expect(result.candidates).toMatchObject([
      {
        emitterProgramId: EXPECTED_PROGRAM,
        eventPosition: 0,
        discriminator: DISCRIMINATOR,
        dataBase64: EVENT_DATA_B64,
      },
    ]);
    expect(result.candidates[0]?.eventDataHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result).not.toHaveProperty("receiptId");
    expect(result).not.toHaveProperty("verdict");
  });
  it("distinguishes no supported log event from unavailable logs", async () => {
    const fetch = vi.spyOn(rpc, "fetchFinalizedTransaction");
    fetch.mockResolvedValue(
      tx([
        invokeLog(EXPECTED_PROGRAM, 1),
        "Program log: Instruction: Fill",
        successLog(EXPECTED_PROGRAM),
      ]),
    );
    expect(await inspectTransaction(input)).toMatchObject({
      reasonCode: "NO_SUPPORTED_LOG_EVENT",
      candidates: [],
      logsStatus: "available",
      execution: "succeeded",
    });
    fetch.mockResolvedValue(tx(null));
    expect(await inspectTransaction(input)).toMatchObject({
      reasonCode: "LOGS_UNAVAILABLE",
      candidates: [],
      logsStatus: "unavailable",
    });
    fetch.mockResolvedValue({
      ...tx(),
      transaction: { slot: 100, meta: null },
    });
    expect(await inspectTransaction(input)).toMatchObject({
      reasonCode: "METADATA_MISSING",
      candidates: [],
    });
  });
  it("reports a failed transaction even when it logged candidate bytes", async () => {
    vi.spyOn(rpc, "fetchFinalizedTransaction").mockResolvedValue(
      tx(successfulEventLogs(), { InstructionError: [0, "error"] }),
    );
    const result = await inspectTransaction(input);
    expect(result).toMatchObject({
      reasonCode: "TX_FAILED",
      execution: "failed",
    });
    expect(result).not.toHaveProperty("receiptId");
  });
  it("does not invent finality or inspect non-finalized evidence", async () => {
    const fetch = vi.spyOn(rpc, "fetchFinalizedTransaction");
    fetch.mockResolvedValue({ ...tx(), status: null });
    expect(await inspectTransaction(input)).toMatchObject({
      finality: "unknown",
      reasonCode: "TX_NOT_FINALIZED",
      candidates: [],
    });
    fetch.mockResolvedValue({
      ...tx(),
      status: { ...tx().status, confirmationStatus: "confirmed" },
      transaction: null,
    });
    expect(await inspectTransaction(input)).toMatchObject({
      finality: "confirmed",
      reasonCode: "TX_NOT_FINALIZED",
      candidates: [],
    });
    fetch.mockResolvedValue({ status: null, transaction: null });
    expect(await inspectTransaction(input)).toMatchObject({
      reasonCode: "TX_NOT_FOUND",
      execution: "unknown",
    });
  });
  it("rejects invalid input before RPC and sanitizes provider failures", async () => {
    const fetch = vi
      .spyOn(rpc, "fetchFinalizedTransaction")
      .mockRejectedValue(new Error("secret provider URL"));
    expect(
      await inspectTransaction({ ...input, signature: "invalid" }),
    ).toMatchObject({ reasonCode: "INVALID_REQUEST" });
    expect(fetch).not.toHaveBeenCalled();
    const result = await inspectTransaction(input);
    expect(result).toMatchObject({
      reasonCode: "RPC_UNAVAILABLE",
      candidates: [],
      execution: "unknown",
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});

describe("inspectLogs", () => {
  it("tracks nested frames and ignores spoofed log text", () => {
    const result = inspectLogs([
      invokeLog(OUTER_PROGRAM, 1),
      "Program log: Program data: " + EVENT_DATA_B64,
      invokeLog(EXPECTED_PROGRAM, 2),
      dataLog(EVENT_DATA_B64),
      successLog(EXPECTED_PROGRAM),
      successLog(OUTER_PROGRAM),
    ]);
    expect(result.invokedPrograms).toEqual([OUTER_PROGRAM, EXPECTED_PROGRAM]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.emitterProgramId).toBe(EXPECTED_PROGRAM);
  });
  it.each([
    [invokeLog(EXPECTED_PROGRAM, 2), dataLog(EVENT_DATA_B64)],
    [invokeLog(EXPECTED_PROGRAM, 1), dataLog(EVENT_DATA_B64)],
    [dataLog(EVENT_DATA_B64)],
    [invokeLog(EXPECTED_PROGRAM, 1), successLog(OUTER_PROGRAM)],
    [...successfulEventLogs(), "Log truncated"],
    [
      invokeLog(EXPECTED_PROGRAM, 1),
      dataLog("!!!"),
      successLog(EXPECTED_PROGRAM),
    ],
  ])(
    "does not treat incomplete or malformed logs as absence of events: %j",
    (...logs) => {
      expect(inspectLogs(logs)).toMatchObject({
        logsStatus: "incomplete",
        candidates: [],
      });
    },
  );
  it("keeps duplicate candidates distinct and bounds response work", () => {
    const logs = [
      invokeLog(EXPECTED_PROGRAM, 1),
      dataLog(EVENT_DATA_B64),
      dataLog(EVENT_DATA_B64),
      successLog(EXPECTED_PROGRAM),
    ];
    expect(inspectLogs(logs).candidates.map((c) => c.eventPosition)).toEqual([
      0, 1,
    ]);
    expect(
      inspectLogs([
        invokeLog(EXPECTED_PROGRAM, 1),
        ...Array.from({ length: 129 }, () => dataLog(EVENT_DATA_B64)),
        successLog(EXPECTED_PROGRAM),
      ]),
    ).toMatchObject({ logsStatus: "incomplete", candidates: [] });
    expect(inspectLogs(["x".repeat(256 * 1024 + 1)])).toMatchObject({
      logsStatus: "incomplete",
    });
    expect(inspectLogs(Array(2049).fill("log"))).toMatchObject({
      logsStatus: "incomplete",
    });
  });
});
