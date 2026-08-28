import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const fixture = JSON.parse(
  await readFile(
    new URL("../tests/fixtures/mainnet-inspection.json", import.meta.url),
    "utf8",
  ),
);

/** Opt-in, read-only mainnet proof. No transactions are submitted or receipts persisted. */
export async function runMainnetInspectionProof({ rpcUrl } = {}, sdk) {
  sdk ??= await import("../packages/sdk/dist/index.js");
  const inspect = async (entry) => {
    const result = await sdk.inspectTransaction({
      signature: entry.signature,
      cluster: "mainnet-beta",
      ...(rpcUrl ? { rpcUrl } : {}),
    });
    assert.equal(result.kind, "transaction-inspection");
    assert.equal(result.signature, entry.signature);
    assert.equal(result.cluster, "mainnet-beta");
    assert.equal(result.finality, "finalized");
    assert.equal(result.slot, entry.slot);
    assert.equal(Object.hasOwn(result, "receiptId"), false);
    assert.equal(Object.hasOwn(result, "verdict"), false);
    return result;
  };
  const noEvent = await inspect(fixture.noEvent);
  assert.equal(noEvent.execution, "succeeded");
  assert.equal(noEvent.reasonCode, "NO_SUPPORTED_LOG_EVENT");
  assert.equal(noEvent.logsStatus, "available");
  assert.deepEqual(noEvent.candidates, []);
  assert(noEvent.invokedPrograms.includes(fixture.noEvent.programId));

  const supported = await inspect(fixture.supportedEvent);
  assert.equal(supported.execution, "succeeded");
  assert.equal(supported.reasonCode, "CANDIDATES_FOUND");
  assert.equal(supported.logsStatus, "available");
  // Oracle is the published Anchor event definition, never discovered candidate bytes.
  const expectedDiscriminator = createHash("sha256")
    .update("event:SwapEvent")
    .digest("hex")
    .slice(0, 16);
  assert.equal(fixture.supportedEvent.discriminator, expectedDiscriminator);
  const candidates = supported.candidates.filter(
    (c) =>
      c.emitterProgramId === fixture.supportedEvent.programId &&
      c.discriminator === expectedDiscriminator,
  );
  assert.equal(candidates.length, 1);
  const verify = (signature) =>
    sdk.verifyEvent({
      signature,
      cluster: "mainnet-beta",
      expectedProgramId: fixture.supportedEvent.programId,
      event: { format: "anchor-log", discriminator: expectedDiscriminator },
      ...(rpcUrl ? { rpcUrl } : {}),
    });
  const verified = await verify(fixture.supportedEvent.signature);
  assert.equal(verified.verdict, "verified");
  assert.equal(verified.reasonCode, "VERIFIED");
  assert.equal(verified.cluster, "mainnet-beta");
  assert.equal(verified.signature, fixture.supportedEvent.signature);
  assert.equal(verified.slot, fixture.supportedEvent.slot);
  assert.equal(
    verified.event?.emitterProgramId,
    fixture.supportedEvent.programId,
  );
  assert.equal(verified.event?.eventDataHash, candidates[0].eventDataHash);
  assert.match(verified.receiptId, /^es_[0-9a-f]{64}$/);

  const failed = await inspect(fixture.failed);
  assert.equal(failed.execution, "failed");
  assert.equal(failed.reasonCode, "TX_FAILED");
  const rejected = await verify(fixture.failed.signature);
  assert.equal(rejected.verdict, "rejected");
  assert.equal(rejected.reasonCode, "TX_FAILED");
  assert.equal(rejected.receiptId, undefined);
  return {
    checkedAt: new Date().toISOString(),
    cluster: "mainnet-beta",
    transport: "SDK JSON-RPC (not a hosted deployment proof)",
    noEvent: {
      signature: noEvent.signature,
      reasonCode: noEvent.reasonCode,
      slot: noEvent.slot,
    },
    supportedEvent: {
      signature: supported.signature,
      reasonCode: supported.reasonCode,
      slot: supported.slot,
      discriminator: expectedDiscriminator,
      verification: verified.reasonCode,
      receiptId: verified.receiptId,
    },
    failed: {
      signature: failed.signature,
      reasonCode: failed.reasonCode,
      slot: failed.slot,
      verification: rejected.reasonCode,
    },
    inspectionReceiptsIssued: 0,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(
      JSON.stringify(
        await runMainnetInspectionProof({
          rpcUrl: process.env.SOLANA_RPC_MAINNET_URL,
        }),
        null,
        2,
      ),
    );
  } catch {
    console.error(
      "Mainnet inspection proof failed; check RPC availability and the fixture expectations. No transactions were submitted.",
    );
    process.exitCode = 1;
  }
}
