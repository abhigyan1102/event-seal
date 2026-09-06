# InsForge functions

EventSeal exposes four InsForge-compatible Deno handlers. All verification entry points share the SDK source in `packages/sdk`.

| Source                   | Function slug         | Behavior                                                                    |
| ------------------------ | --------------------- | --------------------------------------------------------------------------- |
| `inspect-transaction.ts` | `inspect-transaction` | Read status and candidate log bytes; no receipt or database write.          |
| `verify-event.ts`        | `verify-event`        | Verify a request and store its deterministic receipt.                       |
| `get-receipt.ts`         | `get-receipt`         | Read a stored receipt by `receiptId`.                                       |
| `helius-webhook.ts`      | `helius-webhook`      | Deduplicate Helius signatures, verify each transaction, and store receipts. |

## Build

Local SDK imports are bundled before deployment:

```bash
npm run build:functions
```

This produces:

```text
functions/dist/verify-event.js
functions/dist/get-receipt.js
functions/dist/helius-webhook.js
functions/dist/inspect-transaction.js
```

The build keeps `npm:@insforge/sdk` external because InsForge resolves that package in the Deno runtime.

## Environment

| Setting                                                                     | `inspect-transaction`  | `verify-event`         | `get-receipt` | `helius-webhook`                | Description                                                          |
| --------------------------------------------------------------------------- | ---------------------- | ---------------------- | ------------- | ------------------------------- | -------------------------------------------------------------------- |
| `EVENTSEAL_INTERNAL_API_SECRET`                                             | Required env           | Required env           | Not used      | Not used                        | Server-to-function credential sent in `X-EventSeal-Internal-Secret`. |
| `INSFORGE_BASE_URL`                                                         | Not used               | Required env           | Required env  | Required env                    | Server-side InsForge project URL.                                    |
| `INSFORGE_API_KEY`                                                          | Not used               | Required env           | Required env  | Required env                    | Administrative key used for receipt persistence.                     |
| `SOLANA_RPC_MAINNET_URL`, `SOLANA_RPC_DEVNET_URL`, `SOLANA_RPC_TESTNET_URL` | Optional env           | Optional env           | Not used      | Optional env                    | Endpoint bound to the corresponding network.                         |
| `signature`                                                                 | Required request field | Required request field | Not used      | Helius payload field            | Solana transaction signature.                                        |
| `cluster`                                                                   | Required request field | Required request field | Not used      | `EVENTSEAL_CLUSTER`             | `mainnet-beta`, `devnet`, or `testnet`.                              |
| `expectedProgramId`                                                         | Not accepted           | Required request field | Not used      | `EVENTSEAL_EXPECTED_PROGRAM_ID` | Program expected to emit the event.                                  |
| `event.format`                                                              | Not accepted           | Required request field | Not used      | `EVENTSEAL_EVENT_FORMAT`        | `anchor-log` for hosted webhook receipt deployment.                  |
| `event.discriminator`                                                       | Not accepted           | Required request field | Not used      | `EVENTSEAL_EVENT_DISCRIMINATOR` | Expected 16-character lowercase hexadecimal discriminator.           |
| `EVENTSEAL_WEBHOOK_SECRET`                                                  | Not used               | Not used               | Not used      | Required env                    | Credential sent in `X-EventSeal-Webhook-Secret`.                     |

The SDK request contract includes `anchor-cpi`, but this verifier version fails
closed for CPI attribution with `CPI_EVENT_UNSUPPORTED`. Do not configure
`EVENTSEAL_EVENT_FORMAT=anchor-cpi` for hosted webhook deployments that must
create verified receipts.

Never expose `INSFORGE_API_KEY`, `EVENTSEAL_INTERNAL_API_SECRET`, or
`EVENTSEAL_WEBHOOK_SECRET` to the browser or commit real values to the
repository. Generate the internal API secret independently from the webhook
secret and configure the exact same value in the Next.js server and both
protected functions.

`inspect-transaction` requires no InsForge database credentials. It accepts only
`signature` and `cluster`. An omitted cluster-specific RPC falls back to that
cluster's public endpoint. Legacy `SOLANA_RPC_URL` now requires an explicit
`SOLANA_RPC_CLUSTER` binding and applies only to that cluster. Unbound legacy
configuration fails closed. All SDK RPC reads check `getGenesisHash` before
fetching transaction evidence, including verification and webhook calls.

## Deploy

Deploy from a clean checkout after configuring server-only environment variables in InsForge:

```bash
npm run build:functions
npx @insforge/cli link
npx @insforge/cli db migrations up --all
npx @insforge/cli functions deploy verify-event --file functions/dist/verify-event.js
npx @insforge/cli functions deploy get-receipt --file functions/dist/get-receipt.js
npx @insforge/cli functions deploy helius-webhook --file functions/dist/helius-webhook.js
npx @insforge/cli functions deploy inspect-transaction --file functions/dist/inspect-transaction.js
```

Deployment order matters:

1. Build bundled function files with `npm run build:functions`.
2. Link the local checkout to the intended InsForge project.
3. Apply database migrations so `verification_receipts` has the complete v2
   identity columns and immutability trigger before receipts are written.
4. Deploy `verify-event`, `get-receipt`, `helius-webhook`, and `inspect-transaction` from `functions/dist`.
5. Configure Helius to send `X-EventSeal-Webhook-Secret` with the same secret stored in InsForge.

Before opening a backend deployment PR, confirm the diff does not include real `.env` files, `.insforge`, `context.md`, `CLAUDE.md`, `DESIGN.md`, `PLAN.md`, private planning notes, or private credentials.

For the full deployment checklist, smoke checks, and non-secret deployment record
template, see [`docs/insforge-deploy-runbook.md`](../docs/insforge-deploy-runbook.md).

## Hosted routes

InsForge exposes deployed functions under `/functions/{slug}`:

| Method | Route                            | Notes                                                                                        |
| ------ | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `POST` | `/functions/inspect-transaction` | Requires `X-EventSeal-Internal-Secret`; JSON `{ signature, cluster }`; 4 KiB body limit.     |
| `POST` | `/functions/verify-event`        | Requires `X-EventSeal-Internal-Secret`; body matches `VerifyEventInput` except `rpcUrl`.     |
| `GET`  | `/functions/get-receipt`         | Requires query parameter `receiptId`; returns only a self-consistent v1 or v2 stored record. |
| `POST` | `/functions/helius-webhook`      | Requires `X-EventSeal-Webhook-Secret`; body is a Helius transactions array.                  |
