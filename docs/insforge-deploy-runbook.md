# InsForge deploy runbook

This runbook documents how an operator deploys the EventSeal receipt database
and hosted InsForge functions from a clean checkout. It intentionally records
commands and non-secret outputs only. Do not commit `.env`, `.insforge`, CLI
auth material, API keys, webhook secrets, private planning notes, or screenshots
containing credentials.

## Scope

When deploying, operate on these public backend artifacts:

- Migration: `migrations/20260721000000_create-verification-receipts.sql`
- Function: `verify-event`
- Function: `get-receipt`
- Function: `helius-webhook`
- Function: `inspect-transaction` (read-only, no database credentials)

The deployment operator owns interactive CLI login, project linking, secret
configuration, migration apply, function deploy, and any Helius dashboard
changes from their local terminal.

## Prerequisites

- Node.js and npm installed.
- `npm install` has completed.
- `npm run check` passes locally before deployment.
- Access to the intended InsForge project.
- Optional per-network Solana RPC endpoints. Otherwise the SDK uses the selected
  cluster's public endpoint.
- A generated webhook secret for Helius. Use a random secret; do not reuse an
  API key.

Use the InsForge CLI through `npx`:

```bash
npx @insforge/cli current
npx @insforge/cli whoami
```

If the CLI is not authenticated or the checkout is not linked, run the
interactive setup from your own terminal:

```bash
npx @insforge/cli login
npx @insforge/cli link
```

## Server environment

Configure these server-only values in the InsForge project before invoking the
functions. Per-network RPC settings are optional but recommended for deployments
that should avoid public cluster RPC defaults. Migrate an existing `SOLANA_RPC_URL`
to the appropriate network-specific key before deploying, or add the explicit
`SOLANA_RPC_CLUSTER` binding. An unbound legacy URL fails closed.

| Name                                    | Used by                                                 | Notes                                                                          |
| --------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `INSFORGE_BASE_URL`                     | `verify-event`, `get-receipt`, `helius-webhook`         | Required server-side project URL.                                              |
| `INSFORGE_API_KEY`                      | `verify-event`, `get-receipt`, `helius-webhook`         | Required server-only administrative key for receipt persistence.               |
| `SOLANA_RPC_MAINNET_URL`                | `inspect-transaction`, `verify-event`, `helius-webhook` | Optional mainnet-beta RPC only.                                                |
| `SOLANA_RPC_DEVNET_URL`                 | `inspect-transaction`, `verify-event`, `helius-webhook` | Optional devnet RPC only.                                                      |
| `SOLANA_RPC_TESTNET_URL`                | `inspect-transaction`, `verify-event`, `helius-webhook` | Optional testnet RPC only.                                                     |
| `SOLANA_RPC_URL` + `SOLANA_RPC_CLUSTER` | Same three functions                                    | Legacy pair: used only for the named cluster if no specific URL is configured. |
| `EVENTSEAL_CLUSTER`                     | `helius-webhook`                                        | Required `mainnet-beta`, `devnet`, or `testnet`; devnet is the current target. |
| `EVENTSEAL_EXPECTED_PROGRAM_ID`         | `helius-webhook`                                        | Required program expected to emit the verified event.                          |
| `EVENTSEAL_EVENT_FORMAT`                | `helius-webhook`                                        | Required `anchor-log` for hosted webhook receipt deployment.                   |
| `EVENTSEAL_EVENT_DISCRIMINATOR`         | `helius-webhook`                                        | Required sixteen lowercase hex characters.                                     |
| `EVENTSEAL_WEBHOOK_SECRET`              | `helius-webhook`                                        | Required shared secret in `X-EventSeal-Webhook-Secret`.                        |

Anchor CPI events are intentionally not listed as a deployable webhook receipt
format yet. The current verifier fails closed for `anchor-cpi` with
`CPI_EVENT_UNSUPPORTED`, so configuring `EVENTSEAL_EVENT_FORMAT=anchor-cpi`
cannot produce verified receipts.

