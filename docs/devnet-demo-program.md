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

The deployed program keypair is retained in secure operator storage and is intentionally excluded from Git. An authorized operator must restore it to `target/deploy/event_seal_demo-keypair.json` before redeploying this public identity. A newly generated keypair has a different address and cannot reproduce the deployment recorded below.

Do not commit program keypairs, deployment authority keypairs, wallet files, or RPC credentials.

## Deployment record

| Field              | Value                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Deployed on        | `2026-08-22`                                                                               |
| Deploy signature   | `55ixY1mhkRFwoayMFCiWQJRp93La641r23PkUpijE7P3GKrK7c2tXC5i3pM9vcpW6ppirsLqipjEAGyJrEoZaxRx` |
| Last deployed slot | `486609086`                                                                                |
| Upgrade authority  | `3jEQQdxEhBpAWqFXswocXByBzGNRfKsBKcAZXDzjVCa4`                                             |

## Build from a fresh checkout

```bash
cargo test --workspace
anchor build
```

These commands validate the source and build artifacts. They do not grant authority to redeploy the existing devnet program.

## Redeploy the existing public identity

Restore the existing program keypair from secure operator storage, select the devnet cluster, and verify both public identities before deploying:

```bash
solana config set --url devnet
export EVENTSEAL_DEPLOYER_KEYPAIR=/secure/path/to/devnet-upgrade-authority.json
export EVENTSEAL_PROGRAM_KEYPAIR=target/deploy/event_seal_demo-keypair.json
solana-keygen pubkey "$EVENTSEAL_DEPLOYER_KEYPAIR"
solana-keygen pubkey "$EVENTSEAL_PROGRAM_KEYPAIR"
```

The commands must print these values:

- Deployment wallet: `3jEQQdxEhBpAWqFXswocXByBzGNRfKsBKcAZXDzjVCa4`
- Program keypair: `AMWm3XHjn6zVygWDX6J7DYPvvwQ6xy3mKKwspWJeuZVS`

Stop if either value differs. With both identities confirmed, deploy the named program explicitly:

```bash
anchor deploy \
  --program-name event_seal_demo \
  --program-keypair "$EVENTSEAL_PROGRAM_KEYPAIR" \
  --provider.cluster devnet \
  --provider.wallet "$EVENTSEAL_DEPLOYER_KEYPAIR"
```

Generating a fresh keypair is an identity rotation, not a redeployment. A rotation requires updating `declare_id!`, `Anchor.toml`, this document, and SDK fixtures together, followed by a new deployment and acceptance record.

## Acceptance proof

PR 4.1 is complete only when both submitted devnet transactions reach finalized commitment:

| Instruction      | Expected transaction state | Expected EventSeal verdict  |
| ---------------- | -------------------------- | --------------------------- |
| `emit_success`   | `meta.err === null`        | `verified`                  |
| `emit_then_fail` | `meta.err !== null`        | `rejected` with `TX_FAILED` |

Current public proof:

| Instruction          | Signature                                                                                  | Slot        | Observed transaction state     | EventSeal verdict                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------ | ----------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `emit_success(42)`   | `QJ1ZzYcBMQbU1DHmaFedXMPGiFXyBX5h5pkx17BvXC6SWXdgAemsUqAQNs7qaLSn4zWdt1cUQbrcxcbRkZM3Uc1`  | `486941646` | `Status: Ok`                   | `verified` with receipt `es_0a4b8d7aceadb04204c5f91fcadbc448df272a8c9bccd404eafcaa4c9c1dc02f` |
| `emit_then_fail(43)` | `45K9yJVaCjQMRVwxhHeUUP1Bx6fefh2kDaSFhWrguNHNYiogf2UPm9wLsSj1wJK1LNtqifM1hPsqQcuUBiZVD3yt` | `486941689` | `custom program error: 0x1770` | `rejected` with `TX_FAILED`                                                                   |

Both transactions include one `Program data:` line for the `DemoEvent` discriminator. The failed transaction is intentionally submitted with preflight disabled so Solana records the emitted log and failed execution metadata.

## Regenerate the public fixture

From a fresh checkout, install dependencies and run the fixture generator with a funded devnet fee payer:

```bash
npm ci
npm run fixtures:devnet -- --keypair /secure/path/to/devnet-fee-payer.json
```

The operator may override the RPC endpoint, output path, and both nonces through command-line flags; run `npm run fixtures:devnet -- --help` for details. No source edits or program deployment keypair are required. The generated fixture is written to `tests/fixtures/devnet-demo.json` after both transactions finalize and their event attribution and transaction outcomes are validated.

Never pass a keypair through a command-line value other than its filesystem path, and never commit or paste its JSON contents. The generated fixture contains public on-chain evidence only.

## Prove the hosted backend

After regenerating the devnet fixture and deploying the hosted InsForge functions, run the opt-in backend proof smoke:

```bash
INSFORGE_BASE_URL=https://your-project.region.insforge.app npm run smoke:devnet-backend -- --output tests/fixtures/devnet-backend-proof.json
```

The smoke invokes `verify-event` for both fixture signatures, fetches the successful verification through `get-receipt`, and fails if the failed transaction can produce a verified verdict or receipt ID. The optional output is sanitized public evidence only.
