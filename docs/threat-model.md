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

## Product boundaries

- Proving Solana consensus independently of an RPC provider.
- Auditing whether a legitimate event represents correct business logic.
- Arbitrary non-Anchor event formats.
- Multi-chain verification, ZK proofs, or an on-chain receipt registry.
- Operating a custom indexer.

## Security posture

Ambiguity is not success. Any missing precondition produces `indeterminate`; evidence that contradicts the request produces `rejected`.
