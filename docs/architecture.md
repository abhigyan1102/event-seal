# EventSeal architecture

EventSeal has one verification core and thin delivery adapters. Direct SDK calls, hosted requests, and webhook deliveries all use the same fail-closed verifier.

## System view

```mermaid
flowchart TB
  subgraph Consumers["Event consumers"]
    Relayer["Relayer or bridge"]
    Indexer["Indexer or data pipeline"]
    Agent["Agent or automation"]
  end

  subgraph Delivery["Delivery layer"]
    Web["Verification web app"]
    VerifyFunction["verify-event function"]
    HeliusFunction["helius-webhook function"]
    ReceiptFunction["get-receipt function"]
  end

  subgraph Core["Verification core"]
    Verifier["verifyEvent"]
    Attribution["Anchor log attribution"]
    Identity["Receipt identity"]
  end

  RPC[("Solana JSON RPC")]
  Database[("InsForge Postgres")]

  Relayer --> VerifyFunction
  Indexer --> VerifyFunction
  Agent --> VerifyFunction
  Web --> VerifyFunction
  HeliusFunction --> Verifier
  VerifyFunction --> Verifier
  Verifier --> RPC
  Verifier --> Attribution
  Attribution --> Identity
  Identity --> Database
  ReceiptFunction --> Database
  Database --> Web
```

## Verification flow

```mermaid
sequenceDiagram
  participant Consumer
  participant Gateway as EventSeal function
  participant Verifier as EventSeal SDK
  participant RPC as Solana RPC
  participant Store as Receipt database

  Consumer->>Gateway: Signature, program ID, event discriminator
  Gateway->>Verifier: verifyEvent request
  Verifier->>RPC: getSignatureStatuses
  Verifier->>RPC: getTransaction at finalized commitment
  RPC-->>Verifier: Status and transaction metadata
  Verifier->>Verifier: Check finality and execution result
  Verifier->>Verifier: Reconstruct invocation frames
  Verifier->>Verifier: Match discriminator and emitter
  alt Event is attributable
    Verifier-->>Gateway: Verdict and deterministic receipt ID
    Gateway->>Store: Upsert receipt by receipt ID
    Gateway-->>Consumer: Verification result
  else Evidence is missing or contradictory
    Verifier-->>Gateway: Rejected or indeterminate result
    Gateway-->>Consumer: Verification result and reason code
  end
```

## Trust boundaries

### Webhook providers

A provider payload is a delivery mechanism, not proof. The Helius adapter extracts transaction signatures and sends every unique signature through the same RPC-backed verification path. Provider-parsed event fields are not accepted as evidence.

### Solana RPC

The verifier relies on the selected RPC endpoint for finalized transaction data. RPC errors, missing transactions, missing metadata, and unavailable logs return `indeterminate`. EventSeal is not a light client and does not independently prove consensus.

### Receipt storage

Receipt IDs are content-addressed from immutable evidence. The database permits public reads but reserves writes for server-side credentials. Repeated deliveries upsert the same primary key.

### Demonstration program

The Anchor program exists only to produce controlled successful and failed event transactions. It is not part of the production verification path.

The exact verification requirements are documented in [verification-invariants.md](./verification-invariants.md).
