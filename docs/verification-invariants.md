# Verification invariants

EventSeal must never return `verified` unless every required invariant is proven from finalized Solana transaction data.

1. The signature resolves to a complete legacy or v0 transaction.
2. The RPC node reports finalized commitment.
3. Transaction metadata is present and `meta.err === null`.
4. The event is attributed to the expected active program invocation frame.
5. The first eight event bytes equal the expected Anchor discriminator.
6. CPI events are attributed through the correct inner-instruction execution path.
7. Missing, malformed, truncated, or unavailable evidence produces `indeterminate`.
8. Receipt identity is derived from immutable event evidence and is stable across duplicate deliveries.

EventSeal verifies event commitment and attribution. It does not prove that an application event is economically correct or that downstream business logic is safe.
