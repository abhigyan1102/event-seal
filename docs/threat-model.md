# Threat model

## Protected action

An off-chain relayer, indexer, bridge, or automation may perform an irreversible action after observing a Solana event. EventSeal protects the decision boundary between observing bytes and trusting that those bytes came from a successful, finalized execution of the intended program.

## In scope

- A transaction emits a plausible event and later fails.
- An attacker-controlled program emits matching event bytes.
- An event discriminator does not match the expected schema.
- RPC data is absent, incomplete, truncated, stale, or unavailable.
- A webhook provider redelivers the same transaction.
- Invocation nesting makes a log line appear to belong to the wrong program.

## Trusted and untrusted inputs

| Input                                                 | Trust treatment                                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Expected program ID, cluster, and event discriminator | Pin from a reviewed deployment and matching event schema before reading the transaction.           |
| Signature from a user, webhook, or queue              | Locator for RPC evidence; it does not authorize an action.                                         |
| Webhook event fields and inspection candidates        | Discovery or delivery data only; never promote them into trusted expectations.                     |
| Finalized RPC transaction, metadata, and logs         | Evidence source for verification; RPC correctness and availability remain dependencies.            |
| Verification receipt                                  | Record of a specific decision; it does not prove business authorization or downstream fulfillment. |

The consumer must separately enforce its own operation identity, business policy, and idempotency. EventSeal cannot prevent a consumer from acting twice on one valid event if the consumer has no atomic duplicate guard.

## Product boundaries

- Proving Solana consensus independently of an RPC provider.
- Auditing whether a legitimate event represents correct business logic.
- Arbitrary non-Anchor event formats.
- Multi-chain verification, ZK proofs, or an on-chain receipt registry.
- Operating a custom indexer.

## Security posture

Ambiguity is not success. Any missing precondition produces `indeterminate`; evidence that contradicts the request produces `rejected`.
