# InsForge functions

EventSeal exposes three InsForge-compatible Deno handlers. All verification entry points share the SDK source in `packages/sdk`.

| Source              | Function slug    | Behavior                                                                    |
| ------------------- | ---------------- | --------------------------------------------------------------------------- |
| `verify-event.ts`   | `verify-event`   | Verify a request and store its deterministic receipt.                       |
| `get-receipt.ts`    | `get-receipt`    | Read a stored receipt by `receiptId`.                                       |
| `helius-webhook.ts` | `helius-webhook` | Deduplicate Helius signatures, verify each transaction, and store receipts. |

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
```

The build keeps `npm:@insforge/sdk` external because InsForge resolves that package in the Deno runtime.

## Environment

| Setting                    | `verify-event`         | `get-receipt` | `helius-webhook`                | Description                                                              |
| -------------------------- | ---------------------- | ------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `INSFORGE_BASE_URL`        | Required env           | Required env  | Required env                    | Server-side InsForge project URL.                                        |
| `INSFORGE_API_KEY`         | Required env           | Required env  | Required env                    | Server-only administrative key used for receipt persistence.             |
| `SOLANA_RPC_URL`           | Optional env           | Not used      | Optional env                    | Server-owned Solana JSON-RPC endpoint; defaults to SDK cluster behavior. |
| `signature`                | Required request field | Not used      | Helius payload field            | Solana transaction signature to verify.                                  |
| `cluster`                  | Required request field | Not used      | `EVENTSEAL_CLUSTER`             | `mainnet-beta`, `devnet`, or `testnet`.                                  |
| `expectedProgramId`        | Required request field | Not used      | `EVENTSEAL_EXPECTED_PROGRAM_ID` | Program expected to emit the event.                                      |
| `event.format`             | Required request field | Not used      | `EVENTSEAL_EVENT_FORMAT`        | `anchor-log` or `anchor-cpi`.                                            |
| `event.discriminator`      | Required request field | Not used      | `EVENTSEAL_EVENT_DISCRIMINATOR` | Expected 16-character lowercase hex discriminator.                       |
| `EVENTSEAL_WEBHOOK_SECRET` | Not used               | Not used      | Required env                    | Shared secret required in `X-EventSeal-Webhook-Secret`.                  |

Never expose `INSFORGE_API_KEY` or `EVENTSEAL_WEBHOOK_SECRET` to the browser or commit real values to the repository.

## Deploy

Deploy from a clean checkout after configuring server-only environment variables in InsForge:

```bash
npm run build:functions
npx @insforge/cli link
npx @insforge/cli db migrations up --all
npx @insforge/cli functions deploy verify-event --file functions/dist/verify-event.js
npx @insforge/cli functions deploy get-receipt --file functions/dist/get-receipt.js
npx @insforge/cli functions deploy helius-webhook --file functions/dist/helius-webhook.js
```

Deployment order matters:

1. Build bundled function files with `npm run build:functions`.
2. Link the local checkout to the intended InsForge project.
3. Apply database migrations so `verification_receipts` exists before receipts are written.
4. Deploy `verify-event`, `get-receipt`, and `helius-webhook` from `functions/dist`.
5. Configure Helius to send `X-EventSeal-Webhook-Secret` with the same secret stored in InsForge.

Before opening a backend deployment PR, confirm the diff does not include real `.env` files, `.insforge`, `context.md`, `CLAUDE.md`, `DESIGN.md`, `PLAN.md`, private planning notes, or private credentials.

## Hosted routes

InsForge exposes deployed functions under `/functions/{slug}`:

| Method | Route                       | Notes                                                                                    |
| ------ | --------------------------- | ---------------------------------------------------------------------------------------- |
| `POST` | `/functions/verify-event`   | Body must match the SDK `VerifyEventInput` shape except `rpcUrl`, which is server-owned. |
| `GET`  | `/functions/get-receipt`    | Requires `receiptId` as a query parameter.                                               |
| `POST` | `/functions/helius-webhook` | Requires `X-EventSeal-Webhook-Secret`; body is a Helius transactions array.              |
