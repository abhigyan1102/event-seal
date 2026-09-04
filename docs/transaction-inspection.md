# Transaction inspection

Inspection answers “what evidence is available for this transaction?” It is
separate from verifying the event an application expects. A successful Solana
transaction need not emit an Anchor log event.

```ts
import { inspectTransaction } from "@eventseal/sdk";

const inspection = await inspectTransaction({
  signature: "<transaction signature>",
  cluster: "mainnet-beta",
});
```

The hosted equivalent is `POST /functions/inspect-transaction` with JSON
`{ "signature": "...", "cluster": "mainnet-beta" }`. The handler rejects extra
fields, including caller-supplied RPC URLs. It bounds the streamed request to
4 KiB and returns `Cache-Control: no-store`. It has no database or receipt-writing
dependency. Browser integration is a separate change.

## Result contract

`kind` is always `transaction-inspection`. There is no `verdict` or `receiptId`.

| Field                  | Meaning                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signature`, `cluster` | The inspected request identity.                                                                                                                   |
| `finality`             | `processed`, `confirmed`, `finalized`, or `unknown`, from signature status.                                                                       |
| `execution`            | `succeeded`, `failed`, or `unknown`; success alone does not verify an event.                                                                      |
| `slot`                 | Observed slot, when available.                                                                                                                    |
| `invokedPrograms`      | Unique program IDs observed in invocation logs, including nested calls. Not an exhaustive instruction inventory when logs are unavailable.        |
| `logsStatus`           | `available`, `unavailable`, or `incomplete`.                                                                                                      |
| `candidates`           | Log position, emitter program, first eight bytes as lowercase hex, base64 bytes, and data hash. These are candidates, not decoded/trusted events. |
| `reasonCode`           | Summary of the available evidence; see below.                                                                                                     |

Candidate discovery reads finalized transaction metadata only. Non-finalized
signature status can still be reported, but cannot yield candidates.

- `CANDIDATES_FOUND`: candidate eight-byte prefixes exist; confirm the expected
  program and event discriminator against its trusted IDL/source before a
  separate `verifyEvent` request. Never authorize a backend action solely from
  discovered bytes. A `Program data:` payload is not necessarily an Anchor event.
- `NO_SUPPORTED_LOG_EVENT`: available logs contain no eight-byte log-event
  candidate. This does not claim no transfer, swap, or other action occurred.
- `LOGS_UNAVAILABLE` / `METADATA_MISSING`: required evidence is absent, not proof
  that no event occurred.
- `LOGS_INCOMPLETE`: truncated logs, broken invocation frames, malformed data,
  or safety limits prevented reliable discovery. Candidates are withheld.
- `TX_FAILED`: the transaction failed. Any candidate bytes remain untrusted.
- `TX_NOT_FINALIZED` / `TX_NOT_FOUND`: no finalized evidence available at this
  RPC. Not-found does not prove a signature never existed.
- `RPC_UNAVAILABLE` / `INVALID_REQUEST`: no usable evidence; no receipt.

The SDK bounds each RPC response to 2 MiB with a 15-second request timeout.
Inspection bounds logs to 2,048 lines / 256 KiB, 128 candidates, 128 unique
programs, and 64 nested frames. It cannot detect every omission by a dishonest
or incomplete RPC provider; RPC evidence remains a trust dependency. Provider
independence, rate limiting, CPI event decoding, arbitrary protocol decoders,
and transaction-level receipts are not introduced here.

## Network-safe RPC configuration

Hosted inspection, verification, and webhook verification share this selection:

1. Use `SOLANA_RPC_MAINNET_URL`, `SOLANA_RPC_DEVNET_URL`, or
   `SOLANA_RPC_TESTNET_URL` for the requested cluster.
2. A legacy `SOLANA_RPC_URL` is allowed only with explicit `SOLANA_RPC_CLUSTER`
   (`mainnet-beta`, `devnet`, or `testnet`) and applies only to that cluster.
3. Otherwise use that cluster's public Solana RPC endpoint.

Unbound legacy configuration fails closed instead of overriding the selected
network. Migrate secrets before deploying the updated verification functions;
see the [deployment runbook](./insforge-deploy-runbook.md). The SDK also checks
the full `getGenesisHash` for every inspection/verification request. Wrong-network
or unavailable endpoints yield `RPC_UNAVAILABLE`; they cannot produce a receipt.
Custom SDK `rpcUrl` endpoints must serve the named cluster, not a local validator
mislabeled as devnet. Endpoint URLs and credentials stay server-side.

## Reproducible mainnet proof

```bash
npm run smoke:mainnet-inspection
```

This opt-in smoke reads real mainnet transactions listed in
[`mainnet-inspection.json`](../tests/fixtures/mainnet-inspection.json). It submits
no transactions, spends no funds, and persists no receipts. A server-side
`SOLANA_RPC_MAINNET_URL` may select a trusted provider. Ordinary tests stay offline.

Live SDK/RPC proof passed on **2026-08-28 at 14:42 UTC**:

| Case                                               | Slot      | Result                                                              |
| -------------------------------------------------- | --------- | ------------------------------------------------------------------- |
| Successful Fill transaction without log-event data | 442143319 | `NO_SUPPORTED_LOG_EVENT`, succeeded and finalized                   |
| Raydium CLMM SwapEvent                             | 442360234 | `CANDIDATES_FOUND`, then separate `verifyEvent` returned `VERIFIED` |
| Failed mainnet transaction                         | 442360234 | Inspection `TX_FAILED`; verification rejected with no receipt       |

The expected Raydium program and event name come from the pinned upstream sources
in the fixture, not from the discovered log bytes. The expected discriminator
is `SHA-256("event:SwapEvent")[0..8]` = `40c6cde8260871e2`. The separate SDK
verification produced receipt ID
`es_3acc7c650f0f59b8591eb67c3d7e8bea0db0a26f517d1867366be2082936dac3`;
that ID was **not persisted to InsForge by this proof**. Inspection issued none.

Missing logs, truncated evidence, wrong-network RPCs, malformed RPC responses,
and unavailable transactions are covered by deterministic regression tests;
these are injected failure cases, not claimed live mainnet outages. This proof
does not claim the new function is deployed or the webpage has switched flows.

References: [Solana getTransaction](https://solana.com/docs/rpc/http/gettransaction),
[getGenesisHash](https://solana.com/docs/rpc/http/getgenesishash), and
[Anchor event emission](https://www.anchor-lang.com/docs/features/events).
