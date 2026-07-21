# Helius webhook adapter

Configure a Helius enhanced transaction webhook to send deliveries to the deployed `helius-webhook` function. The adapter extracts transaction signatures only; it never trusts provider-parsed events as verification evidence.

Every extracted signature is passed to the same `verifyEvent` flow used by direct SDK consumers. Duplicate deliveries converge on the same deterministic receipt ID.

Configure the function's event identity with `EVENTSEAL_CLUSTER`, `EVENTSEAL_EXPECTED_PROGRAM_ID`, `EVENTSEAL_EVENT_FORMAT`, and `EVENTSEAL_EVENT_DISCRIMINATOR`. Set a random `EVENTSEAL_WEBHOOK_SECRET` and configure Helius to send the same value in the `X-EventSeal-Webhook-Secret` header.
