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
- A generated internal API secret shared only by the Next.js server,
  `verify-event`, and `inspect-transaction`.
- A generated webhook secret for Helius. Use a random secret; do not reuse an
  API key.

Use the InsForge CLI through `npx`:

```bash
npx -y @insforge/cli current
npx -y @insforge/cli whoami
```

If the CLI is not authenticated or the checkout is not linked, run the
interactive setup from your own terminal:

```bash
npx -y @insforge/cli login
npx -y @insforge/cli link
```

## Server environment

Configure these server-only values in the InsForge project before invoking the
functions. Per-network RPC settings are optional but recommended for deployments
that should avoid public cluster RPC defaults. Migrate an existing `SOLANA_RPC_URL`
to the appropriate network-specific key before deploying, or add the explicit
`SOLANA_RPC_CLUSTER` binding. An unbound legacy URL fails closed.

| Name                                    | Used by                                                 | Notes                                                                             |
| --------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `EVENTSEAL_INTERNAL_API_SECRET`         | Next.js, `inspect-transaction`, `verify-event`          | Required server-only credential; use the same value on both deployment platforms. |
| `INSFORGE_BASE_URL`                     | `verify-event`, `get-receipt`, `helius-webhook`         | Required server-side project URL.                                                 |
| `INSFORGE_API_KEY`                      | `verify-event`, `get-receipt`, `helius-webhook`         | Required server-only administrative key for receipt persistence.                  |
| `SOLANA_RPC_MAINNET_URL`                | `inspect-transaction`, `verify-event`, `helius-webhook` | Optional mainnet-beta RPC only.                                                   |
| `SOLANA_RPC_DEVNET_URL`                 | `inspect-transaction`, `verify-event`, `helius-webhook` | Optional devnet RPC only.                                                         |
| `SOLANA_RPC_TESTNET_URL`                | `inspect-transaction`, `verify-event`, `helius-webhook` | Optional testnet RPC only.                                                        |
| `SOLANA_RPC_URL` + `SOLANA_RPC_CLUSTER` | Same three functions                                    | Legacy pair: used only for the named cluster if no specific URL is configured.    |
| `EVENTSEAL_CLUSTER`                     | `helius-webhook`                                        | Required `mainnet-beta`, `devnet`, or `testnet`; devnet is the current target.    |
| `EVENTSEAL_EXPECTED_PROGRAM_ID`         | `helius-webhook`                                        | Required program expected to emit the verified event.                             |
| `EVENTSEAL_EVENT_FORMAT`                | `helius-webhook`                                        | Required `anchor-log` for hosted webhook receipt deployment.                      |
| `EVENTSEAL_EVENT_DISCRIMINATOR`         | `helius-webhook`                                        | Required sixteen lowercase hex characters.                                        |
| `EVENTSEAL_WEBHOOK_SECRET`              | `helius-webhook`                                        | Required shared secret in `X-EventSeal-Webhook-Secret`.                           |

Anchor CPI events are intentionally not listed as a deployable webhook receipt
format yet. The current verifier fails closed for `anchor-cpi` with
`CPI_EVENT_UNSUPPORTED`, so configuring `EVENTSEAL_EVENT_FORMAT=anchor-cpi`
cannot produce verified receipts.

List configured secret keys without printing values:

```bash
npx -y @insforge/cli secrets list
```

The InsForge CLI currently accepts new and rotated secret values as process
arguments. Do not use that form for credentials because local process listings
and shell audit tooling can capture it. The repository helper below calls the
documented `POST /api/secrets` or `PUT /api/secrets/{key}` endpoint, obtains the
linked project URL and administrative credential from the ignored
`.insforge/project.json`, reads exactly one value from standard input, and never
prints the value or response body.

For initial setup, stream each value directly from the production secret
manager. Replace the left-hand placeholder with that manager's non-logging read
command; never paste the value into the command itself:

```bash
<protected-secret-manager-read-command> | node scripts/configure-insforge-secret.mjs add EVENTSEAL_INTERNAL_API_SECRET
```

Use the same stdin pattern for `INSFORGE_API_KEY`, RPC URLs that contain provider
credentials, and `EVENTSEAL_WEBHOOK_SECRET`. It is also safe to use for the
remaining configuration keys in the table. The helper's only process arguments
are the non-secret action and key name.

For rotation, change `add` to `update` while continuing to stream the new value
from the protected manager:

```bash
<protected-secret-manager-read-command> | node scripts/configure-insforge-secret.mjs update EVENTSEAL_INTERNAL_API_SECRET
```

### Vercel binding and coordinated rotation

