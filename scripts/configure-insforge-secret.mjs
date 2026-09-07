import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_SECRET_BYTES = 16 * 1024;
const SECRET_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;

export function parseSecretCommand(argv) {
  const [action, key, ...extra] = argv;
  if (
    extra.length > 0 ||
    (action !== "add" && action !== "update") ||
    typeof key !== "string" ||
    !SECRET_KEY_PATTERN.test(key)
  ) {
    throw new Error(
      "Usage: node scripts/configure-insforge-secret.mjs <add|update> <SECRET_KEY>",
    );
  }

  return { action, key };
}

export function normalizeSecretInput(input) {
  const value = input.replace(/\r?\n$/, "");
  if (
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > MAX_SECRET_BYTES ||
    /[\0\r\n]/.test(value)
  ) {
    throw new Error("Secret input must be one non-empty line up to 16 KiB.");
  }
  return value;
}

export async function configureInsforgeSecret(
  { action, key, value, projectConfig },
  fetchFn = fetch,
) {
  const host = readRequiredConfig(projectConfig, "oss_host");
  const apiKey = readRequiredConfig(projectConfig, "api_key");
  const endpoint =
    action === "add"
      ? new URL("/api/secrets", host)
      : new URL(`/api/secrets/${encodeURIComponent(key)}`, host);
  const body = action === "add" ? { key, value } : { value };

  const response = await fetchFn(endpoint, {
    method: action === "add" ? "POST" : "PUT",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `InsForge secret ${action} failed with HTTP ${response.status}.`,
    );
  }
}

function readRequiredConfig(config, key) {
  const value = config?.[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Linked InsForge configuration is missing the required ${key} field.`,
    );
  }
  return value;
}

async function readSecretFromStdin() {
  process.stdin.setEncoding("utf8");
  let input = "";

  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input, "utf8") > MAX_SECRET_BYTES + 2) {
      throw new Error("Secret input exceeds 16 KiB.");
    }
  }

  return normalizeSecretInput(input);
}

async function main() {
  const { action, key } = parseSecretCommand(process.argv.slice(2));
  const value = await readSecretFromStdin();
  const projectConfig = JSON.parse(
    await readFile(resolve(".insforge/project.json"), "utf8"),
  );

  await configureInsforgeSecret({ action, key, value, projectConfig });
  process.stdout.write(`InsForge secret ${key} ${action} completed.\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
