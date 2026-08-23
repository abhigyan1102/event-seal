import { createHash } from "node:crypto";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import { address, createClient } from "@solana/kit";
import { solanaDevnetRpc } from "@solana/kit-plugin-rpc";
import { payerFromFile } from "@solana/kit-plugin-signer";

export const PROGRAM_ID = "AMWm3XHjn6zVygWDX6J7DYPvvwQ6xy3mKKwspWJeuZVS";
export const DEVNET_GENESIS_HASH =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const EVENT_NAME = "DemoEvent";
export const EVENT_FORMAT = "anchor-log";
export const EVENT_DISCRIMINATOR = anchorDiscriminator("event", EVENT_NAME);

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_OUTPUT = "tests/fixtures/devnet-demo.json";
const FINALIZATION_TIMEOUT_MS = 120_000;
const FINALIZATION_POLL_MS = 2_000;

const INSTRUCTIONS = Object.freeze({
  success: {
    name: "emit_success",
    expectedReasonCode: "VERIFIED",
    expectedTransactionSucceeded: true,
    expectedVerdict: "verified",
  },
  failure: {
    name: "emit_then_fail",
    expectedReasonCode: "TX_FAILED",
    expectedTransactionSucceeded: false,
    expectedVerdict: "rejected",
  },
});

export function anchorDiscriminator(namespace, name) {
  return createHash("sha256")
    .update(`${namespace}:${name}`)
    .digest()
    .subarray(0, 8)
    .toString("hex");
}

export function buildInstructionData(name, nonce) {
  assertNonce(nonce, `${name} nonce`);
  const data = Buffer.alloc(16);
  Buffer.from(anchorDiscriminator("global", name), "hex").copy(data, 0);
  data.writeBigUInt64LE(BigInt(nonce), 8);
  return new Uint8Array(data);
}

export function parseDemoEventLogs(logMessages, expectedNonce) {
  if (!Array.isArray(logMessages)) {
    throw new Error("Finalized transaction metadata is missing log messages");
  }

  const programStack = [];
  const payloads = [];

  for (const line of logMessages) {
    const invoke = /^Program (\S+) invoke \[\d+\]$/.exec(line);
    if (invoke) {
      programStack.push(invoke[1]);
      continue;
    }

    const complete = /^Program (\S+) (?:success|failed: .+)$/.exec(line);
    if (complete) {
      if (programStack.at(-1) === complete[1]) {
        programStack.pop();
      }
      continue;
    }

    if (
      line.startsWith("Program data: ") &&
      programStack.at(-1) === PROGRAM_ID
    ) {
      payloads.push(line.slice("Program data: ".length));
    }
  }

  if (payloads.length !== 1) {
    throw new Error(
      `Expected exactly one ${EVENT_NAME} payload from ${PROGRAM_ID}, found ${payloads.length}`,
    );
  }

  const bytes = Buffer.from(payloads[0], "base64");
  if (bytes.length !== 16) {
    throw new Error(
      `Expected a 16-byte ${EVENT_NAME} payload, received ${bytes.length} bytes`,
    );
  }

  const discriminator = bytes.subarray(0, 8).toString("hex");
  const nonce = bytes.readBigUInt64LE(8);
  if (discriminator !== EVENT_DISCRIMINATOR) {
    throw new Error(`Unexpected event discriminator ${discriminator}`);
  }
  if (nonce !== BigInt(expectedNonce)) {
    throw new Error(`Expected event nonce ${expectedNonce}, received ${nonce}`);
  }

  return { discriminator, nonce: Number(nonce) };
}

export function buildFixture({ generatedAt, success, failure }) {
  validateEvidence(success, INSTRUCTIONS.success);
  validateEvidence(failure, INSTRUCTIONS.failure);

  return {
    schemaVersion: 1,
    generatedAt,
    cluster: "devnet",
    programId: PROGRAM_ID,
    event: {
      name: EVENT_NAME,
      format: EVENT_FORMAT,
      discriminator: EVENT_DISCRIMINATOR,
      schema: { nonce: "u64" },
    },
    transactions: {
      success: fixtureTransaction(success, INSTRUCTIONS.success),
      failure: fixtureTransaction(failure, INSTRUCTIONS.failure),
    },
  };
}