List configured secret keys without printing values:

```bash
npx @insforge/cli secrets list
```

For initial setup, add missing secrets from your terminal. Do not paste real
values into a PR, issue, chat, or screenshot:

```bash
npx @insforge/cli secrets add INSFORGE_BASE_URL <project-url>
npx @insforge/cli secrets add INSFORGE_API_KEY <server-api-key>
npx @insforge/cli secrets add EVENTSEAL_CLUSTER devnet
npx @insforge/cli secrets add EVENTSEAL_EXPECTED_PROGRAM_ID <program-id>
npx @insforge/cli secrets add EVENTSEAL_EVENT_FORMAT anchor-log
npx @insforge/cli secrets add EVENTSEAL_EVENT_DISCRIMINATOR <16-hex-discriminator>
npx @insforge/cli secrets add EVENTSEAL_WEBHOOK_SECRET <random-webhook-secret>
```

Add the optional deployment-owned RPC endpoint when the deployment should avoid
public cluster RPC defaults:

```bash
npx @insforge/cli secrets add SOLANA_RPC_DEVNET_URL <devnet-rpc-url>
npx @insforge/cli secrets add SOLANA_RPC_MAINNET_URL <mainnet-rpc-url>
```

For secret rotation or existing keys, update values explicitly:

```bash
npx @insforge/cli secrets update INSFORGE_BASE_URL --value <project-url>
npx @insforge/cli secrets update INSFORGE_API_KEY --value <server-api-key>
npx @insforge/cli secrets update SOLANA_RPC_DEVNET_URL --value <devnet-rpc-url>
npx @insforge/cli secrets update EVENTSEAL_CLUSTER --value devnet
npx @insforge/cli secrets update EVENTSEAL_EXPECTED_PROGRAM_ID --value <program-id>
npx @insforge/cli secrets update EVENTSEAL_EVENT_FORMAT --value anchor-log
npx @insforge/cli secrets update EVENTSEAL_EVENT_DISCRIMINATOR --value <16-hex-discriminator>
npx @insforge/cli secrets update EVENTSEAL_WEBHOOK_SECRET --value <random-webhook-secret>
```

## Preflight

Run all preflight checks before touching the remote backend:

```bash
git status --short
npm run check
npx @insforge/cli current
npx @insforge/cli db migrations list
npx @insforge/cli functions list
npx @insforge/cli secrets list
```

Expected local result:

- `git status --short` prints nothing.
- `npm run check` completes successfully.
- `current` shows the intended linked project.
- `db migrations list` is reachable.
- `functions list` is reachable.
- `secrets list` shows keys only, not values.

## Build deployable functions

Build the SDK, web app, and bundled function files:

```bash
npm run build
```

Confirm these generated files exist:

```text
functions/dist/verify-event.js
functions/dist/get-receipt.js
functions/dist/helius-webhook.js
functions/dist/inspect-transaction.js
```

Record the source revision and bundle checksums before deployment:

```bash
git rev-parse HEAD
node -e '
const { createHash } = require("node:crypto");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

for (const file of readdirSync("functions/dist").filter((name) => name.endsWith(".js")).sort()) {
  const path = join("functions/dist", file);
  const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
  console.log(`${hash}  ${path}`);
}
'
```

The generated `functions/dist` files are build artifacts and are not committed.

## Apply database migrations

Apply all pending migrations in order:

```bash
npx @insforge/cli db migrations up --all
```

Then confirm the migration appears in remote history:

```bash
npx @insforge/cli db migrations list
```

The receipt migration creates `public.verification_receipts`, enables RLS,
allows public read access, and keeps writes server-only through the InsForge
admin client.

## Deploy functions

Deploy the bundled handlers:

```bash
npx @insforge/cli functions deploy verify-event --file functions/dist/verify-event.js
npx @insforge/cli functions deploy get-receipt --file functions/dist/get-receipt.js
npx @insforge/cli functions deploy helius-webhook --file functions/dist/helius-webhook.js
npx @insforge/cli functions deploy inspect-transaction --file functions/dist/inspect-transaction.js
```

Check that all four functions are active:

```bash
npx @insforge/cli functions list
```

## Smoke checks

Run smoke checks with non-secret sample data. Replace placeholders locally.

Define assertion helpers once per smoke-check session:

```bash
assert_status() {
  expected_status="$1"
  output_file="$2"
  shift 2

  status=$(curl -sS -o "$output_file" -w "%{http_code}" "$@")
  cat "$output_file"
  test "$status" = "$expected_status"
}

assert_json_field() {
  file="$1"
  path="$2"
  expected="$3"

  node -e '
const { readFileSync } = require("node:fs");
const body = JSON.parse(readFileSync(process.argv[1], "utf8"));
const value = process.argv[2].split(".").reduce((acc, key) => acc?.[key], body);
if (value !== process.argv[3]) process.exit(1);
' "$file" "$path" "$expected"
}
```

Verify CORS preflight:

```bash
CORS_BODY=$(mktemp)
assert_status 204 "$CORS_BODY" \
  -X OPTIONS "<INSFORGE_BASE_URL>/functions/verify-event" \
  -H "Origin: https://<frontend-origin>" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

Verify request validation without touching Solana RPC:

```bash
VALIDATION_BODY=$(mktemp)
assert_status 400 "$VALIDATION_BODY" \
  -X POST "<INSFORGE_BASE_URL>/functions/verify-event" \
  -H "Content-Type: application/json" \
  -d '{}'

assert_json_field "$VALIDATION_BODY" error "signature must be a non-empty string"
```

Expected validation response:

```json
{ "error": "signature must be a non-empty string" }
```

Check receipt lookup validation:

```bash
RECEIPT_VALIDATION_BODY=$(mktemp)
assert_status 400 "$RECEIPT_VALIDATION_BODY" \
  "<INSFORGE_BASE_URL>/functions/get-receipt"

assert_json_field "$RECEIPT_VALIDATION_BODY" error "receiptId is required"
```

Expected validation response:

```json
{ "error": "receiptId is required" }
```

Check webhook authentication:

```bash
WEBHOOK_AUTH_BODY=$(mktemp)
assert_status 401 "$WEBHOOK_AUTH_BODY" \
  -X POST "<INSFORGE_BASE_URL>/functions/helius-webhook" \
  -H "Content-Type: application/json" \
  -d '[]'

assert_json_field "$WEBHOOK_AUTH_BODY" error Unauthorized
```

Expected response without the shared secret:

```json
{ "error": "Unauthorized" }
```

Run a positive smoke only after you have a finalized devnet transaction fixture.
Capture the response so the same receipt can be read back through `get-receipt`:

```bash
VERIFY_BODY=$(mktemp)
assert_status 200 "$VERIFY_BODY" \
  -X POST "<INSFORGE_BASE_URL>/functions/verify-event" \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "<finalized-devnet-signature>",
    "cluster": "devnet",
    "expectedProgramId": "<program-id>",
    "event": {
      "format": "anchor-log",
      "discriminator": "<16-hex-discriminator>"
    }
  }'

assert_json_field "$VERIFY_BODY" verdict verified

