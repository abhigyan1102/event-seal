# Devnet demo program

The EventSeal demo program creates a controlled pair of Anchor log events:

- `emit_success(nonce)` emits `DemoEvent` and commits successfully.
- `emit_then_fail(nonce)` emits the same `DemoEvent` shape and then returns `DemoError::DeliberateFailure`.

This proves the product boundary: matching log bytes are not enough. EventSeal must verify finalized transaction metadata and reject any event from a transaction whose `meta.err` is not `null`.

## Public identity

| Field                      | Value                                          |
| -------------------------- | ---------------------------------------------- |
| Cluster                    | `devnet`                                       |
| Program ID                 | `AMWm3XHjn6zVygWDX6J7DYPvvwQ6xy3mKKwspWJeuZVS` |
| Event name                 | `DemoEvent`                                    |
| Event schema               | `{ nonce: u64 }`                               |
| Anchor log discriminator   | `bf91ff47ac4cb187`                             |
| Supported EventSeal format | `anchor-log`                                   |

The program keypair lives at `target/deploy/event_seal_demo-keypair.json` during local builds and is intentionally ignored by Git. Do not commit program keypairs, deployment authority keypairs, wallet files, or RPC credentials.

## Deployment record

| Field              | Value                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Deployed on        | `2026-08-22`                                                                               |
| Deploy signature   | `55ixY1mhkRFwoayMFCiWQJRp93La641r23PkUpijE7P3GKrK7c2tXC5i3pM9vcpW6ppirsLqipjEAGyJrEoZaxRx` |
| Last deployed slot | `486609086`                                                                                |
| Upgrade authority  | `3jEQQdxEhBpAWqFXswocXByBzGNRfKsBKcAZXDzjVCa4`                                             |

## Build and deploy

```bash
solana config set --url devnet
solana-keygen new --no-bip39-passphrase --outfile target/deploy/event_seal_demo-keypair.json
solana-keygen pubkey target/deploy/event_seal_demo-keypair.json
cargo test --workspace
anchor build
anchor deploy --provider.cluster devnet
```

If a new program keypair is generated, update `declare_id!`, `Anchor.toml`, this document, and SDK test fixtures before building or deploying.

## Acceptance proof

PR 4.1 is complete only when both submitted devnet transactions reach finalized commitment:

| Instruction      | Expected transaction state | Expected EventSeal verdict  |
| ---------------- | -------------------------- | --------------------------- |
| `emit_success`   | `meta.err === null`        | `verified`                  |
| `emit_then_fail` | `meta.err !== null`        | `rejected` with `TX_FAILED` |

Current public proof:

| Instruction          | Signature                                                                                  | Slot        | Observed transaction state     | EventSeal verdict                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------ | ----------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `emit_success(42)`   | `3r6sxr6HnG7Rqeqz7xc7ZtHS3DgHG6QRQpJBGDkNjSfBeTWGSatKZkEtQh4kjb2jckHq68EQ2W4HwUzVd9Cxja3A` | `486609883` | `Status: Ok`                   | `verified` with receipt `es_27714c6c4ba16ae77d6d781c7a5ff7cb89359b2e3e1f149ac6bc6d8ca9c59257` |
| `emit_then_fail(43)` | `39cALQAV4aE5DWpLfDiUgHmh2WwXh4WDgdX2a7aUs3cWYMgms2WqSyo374q7L8EQMgsRLZ8WEoH9PiM7uMEc4bC2` | `486610291` | `custom program error: 0x1770` | `rejected` with `TX_FAILED`                                                                   |

Both transactions include one `Program data:` line for the `DemoEvent` discriminator. The failed transaction is intentionally submitted with preflight disabled so Solana records the emitted log and failed execution metadata.
