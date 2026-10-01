# Integrating EventSeal into a consumer

EventSeal helps a backend decide whether a specific Solana event may be used as evidence for an off-chain action. The consumer still owns its business rules, authorization, and idempotency.

## Establish trusted identity before verification

Obtain the expected program ID from a reviewed deployment record and the event discriminator from the matching program build or IDL. Pin the Solana cluster in the consumer's configuration. Do not copy these values from transaction logs, a webhook body, or an inspection candidate. Inspection helps discover possible events; it does not authorize one.

Send the transaction signature and that independently configured identity to `verifyEvent` or the hosted verifier. See the [API reference](./api-reference.md) for the exact request and result fields. A hosted caller cannot choose its own RPC URL; the deployment controls that endpoint.

## Gate the protected action

| Verdict         | Consumer action                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `verified`      | Evaluate application rules and proceed only if this event is the one expected for the pending action.   |
| `rejected`      | Stop the action, record the reason code, and investigate the request or transaction.                    |
| `indeterminate` | Leave the action pending. Retry with a bounded policy or send it for review. Never treat it as success. |

A `verified` verdict proves the supported event was attributed to the expected program in a successful finalized transaction according to the configured RPC evidence. It does not prove the program's economic logic, the caller's identity, the legitimacy of the recipient, or that an action has not already been performed.

The consumer should persist its own action state and enforce an atomic uniqueness constraint for the business operation. Use a key that includes the consumer's operation ID and the relevant verified event identity. A receipt ID is useful evidence, but it is not an authorization token or a substitute for the consumer's idempotency key. Repeated webhook deliveries and retries must not repeat an irreversible action.

## Retry and duplicate-delivery policy

Keep pending work keyed by the consumer's operation ID. Retry `indeterminate` only with a bounded schedule and a visible terminal state for manual review; a timeout is never a pass. Do not retry `rejected` as though it were a transient RPC failure without investigating the reason code. Reverify against the trusted identity when fresh evidence is available.

Before the protected side effect, make an atomic state transition that claims the operation and the verified event identity. If that claim already exists, return the previous operation outcome. If the side effect fails after the claim, reconcile its actual state before retrying. This prevents a webhook redelivery or worker restart from turning one verified event into two fulfillments.

## Keep an audit trail

For each decision, retain the request's trusted program ID, discriminator, cluster, transaction signature, EventSeal verdict and reason code, receipt ID when present, and the consumer's own operation ID. Avoid storing secrets or unnecessary personal data in this record. Link the decision to the exact release and configuration used by the consumer so a later investigation can reproduce it.

Before enabling an irreversible action, test a successful event, a failed transaction with plausible logs, an event from the wrong program, an ambiguous or missing event, an RPC outage, and a duplicate delivery. The protected action should occur once only for the intended `verified` case.