function fixtureTransaction(evidence, instruction) {
  return {
    instruction: instruction.name,
    nonce: evidence.nonce,
    signature: evidence.signature,
    slot: evidence.slot,
    transactionSucceeded: evidence.transactionSucceeded,
    expectedVerdict: instruction.expectedVerdict,
    expectedReasonCode: instruction.expectedReasonCode,
  };
}

function validateEvidence(evidence, instruction) {
  assertNonce(evidence.nonce, `${instruction.name} nonce`);
  if (
    typeof evidence.signature !== "string" ||
    evidence.signature.length === 0
  ) {
    throw new Error(`${instruction.name} is missing a transaction signature`);
  }
  if (!Number.isSafeInteger(evidence.slot) || evidence.slot < 0) {
    throw new Error(`${instruction.name} has an invalid slot`);
  }
  if (
    evidence.transactionSucceeded !== instruction.expectedTransactionSucceeded
  ) {
    throw new Error(
      `${instruction.name} finalized with the wrong transaction state`,
    );
  }
}

function assertNonce(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

export function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      keypair: { type: "string" },
      "rpc-url": { type: "string" },
      output: { type: "string", short: "o" },
      "success-nonce": { type: "string" },
      "failure-nonce": { type: "string" },
    },
  });

  return {
    help: values.help ?? false,
    keypair: resolve(values.keypair ?? `${homedir()}/.config/solana/id.json`),
    rpcUrl: values["rpc-url"] ?? DEFAULT_RPC_URL,
    output: resolve(values.output ?? DEFAULT_OUTPUT),
    successNonce: parseNonce(values["success-nonce"] ?? "42", "success nonce"),
    failureNonce: parseNonce(values["failure-nonce"] ?? "43", "failure nonce"),
  };
}

function parseNonce(raw, label) {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  const nonce = Number(raw);
  assertNonce(nonce, label);
  return nonce;
}

async function assertSecureKeypair(path) {
  const metadata = await stat(path);
  if (!metadata.isFile()) {
    throw new Error(`Keypair path is not a regular file: ${path}`);
  }
  if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
    throw new Error(
      `Keypair permissions are too broad; run: chmod 600 ${path}`,
    );
  }
}

async function createRpcClient({ keypair, rpcUrl, skipPreflight }) {
  return await createClient()
    .use(payerFromFile(keypair))
    .use(solanaDevnetRpc({ rpcUrl, skipPreflight }));
}

async function assertDevnet(client) {
  const genesisHash = await client.rpc.getGenesisHash().send();
  if (genesisHash !== DEVNET_GENESIS_HASH) {
    throw new Error(
      `RPC endpoint is not Solana devnet (genesis hash: ${genesisHash})`,
    );
  }

  const { value: program } = await client.rpc
    .getAccountInfo(address(PROGRAM_ID), { commitment: "finalized" })
    .send();
  if (!program?.executable) {
    throw new Error(`Demo program ${PROGRAM_ID} is not executable on devnet`);
  }
}

async function submitInstruction(client, instruction, nonce, expectFailure) {
  let result;
  try {
    result = await client.sendTransaction({
      programAddress: address(PROGRAM_ID),
      data: buildInstructionData(instruction, nonce),
    });
  } catch (error) {
    if (!expectFailure) {
      throw error;
    }
    result = error?.context?.transactionPlanResult;
    if (!result) {
      throw error;
    }
  }

  if (result.kind !== "single") {
    throw new Error(
      `${instruction} unexpectedly produced a multi-transaction result`,
    );
  }
  if (!expectFailure && result.status !== "successful") {
    throw new Error(
      `${instruction} submission failed: ${result.error?.message ?? result.status}`,
    );
  }
  if (expectFailure && result.status !== "failed") {
    throw new Error(`${instruction} unexpectedly completed successfully`);
  }

  const signature = result.context.signature;
  if (typeof signature !== "string" || signature.length === 0) {
    throw new Error(`${instruction} did not produce a transaction signature`);
  }
  return signature;
}