RECEIPT_ID=$(node -e '
const { readFileSync } = require("node:fs");
const response = JSON.parse(readFileSync(process.argv[1], "utf8"));
if (response.verdict !== "verified" || typeof response.receiptId !== "string") {
  process.exit(1);
}
process.stdout.write(response.receiptId);
' "$VERIFY_BODY")

RECEIPT_BODY=$(mktemp)
assert_status 200 "$RECEIPT_BODY" \
  "<INSFORGE_BASE_URL>/functions/get-receipt?receiptId=${RECEIPT_ID}"

RECEIPT_ID="$RECEIPT_ID" node -e '
const { readFileSync } = require("node:fs");
const receipt = JSON.parse(readFileSync(process.argv[1], "utf8"));
if (receipt.receipt_id !== process.env.RECEIPT_ID) process.exit(1);
' "$RECEIPT_BODY"
```

Acceptance target for a known-good fixture:

```json
{ "verdict": "verified" }
```

The first response must include `verdict: "verified"` and a deterministic
`receiptId`. The follow-up `get-receipt` response must return the stored receipt
row for that same `receiptId`.

## Helius configuration

Configure the Helius webhook outside this repository:

- Target URL: `<INSFORGE_BASE_URL>/functions/helius-webhook`
- Method: `POST`
- Header: `X-EventSeal-Webhook-Secret: <EVENTSEAL_WEBHOOK_SECRET>`
- Payload: enhanced transaction array

Do not record the webhook secret in repository files. Record only whether the
header key is configured and whether a delivery returned `200`.

## Deployment record

For each deployment, record non-secret outputs in the PR or release notes:

| Field                     | Value                                            |
| ------------------------- | ------------------------------------------------ |
| InsForge project          | `<project name or public slug only>`             |
| Source commit SHA         | `<40-character git commit SHA>`                  |
| Function bundle checksums | `<sha256 for each functions/dist/*.js bundle>`   |
| Migration command         | `npx @insforge/cli db migrations up --all`       |
| Applied migration version | `20260721000000`                                 |
| Function slugs            | `verify-event`, `get-receipt`, `helius-webhook`  |
| Function status           | `<active/error>`                                 |
| Validation smoke          | `<passed/failed>`                                |
| Positive devnet smoke     | `<receiptId and get-receipt status, or not run>` |
| Helius delivery smoke     | `<passed/failed/not run>`                        |

Never record:

- `INSFORGE_API_KEY`
- `EVENTSEAL_WEBHOOK_SECRET`
- private RPC URLs with tokens
- raw `.env` contents
- `.insforge` contents
- private planning material

## Rollback

If a function deployment fails or behaves incorrectly, redeploy from the
recorded last-known-good source commit and recorded bundle checksums. Do not
rebuild from an arbitrary working tree, and do not deploy rollback bundles whose
checksums differ from the deployment record.

First, write the recorded last-known-good bundle checksums to a local file:

```bash
RECORDED_CHECKSUMS=/tmp/eventseal-last-known-good-checksums.txt

# Populate this file from the "Function bundle checksums" deployment record.
# Keep the same "<sha256>  functions/dist/<name>.js" format.
```

Then rebuild from the recorded source commit and compare bundle identity before
deploying:

```bash
set -euo pipefail

git fetch origin
git checkout --detach <last-known-good-source-commit-sha>
npm ci
npm run check
npm run build:functions

ROLLBACK_CHECKSUMS=$(mktemp)
node -e '
const { createHash } = require("node:crypto");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

for (const file of readdirSync("functions/dist").filter((name) => name.endsWith(".js")).sort()) {
  const path = join("functions/dist", file);
  const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
  console.log(`${hash}  ${path}`);
}
' | tee "$ROLLBACK_CHECKSUMS"

diff -u "$RECORDED_CHECKSUMS" "$ROLLBACK_CHECKSUMS" || exit 1

npx @insforge/cli functions deploy verify-event --file functions/dist/verify-event.js
npx @insforge/cli functions deploy get-receipt --file functions/dist/get-receipt.js
npx @insforge/cli functions deploy helius-webhook --file functions/dist/helius-webhook.js
```

If the checksum diff fails, stop the rollback. The rebuilt bundles do not match
the recorded last-known-good artifacts.

Database migrations are forward-only operational history. Do not edit an
already-applied migration. Add a new corrective migration if a schema rollback
or repair is required.
