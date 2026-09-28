# Verification incident response

Use this checklist when EventSeal results, receipts, RPC evidence, or deployment credentials behave unexpectedly. The immediate objective is to prevent an uncertain result from triggering an irreversible consumer action.

## Contain

1. Pause the affected consumer action or route new requests to a pending queue. Keep `rejected` and `indeterminate` outcomes blocked.
2. Record the affected cluster, transaction signatures, expected program IDs and discriminators, verdicts, reason codes, receipt IDs, deployment revision, and incident window. Do not paste API keys, webhook secrets, or user tokens into an issue or chat.
3. Check whether the symptom is limited to one RPC endpoint, one InsForge environment, one web deployment, or one event identity. Do not change trusted identity from an unverified transaction or webhook payload to make a request pass.

## Triage

- **Increase in `indeterminate`:** Check RPC availability, finalized transaction history, metadata, and complete logs. Inspect function logs for timeouts and configuration errors. Keep actions pending until evidence is complete.
- **Unexpected `rejected`:** Compare the trusted cluster, program ID, discriminator, and transaction execution result against the deployment record. A failed transaction remains rejected even if it emitted matching log bytes.
- **Unexpected `verified`:** Stop the affected action and preserve the exact request and response. Reproduce against independent finalized RPC evidence and inspect program invocation attribution. Treat downstream actions as potentially affected until the event identity and consumer rules are reviewed.
- **Receipt mismatch or lookup failure:** Preserve the receipt ID and response, then inspect the stored record and server logs. Do not overwrite an existing receipt to force a match. A receipt is evidence of a verification decision, not proof of downstream fulfillment.
- **Suspected credential exposure:** Disable affected callers or webhook delivery, rotate the exposed credential through the protected secret manager, redeploy the matching configuration, and verify old credentials fail. Follow the [InsForge deploy runbook](./insforge-deploy-runbook.md) for coordinated internal-secret rotation.

## Recover

Re-enable a protected action only after the trusted event identity, finalized RPC evidence, deployed code and configuration, and consumer idempotency state have been checked. Replay queued work through the normal verification path; do not convert previous `indeterminate` results into `verified` without new evidence. Review actions taken during the incident window for duplicates or incorrect fulfillment and record the outcome.

This document is an operator checklist. The [threat model](./threat-model.md) and [verification invariants](./verification-invariants.md) define the verifier's intended security boundary.
