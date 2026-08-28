import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { runMainnetInspectionProof } from "./smoke-mainnet-inspection.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL("../tests/fixtures/mainnet-inspection.json", import.meta.url),
    "utf8",
  ),
);
function mockSdk() {
  return {
    inspectTransaction: vi.fn(async ({ signature }) => {
      const entry = Object.values(fixture).find(
        (item) => item.signature === signature,
      );
      const failed = entry === fixture.failed;
      const supported = entry === fixture.supportedEvent;
      return {
        kind: "transaction-inspection",
        signature,
        cluster: "mainnet-beta",
        slot: entry.slot,
        finality: "finalized",
        execution: failed ? "failed" : "succeeded",
        logsStatus: "available",
        reasonCode: failed
          ? "TX_FAILED"
          : supported
            ? "CANDIDATES_FOUND"
            : "NO_SUPPORTED_LOG_EVENT",
        invokedPrograms: entry.programId ? [entry.programId] : [],
        candidates: supported
          ? [
              {
                emitterProgramId: entry.programId,
                discriminator: "40c6cde8260871e2",
                eventDataHash: "a".repeat(64),
              },
            ]
          : [],
      };
    }),
    verifyEvent: vi.fn(async ({ signature }) =>
      signature === fixture.failed.signature
        ? { verdict: "rejected", reasonCode: "TX_FAILED" }
        : {
            signature,
            cluster: "mainnet-beta",
            slot: fixture.supportedEvent.slot,
            verdict: "verified",
            reasonCode: "VERIFIED",
            receiptId: `es_${"a".repeat(64)}`,
            event: {
              emitterProgramId: fixture.supportedEvent.programId,
              eventDataHash: "a".repeat(64),
            },
          },
    ),
  };
}

describe("mainnet inspection proof", () => {
  it("checks independent expectations without recording RPC credentials", async () => {
    const sdk = mockSdk();
    const proof = await runMainnetInspectionProof(
      { rpcUrl: "https://rpc.example/?key=private" },
      sdk,
    );
    expect(proof.inspectionReceiptsIssued).toBe(0);
    expect(proof.failed.verification).toBe("TX_FAILED");
    expect(sdk.inspectTransaction).toHaveBeenCalledTimes(3);
    expect(sdk.verifyEvent).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(proof)).not.toMatch(/private|rpc\.example/);
  });
  it("fails if inspection ever returns a receipt or claims missing logs are no events", async () => {
    const sdk = mockSdk();
    const normal = await sdk.inspectTransaction({
      signature: fixture.noEvent.signature,
    });
    sdk.inspectTransaction.mockResolvedValue({ ...normal, receiptId: null });
    await expect(runMainnetInspectionProof({}, sdk)).rejects.toThrow();
    sdk.inspectTransaction.mockResolvedValue({
      ...normal,
      logsStatus: "unavailable",
    });
    await expect(runMainnetInspectionProof({}, sdk)).rejects.toThrow();
  });
  it("does not treat discovered bytes as an oracle or accept the wrong network", async () => {
    const sdk = mockSdk();
    const original = sdk.inspectTransaction.getMockImplementation();
    sdk.inspectTransaction.mockImplementation(async (input) => {
      const result = await original(input);
      return {
        ...result,
        candidates: result.candidates.map((c) => ({
          ...c,
          discriminator: "0000000000000000",
        })),
      };
    });
    await expect(runMainnetInspectionProof({}, sdk)).rejects.toThrow();
    sdk.inspectTransaction.mockImplementation(async (input) => ({
      ...(await original(input)),
      cluster: "devnet",
    }));
    await expect(runMainnetInspectionProof({}, sdk)).rejects.toThrow();
  });
  it("fails if a failed transaction verifies or receives a receipt", async () => {
    const sdk = mockSdk();
    const original = sdk.verifyEvent.getMockImplementation();
    sdk.verifyEvent.mockImplementation(async (input) => ({
      ...(await original(input)),
      receiptId: `es_${"b".repeat(64)}`,
    }));
    await expect(runMainnetInspectionProof({}, sdk)).rejects.toThrow();
  });
});