async function waitForFinalizedTransaction(client, signature) {
  const deadline = Date.now() + FINALIZATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { value } = await client.rpc
      .getSignatureStatuses([signature], { searchTransactionHistory: true })
      .send();
    if (value[0]?.confirmationStatus === "finalized") {
      const transaction = await client.rpc
        .getTransaction(signature, {
          commitment: "finalized",
          encoding: "json",
          maxSupportedTransactionVersion: 0,
        })
        .send();
      if (transaction) {
        return transaction;
      }
    }
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, FINALIZATION_POLL_MS),
    );
  }
  throw new Error(`Timed out waiting for finalized transaction ${signature}`);
}

async function captureEvidence(
  client,
  signature,
  nonce,
  expectedTransactionSucceeded,
) {
  const transaction = await waitForFinalizedTransaction(client, signature);
  const transactionSucceeded = transaction.meta?.err == null;
  if (transactionSucceeded !== expectedTransactionSucceeded) {
    throw new Error(
      `Transaction ${signature} finalized with an unexpected ${
        transactionSucceeded ? "success" : "failure"
      } state`,
    );
  }

  parseDemoEventLogs(transaction.meta?.logMessages, nonce);
  return {
    nonce,
    signature,
    slot: Number(transaction.slot),
    transactionSucceeded,
  };
}

async function writeFixture(output, fixture) {
  await mkdir(dirname(output), { recursive: true });
  const temporaryPath = `${output}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(fixture, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o644,
  });
  await rename(temporaryPath, output);
}

export async function generateDevnetFixture(options) {
  await assertSecureKeypair(options.keypair);

  const successClient = await createRpcClient({
    ...options,
    skipPreflight: false,
  });
  await assertDevnet(successClient);
  const failureClient = await createRpcClient({
    ...options,
    skipPreflight: true,
  });

  const successSignature = await submitInstruction(
    successClient,
    INSTRUCTIONS.success.name,
    options.successNonce,
    false,
  );
  const success = await captureEvidence(
    successClient,
    successSignature,
    options.successNonce,
    true,
  );

  const failureSignature = await submitInstruction(
    failureClient,
    INSTRUCTIONS.failure.name,
    options.failureNonce,
    true,
  );
  const failure = await captureEvidence(
    failureClient,
    failureSignature,
    options.failureNonce,
    false,
  );

  const fixture = buildFixture({
    generatedAt: new Date().toISOString(),
    success,
    failure,
  });
  await writeFixture(options.output, fixture);
  return fixture;
}

function printHelp() {
  console.log(`Generate EventSeal's public devnet transaction fixture.

Usage:
  npm run fixtures:devnet -- [options]

Options:
  --keypair <path>       Fee-payer keypair (default: ~/.config/solana/id.json)
  --rpc-url <url>        Devnet RPC endpoint (default: public Solana devnet)
  -o, --output <path>    Fixture output (default: ${DEFAULT_OUTPUT})
  --success-nonce <n>    emit_success nonce (default: 42)
  --failure-nonce <n>    emit_then_fail nonce (default: 43)
  -h, --help             Show this help

The fixture contains only public transaction evidence. Keypair bytes, keypair
paths, RPC URLs, and RPC credentials are never written to it.`);
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  console.log(`Submitting ${INSTRUCTIONS.success.name} to Solana devnet...`);
  console.log(
    `Submitting ${INSTRUCTIONS.failure.name} with preflight disabled...`,
  );
  const fixture = await generateDevnetFixture(options);
  console.log(`Wrote sanitized fixture: ${options.output}`);
  console.log(`Success signature: ${fixture.transactions.success.signature}`);
  console.log(`Failure signature: ${fixture.transactions.failure.signature}`);
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
