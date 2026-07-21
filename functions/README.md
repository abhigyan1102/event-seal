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

| Variable                        | Used by                            | Description                                                  |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `INSFORGE_BASE_URL`             | Verification and receipt functions | Server-side InsForge project URL.                            |
| `INSFORGE_API_KEY`              | Verification and receipt functions | Server-only administrative key used for receipt persistence. |
| `SOLANA_RPC_URL`                | Verification functions             | Solana JSON-RPC endpoint.                                    |
| `EVENTSEAL_CLUSTER`             | Helius webhook                     | `mainnet-beta`, `devnet`, or `testnet`.                      |
| `EVENTSEAL_EXPECTED_PROGRAM_ID` | Helius webhook                     | Program expected to emit the event.                          |
| `EVENTSEAL_EVENT_FORMAT`        | Helius webhook                     | `anchor-log` or `anchor-cpi`.                                |
| `EVENTSEAL_EVENT_DISCRIMINATOR` | Helius webhook                     | Expected 16-character lowercase hex discriminator.           |
| `EVENTSEAL_WEBHOOK_SECRET`      | Helius webhook                     | Shared secret required in `X-EventSeal-Webhook-Secret`.      |

Never expose `INSFORGE_API_KEY` to the browser or commit real values to the repository.

## Deploy

```bash
npx @insforge/cli db migrations up --all
npx @insforge/cli functions deploy verify-event --file functions/dist/verify-event.js
npx @insforge/cli functions deploy get-receipt --file functions/dist/get-receipt.js
npx @insforge/cli functions deploy helius-webhook --file functions/dist/helius-webhook.js
```