After PR #21 links the production Vercel project, open **Project Settings →
Environment Variables** and create `EVENTSEAL_INTERNAL_API_SECRET` for the
Production environment. Mark it **Sensitive** and paste it directly from the
protected manager. Do not prefix the name with `NEXT_PUBLIC_`. Use the exact
value stored in InsForge. Vercel environment changes apply only to new
deployments, so redeploy the approved commit after creating or changing it.

The application accepts one internal credential at a time, so rotate it during
a short maintenance window:

1. Generate and store a new value in the protected manager.
2. Stream it to the InsForge helper using `update`.
3. Replace the Vercel Sensitive value directly from the manager and redeploy the
   exact approved commit.
4. Run the authenticated backend proof and the production `/api/inspect` and
   `/api/verify` release smokes. Confirm neither public route returns the
   configuration error `503`, while an unauthenticated direct function call
   still returns `401`.
5. Remove the previous value from the manager only after all smokes pass. If
   they fail, restore the previous value on both systems and redeploy.

Never place either value in shell history, process arguments, deployment logs,
PRs, issues, chats, screenshots, or deployment records.

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

The receipt migrations create `public.verification_receipts`, enable RLS,
allow public read access, and keep writes server-only through the InsForge
admin client. V2 adds the complete trusted verification identity and rejects
updates or deletes; the function writer uses insert-only conflict handling and
checks the stored record after each attempt.

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
Load `EVENTSEAL_INTERNAL_API_SECRET` into the shell environment without printing
it, then fail closed if it is missing:

```bash
test -n "${EVENTSEAL_INTERNAL_API_SECRET:-}" || {
  echo "EVENTSEAL_INTERNAL_API_SECRET is required" >&2
  exit 1
}
```

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
AUTH_BODY=$(mktemp)
assert_status 401 "$AUTH_BODY" \
  -X POST "<INSFORGE_BASE_URL>/functions/verify-event" \
  -H "Content-Type: application/json" \
  -d '{'

assert_json_field "$AUTH_BODY" error Unauthorized
```

The malformed unauthenticated body must return `401`, proving authentication
runs before JSON parsing without putting the credential in process arguments.
Repeat that boundary check for inspection:

```bash
INSPECT_AUTH_BODY=$(mktemp)
assert_status 401 "$INSPECT_AUTH_BODY" \
  -X POST "<INSFORGE_BASE_URL>/functions/inspect-transaction" \
  -H "Content-Type: application/json" \
  -d '{'

assert_json_field "$INSPECT_AUTH_BODY" error Unauthorized
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

Run the authenticated positive proof only after a finalized devnet fixture is
available. Have the protected manager inject `EVENTSEAL_INTERNAL_API_SECRET`
into the smoke process environment; do not append the value to this command.
The script sends the credential as an HTTP header but never prints or writes it:

```bash
INSFORGE_BASE_URL="<INSFORGE_BASE_URL>" npm run smoke:devnet-backend
```

The proof requires a verified response with a deterministic receipt ID, reads
that receipt back, and confirms the known failed transaction stays rejected
without a receipt.

## Vercel rate limit release gate

After the production Vercel project exists, configure one WAF rule that matches
either `/api/inspect` or `/api/verify`. Use a fixed window keyed by IP with a
combined limit of 20 requests per 60 seconds and the default `429` action.
Before publishing, review the current rate-limiting price shown by Vercel; do
not assume the included quota or price is unchanged.

Publish the rule only after reviewing its match expression, then send 21 test
requests from one IP. Requests 1-20 must reach the application and request 21
must return `429`. Vercel tracks counters per region, so execute this smoke from
one stable client location. Record only the outcome, never request headers or
environment values.

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

| Field                     | Value                                                                  |
| ------------------------- | ---------------------------------------------------------------------- |
| InsForge project          | `<project name or public slug only>`                                   |
| Source commit SHA         | `<40-character git commit SHA>`                                        |
| Function bundle checksums | `<sha256 for each functions/dist/*.js bundle>`                         |
| Migration command         | `npx @insforge/cli db migrations up --all`                             |
| Applied migration version | `20260721000000`                                                       |
| Function slugs            | `verify-event`, `get-receipt`, `helius-webhook`, `inspect-transaction` |
| Function status           | `<active/error>`                                                       |
| Validation smoke          | `<passed/failed>`                                                      |
| Positive devnet smoke     | `<receiptId and get-receipt status, or not run>`                       |
| Helius delivery smoke     | `<passed/failed/not run>`                                              |

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
npx @insforge/cli functions deploy inspect-transaction --file functions/dist/inspect-transaction.js
```

If the checksum diff fails, stop the rollback. The rebuilt bundles do not match
the recorded last-known-good artifacts.

Database migrations are forward-only operational history. Do not edit an
already-applied migration. Add a new corrective migration if a schema rollback
or repair is required.
