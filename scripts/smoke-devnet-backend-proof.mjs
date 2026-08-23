import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

const DEFAULT_FIXTURE = "tests/fixtures/devnet-demo.json";
const RECEIPT_ID_PATTERN = /^es_[0-9a-f]{64}$/;

export function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      "base-url": { type: "string" },
      fixture: { type: "string" },
      output: { type: "string", short: "o" },
    },
  });

  return {
    help: values.help ?? false,
    baseUrl: values["base-url"] ?? process.env.INSFORGE_BASE_URL,
    fixture: resolve(values.fixture ?? DEFAULT_FIXTURE),
    output: values.output === undefined ? undefined : resolve(values.output),
  };
}

export function buildVerifyInput(fixture, transaction) {
  return {
    signature: transaction.signature,
    cluster: fixture.cluster,
    expectedProgramId: fixture.programId,
    event: {
      format: fixture.event.format,
      discriminator: fixture.event.discriminator,
    },
    commitment: "finalized",
  };
}

export async function runBackendProofSmoke(options, fetchFn = fetch) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fixture = await readFixture(options.fixture);

  validateFixture(fixture);

  const successFixture = fixture.transactions.success;
  const failureFixture = fixture.transactions.failure;
  const success = await invokeVerification(
    fetchFn,
    baseUrl,
    buildVerifyInput(fixture, successFixture),
  );

  assertVerificationResult("success transaction", success, {
    fixture,
    transaction: successFixture,
    requireReceipt: true,
  });

  const receipt = await fetchReceipt(fetchFn, baseUrl, success.receiptId);
  assertReceipt(receipt, success);

  const failure = await invokeVerification(
    fetchFn,
    baseUrl,
    buildVerifyInput(fixture, failureFixture),
  );

  assertVerificationResult("failed transaction", failure, {
    fixture,
    transaction: failureFixture,
    requireReceipt: false,
  });

  const proof = buildProof({ fixture, receipt, success, failure });
  if (options.output) {
    await writeProof(options.output, proof);
  }
  return proof;
}

function normalizeBaseUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Set INSFORGE_BASE_URL or pass --base-url.");
  }
  return value.replace(/\/+$/, "");
}

