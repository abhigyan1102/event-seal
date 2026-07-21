# Transaction fixture contract

Verifier integration tests use captured Solana RPC responses instead of depending on a live endpoint. The fixture set covers:

- a finalized successful Anchor log event;
- identical event bytes followed by a deliberate transaction failure;
- matching bytes emitted by the wrong program;
- a versioned transaction;
- incomplete metadata and truncated logs.

Each fixture records its cluster, signature, slot, RPC retrieval date, and expected verdict. Fixtures must be sanitized, deterministic, and contain no provider credentials.
