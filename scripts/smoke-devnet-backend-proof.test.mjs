import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildVerifyInput,
  parseCliArgs,
  runBackendProofSmoke,
} from "./smoke-devnet-backend-proof.mjs";

const receiptId = `es_${"a".repeat(64)}`;

const fixture = {
  schemaVersion: 1,
  generatedAt: "2026-08-23T00:00:00.000Z",
  cluster: "devnet",
  programId: "AMWm3XHjn6zVygWDX6J7DYPvvwQ6xy3mKKwspWJeuZVS",
  event: {
    name: "DemoEvent",
    format: "anchor-log",
    discriminator: "bf91ff47ac4cb187",
    schema: { nonce: "u64" },
  },
  transactions: {
    success: {
      instruction: "emit_success",
      nonce: 42,
      signature: "success-signature",
      slot: 100,
      transactionSucceeded: true,
      expectedVerdict: "verified",
      expectedReasonCode: "VERIFIED",
    },
    failure: {
      instruction: "emit_then_fail",
      nonce: 43,
      signature: "failure-signature",
      slot: 101,
      transactionSucceeded: false,
      expectedVerdict: "rejected",
      expectedReasonCode: "TX_FAILED",
    },
  },
};

async function writeFixture(value = fixture) {
  const directory = await mkdtemp(join(tmpdir(), "eventseal-backend-proof-"));
  const path = join(directory, "fixture.json");
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  return { directory, path };
}

function verificationResponse(transaction, receipt = undefined) {
  return {
    verdict: transaction.expectedVerdict,
    reasonCode: transaction.expectedReasonCode,
    reason: "test",
    signature: transaction.signature,
    cluster: fixture.cluster,
    commitment: "finalized",
    slot: transaction.slot,
    expectedProgramId: fixture.programId,
    receiptId: receipt,
    evidence: [],
  };
}

function receiptResponse(verification) {
  return {
    receipt_id: verification.receiptId,
    signature: verification.signature,
    cluster: verification.cluster,
    slot: verification.slot,
    verdict: verification.verdict,
    reason_code: verification.reasonCode,
  };
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("devnet backend proof smoke", () => {
  it("builds hosted verify-event input from the public fixture", () => {
    expect(buildVerifyInput(fixture, fixture.transactions.success)).toEqual({
      signature: "success-signature",
      cluster: "devnet",
      expectedProgramId: fixture.programId,
      event: {
        format: "anchor-log",
        discriminator: "bf91ff47ac4cb187",
      },
      commitment: "finalized",
    });
  });

  it("proves the success receipt and failed transaction rejection", async () => {
    const { path } = await writeFixture();
    const success = verificationResponse(
      fixture.transactions.success,
      receiptId,
    );
    const failure = verificationResponse(fixture.transactions.failure);
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ init, url });
      if (url.endsWith("/functions/verify-event")) {
        const input = JSON.parse(init.body);
        return response(
          input.signature === "success-signature" ? success : failure,
        );
      }
      return response(receiptResponse(success));
    };

    const proof = await runBackendProofSmoke(
      { baseUrl: "https://eventseal.test/", fixture: path },
      fetchFn,
    );

    expect(calls.map((call) => call.url)).toEqual([
      "https://eventseal.test/functions/verify-event",
      `https://eventseal.test/functions/get-receipt?receiptId=${receiptId}`,
      "https://eventseal.test/functions/verify-event",
    ]);
    expect(proof.transactions.success).toMatchObject({
      signature: "success-signature",
      verdict: "verified",
      reasonCode: "VERIFIED",
      receiptId,
    });
    expect(proof.transactions.failure).toMatchObject({
      signature: "failure-signature",
      verdict: "rejected",
      reasonCode: "TX_FAILED",
      receiptId: null,
    });
    expect(JSON.stringify(proof)).not.toMatch(
      /keypair|api.?key|secret|private|rpc.?url|credential/i,
    );
  });

  it("writes only sanitized public proof metadata when output is requested", async () => {
    const { directory, path } = await writeFixture();
    const output = join(directory, "nested", "proof.json");
    const success = verificationResponse(
      fixture.transactions.success,
      receiptId,
    );
    const failure = verificationResponse(fixture.transactions.failure);
    const fetchFn = async (url, init) => {
      if (url.endsWith("/functions/verify-event")) {
        return response(
          JSON.parse(init.body).signature === "success-signature"
            ? success
            : failure,
        );
      }
      return response(receiptResponse(success));
    };

    await mkdir(join(directory, "nested"));
    await runBackendProofSmoke(
      { baseUrl: "https://eventseal.test", fixture: path, output },
      fetchFn,
    );

    const proof = JSON.parse(await readFile(output, "utf8"));
    expect(proof.transactions.success.receiptId).toBe(receiptId);
    expect(JSON.stringify(proof)).not.toMatch(
      /keypair|api.?key|secret|private|rpc.?url|credential/i,
    );
  });

  it("rejects a failed transaction that verifies or returns a receipt", async () => {
    const { path } = await writeFixture();
    const success = verificationResponse(
      fixture.transactions.success,
      receiptId,
    );
    const badFailure = {
      ...verificationResponse(
        fixture.transactions.failure,
        `es_${"b".repeat(64)}`,
      ),
      verdict: "verified",
      reasonCode: "VERIFIED",
    };
    const fetchFn = async (url, init) => {
      if (url.endsWith("/functions/verify-event")) {
        return response(
          JSON.parse(init.body).signature === "success-signature"
            ? success
            : badFailure,
        );
      }
      return response(receiptResponse(success));
    };

    await expect(
      runBackendProofSmoke(
        { baseUrl: "https://eventseal.test", fixture: path },
        fetchFn,
      ),
    ).rejects.toThrow("failed transaction verdict mismatch");
  });

  it("surfaces receipt lookup mismatches", async () => {
    const { path } = await writeFixture();
    const success = verificationResponse(
      fixture.transactions.success,
      receiptId,
    );
    const failure = verificationResponse(fixture.transactions.failure);
    const fetchFn = async (url, init) => {
      if (url.endsWith("/functions/verify-event")) {
        return response(
          JSON.parse(init.body).signature === "success-signature"
            ? success
            : failure,
        );
      }
      return response({
        ...receiptResponse(success),
        receipt_id: `es_${"b".repeat(64)}`,
      });
    };

    await expect(
      runBackendProofSmoke(
        { baseUrl: "https://eventseal.test", fixture: path },
        fetchFn,
      ),
    ).rejects.toThrow("receipt_id mismatch");
  });

  it("parses CLI overrides", () => {
    const options = parseCliArgs([
      "--base-url",
      "https://eventseal.test",
      "--fixture",
      "/tmp/fixture.json",
      "--output",
      "/tmp/proof.json",
    ]);

    expect(options).toMatchObject({
      baseUrl: "https://eventseal.test",
      fixture: "/tmp/fixture.json",
      output: "/tmp/proof.json",
    });
  });
});