async function readFixture(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

function validateFixture(fixture) {
  if (!isRecord(fixture)) throw new Error("Fixture must be a JSON object");
  if (fixture.cluster !== "devnet") {
    throw new Error("Backend proof smoke only accepts the devnet fixture");
  }
  if (!isNonEmptyString(fixture.programId)) {
    throw new Error("Fixture is missing programId");
  }
  if (!isRecord(fixture.event)) throw new Error("Fixture is missing event");
  if (fixture.event.format !== "anchor-log") {
    throw new Error("Backend proof smoke only supports anchor-log events");
  }
  if (!/^[0-9a-f]{16}$/.test(fixture.event.discriminator)) {
    throw new Error("Fixture event discriminator must be 16 lowercase hex");
  }
  validateTransactionFixture(fixture.transactions?.success, "success");
  validateTransactionFixture(fixture.transactions?.failure, "failure");
}

function validateTransactionFixture(transaction, label) {
  if (!isRecord(transaction)) {
    throw new Error(`Fixture is missing ${label} transaction`);
  }
  if (!isNonEmptyString(transaction.signature)) {
    throw new Error(`${label} transaction is missing signature`);
  }
  if (!Number.isSafeInteger(transaction.slot) || transaction.slot < 0) {
    throw new Error(`${label} transaction has an invalid slot`);
  }
  if (!isNonEmptyString(transaction.expectedVerdict)) {
    throw new Error(`${label} transaction is missing expectedVerdict`);
  }
  if (!isNonEmptyString(transaction.expectedReasonCode)) {
    throw new Error(`${label} transaction is missing expectedReasonCode`);
  }
}

async function invokeVerification(fetchFn, baseUrl, input) {
  return await requestJson(fetchFn, `${baseUrl}/functions/verify-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function fetchReceipt(fetchFn, baseUrl, receiptId) {
  return await requestJson(
    fetchFn,
    `${baseUrl}/functions/get-receipt?receiptId=${encodeURIComponent(receiptId)}`,
    { method: "GET" },
  );
}

async function requestJson(fetchFn, url, init) {
  const response = await fetchFn(url, init);
  const body = await readJsonBody(response);
  if (!response.ok) {
    const detail =
      isRecord(body) && typeof body.error === "string" ? `: ${body.error}` : "";
    throw new Error(
      `${init.method} ${url} failed with ${response.status}${detail}`,
    );
  }
  return body;
}

async function readJsonBody(response) {
  try {
    return await response.json();
  } catch {
    throw new Error("Backend response must be valid JSON");
  }
}

function assertVerificationResult(label, result, options) {
  const { fixture, requireReceipt, transaction } = options;
  if (!isRecord(result)) throw new Error(`${label} returned a non-object body`);
  assertEqual(result.signature, transaction.signature, `${label} signature`);
  assertEqual(result.cluster, fixture.cluster, `${label} cluster`);
  assertEqual(
    result.expectedProgramId,
    fixture.programId,
    `${label} expectedProgramId`,
  );
  assertEqual(result.slot, transaction.slot, `${label} slot`);
  assertEqual(result.verdict, transaction.expectedVerdict, `${label} verdict`);
  assertEqual(
    result.reasonCode,
    transaction.expectedReasonCode,
    `${label} reasonCode`,
  );

  if (requireReceipt) {
    if (
      typeof result.receiptId !== "string" ||
      !RECEIPT_ID_PATTERN.test(result.receiptId)
    ) {
      throw new Error(`${label} did not return a valid receiptId`);
    }
    return;
  }

  if (result.verdict === "verified" || result.receiptId !== undefined) {
    throw new Error(`${label} must not produce a verified receipt`);
  }
}

function assertReceipt(receipt, verification) {
  if (!isRecord(receipt)) {
    throw new Error("Receipt lookup returned a non-object body");
  }
  assertEqual(receipt.receipt_id, verification.receiptId, "receipt_id");
  assertEqual(receipt.signature, verification.signature, "receipt signature");
  assertEqual(receipt.cluster, verification.cluster, "receipt cluster");
  assertEqual(Number(receipt.slot), verification.slot, "receipt slot");
  assertEqual(receipt.verdict, verification.verdict, "receipt verdict");
  assertEqual(
    receipt.reason_code,
    verification.reasonCode,
    "receipt reason_code",
  );
}

function buildProof({ fixture, receipt, success, failure }) {
  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    cluster: fixture.cluster,
    programId: fixture.programId,
    event: {
      format: fixture.event.format,
      discriminator: fixture.event.discriminator,
    },
    sourceFixture: "tests/fixtures/devnet-demo.json",
    transactions: {
      success: {
        signature: success.signature,
        slot: success.slot,
        verdict: success.verdict,
        reasonCode: success.reasonCode,
        receiptId: success.receiptId,
        receiptLookup: {
          receiptId: receipt.receipt_id,
          verdict: receipt.verdict,
          reasonCode: receipt.reason_code,
        },
      },
      failure: {
        signature: failure.signature,
        slot: failure.slot,
        verdict: failure.verdict,
        reasonCode: failure.reasonCode,
        receiptId: null,
      },
    },
  };
}

async function writeProof(output, proof) {
  await mkdir(dirname(output), { recursive: true });
  const temporaryPath = `${output}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(proof, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o644,
  });
  await rename(temporaryPath, output);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label} mismatch: expected ${expected}, received ${actual}`,
    );
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function printHelp() {
  console.log(`Run EventSeal's live devnet backend proof smoke.

Usage:
  npm run smoke:devnet-backend -- [options]

Options:
  --base-url <url>   Public InsForge base URL. Defaults to INSFORGE_BASE_URL.
  --fixture <path>   Devnet fixture JSON. Defaults to ${DEFAULT_FIXTURE}.
  -o, --output       Optional sanitized proof JSON output path.
  -h, --help         Show this help text.

The command invokes verify-event, fetches the stored receipt with get-receipt,
and verifies the failed transaction is rejected without producing a receipt.
It never reads or writes wallet keypairs, admin API keys, RPC URLs, or secrets.`);
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const proof = await runBackendProofSmoke(options);
  console.log(JSON.stringify(proof, null, 2));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
