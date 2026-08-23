import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  DEVNET_GENESIS_HASH,
  EVENT_DISCRIMINATOR,
  PROGRAM_ID,
  buildFixture,
  buildInstructionData,
  parseCliArgs,
  parseDemoEventLogs,
  submitInstruction,
} from "./generate-devnet-fixtures.mjs";

function demoPayload(nonce, discriminator = EVENT_DISCRIMINATOR) {
  const bytes = Buffer.alloc(16);
  Buffer.from(discriminator, "hex").copy(bytes);
  bytes.writeBigUInt64LE(BigInt(nonce), 8);
  return bytes.toString("base64");
}

function logs(payload = demoPayload(42)) {
  return [
    `Program ${PROGRAM_ID} invoke [1]`,
    `Program data: ${payload}`,
    `Program ${PROGRAM_ID} success`,
  ];
}

describe("devnet fixture generator", () => {
  it("pins the canonical Solana devnet genesis hash", () => {
    expect(DEVNET_GENESIS_HASH).toBe(
      "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    );
  });

  it("encodes an Anchor instruction discriminator and u64 nonce", () => {
    const data = Buffer.from(buildInstructionData("emit_success", 42));
    const discriminator = createHash("sha256")
      .update("global:emit_success")
      .digest()
      .subarray(0, 8);

    expect(data).toHaveLength(16);
    expect(data.subarray(0, 8)).toEqual(discriminator);
    expect(data.readBigUInt64LE(8)).toBe(42n);
  });

  it("submits a single instruction as a transaction instruction array", async () => {
    let submittedInstructions;
    const client = {
      sendTransaction: async (instructions) => {
        submittedInstructions = instructions;
        return {
          kind: "single",
          status: "successful",
          context: { signature: "success-signature" },
        };
      },
    };

    await expect(
      submitInstruction(client, "emit_success", 42, false),
    ).resolves.toBe("success-signature");

    expect(submittedInstructions).toHaveLength(1);
    expect(submittedInstructions[0].programAddress).toBe(PROGRAM_ID);
    expect(Buffer.from(submittedInstructions[0].data)).toEqual(
      Buffer.from(buildInstructionData("emit_success", 42)),
    );
  });

  it("attributes and decodes the demo event under the expected program frame", () => {
    expect(parseDemoEventLogs(logs(), 42)).toEqual({
      discriminator: EVENT_DISCRIMINATOR,
      nonce: 42,
    });
  });

  it("rejects matching bytes emitted outside the expected program frame", () => {
    expect(() =>
      parseDemoEventLogs(
        [
          "Program 11111111111111111111111111111111 invoke [1]",
          `Program data: ${demoPayload(42)}`,
          "Program 11111111111111111111111111111111 success",
        ],
        42,
      ),
    ).toThrow("found 0");
  });

  it("rejects a mismatched discriminator or nonce", () => {
    expect(() => parseDemoEventLogs(logs(demoPayload(43)), 42)).toThrow(
      "Expected event nonce 42",
    );
    expect(() =>
      parseDemoEventLogs(logs(demoPayload(42, "0000000000000000")), 42),
    ).toThrow("Unexpected event discriminator");
  });

  it("builds a sanitized fixture with only public evidence", () => {
    const fixture = buildFixture({
      generatedAt: "2026-08-23T00:00:00.000Z",
      success: {
        nonce: 42,
        signature: "success-signature",
        slot: 100,
        transactionSucceeded: true,
      },
      failure: {
        nonce: 43,
        signature: "failure-signature",
        slot: 101,
        transactionSucceeded: false,
      },
    });
    const serialized = JSON.stringify(fixture);

    expect(fixture.event.discriminator).toBe("bf91ff47ac4cb187");
    expect(fixture.transactions.success.expectedVerdict).toBe("verified");
    expect(fixture.transactions.failure.expectedReasonCode).toBe("TX_FAILED");
    expect(serialized).not.toMatch(/keypair|rpc.?url|credential|private/i);
  });

  it("parses operator overrides without requiring source edits", () => {
    const options = parseCliArgs([
      "--keypair",
      "/tmp/operator.json",
      "--rpc-url",
      "https://devnet.example.test",
      "--output",
      "/tmp/fixture.json",
      "--success-nonce",
      "100",
      "--failure-nonce",
      "101",
    ]);

    expect(options).toMatchObject({
      keypair: "/tmp/operator.json",
      rpcUrl: "https://devnet.example.test",
      output: "/tmp/fixture.json",
      successNonce: 100,
      failureNonce: 101,
    });
  });
});
