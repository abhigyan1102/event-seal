# API reference

## `verifyEvent(input)`

The TypeScript SDK exports `verifyEvent`, which returns `Promise<VerificationResult>`.

### Input

| Field                 | Type                                   | Required | Description                                                     |
| --------------------- | -------------------------------------- | -------- | --------------------------------------------------------------- |
| `signature`           | `string`                               | Yes      | Solana transaction signature.                                   |
| `cluster`             | `mainnet-beta`, `devnet`, or `testnet` | Yes      | Cluster used for RPC selection and receipt identity.            |
| `expectedProgramId`   | `string`                               | Yes      | Program that must own the active invocation frame.              |
| `event.format`        | `anchor-log` or `anchor-cpi`           | Yes      | Anchor event transport. CPI attribution currently fails closed. |
| `event.discriminator` | `string`                               | Yes      | Eight-byte discriminator as 16 lowercase hex characters.        |
| `commitment`          | `finalized`                            | No       | The only accepted commitment; defaults to `finalized`.          |
| `rpcUrl`              | `string`                               | No       | Custom Solana JSON-RPC endpoint.                                |

### Verdicts

| Verdict         | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| `verified`      | Finality, execution, discriminator, and program attribution passed.  |
| `rejected`      | Available evidence proves the requested event should not be trusted. |
| `indeterminate` | The verifier could not prove or disprove the requested event.        |

### Reason codes

| Code                     | Verdict         | Meaning                                                           |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `VERIFIED`               | `verified`      | One event matched the expected program and discriminator.         |
| `TX_FAILED`              | `rejected`      | Transaction metadata contains a non-null execution error.         |
| `PROGRAM_MISMATCH`       | `rejected`      | Matching event bytes came from another program frame.             |
| `DISCRIMINATOR_MISMATCH` | `rejected`      | The expected program emitted data with a different discriminator. |
| `TX_NOT_FOUND`           | `indeterminate` | The selected RPC endpoint did not return the transaction.         |
| `TX_NOT_FINALIZED`       | `indeterminate` | Finalized confirmation was not established.                       |
| `RPC_UNAVAILABLE`        | `indeterminate` | The JSON-RPC request failed or timed out.                         |
| `METADATA_MISSING`       | `indeterminate` | Transaction metadata was absent.                                  |
| `LOGS_UNAVAILABLE`       | `indeterminate` | Complete log messages were absent.                                |
| `EVENT_NOT_FOUND`        | `indeterminate` | No matching Anchor event was found.                               |
| `AMBIGUOUS_EVENT`        | `indeterminate` | More than one event matched the request.                          |
| `CPI_EVENT_UNSUPPORTED`  | `indeterminate` | This version does not verify Anchor CPI events.                   |
| `INVALID_REQUEST`        | `indeterminate` | Required identifiers or discriminator formatting were invalid.    |

## Hosted functions

InsForge exposes each deployed handler under `/functions/{slug}`.

### `verify-event`

Send a `POST` request whose JSON body matches `VerifyEventInput` except for
`rpcUrl`. Hosted verification uses the deployment-owned RPC endpoint
configuration, not a caller-supplied endpoint. The function returns
`VerificationResult` and stores results that have a deterministic receipt ID.
New v2 receipt IDs bind the cluster, finalized commitment, signature, expected
program, event format, expected discriminator, and attributed event evidence.
The stored record is insert-only and is checked against the verification result
after every write attempt.

### `get-receipt`

Send a `GET` request with `receiptId` as a query parameter:

```text
/functions/get-receipt?receiptId=es_<sha256>
```

The response is either a legacy v1 record or a complete v2 record. The handler
recomputes the version-specific receipt ID and fails closed if stored fields are
missing, unexpected, or inconsistent.

### `helius-webhook`

Send a Helius enhanced-transactions array with `POST`. The function deduplicates signatures, applies its environment-configured event identity, and returns one verification result per unique signature.
