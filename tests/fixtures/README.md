# Transaction fixture contract

Verifier integration tests use captured Solana RPC responses instead of depending on a live endpoint. The fixture set covers:

- a finalized successful Anchor log event;
- identical event bytes followed by a deliberate transaction failure;
- matching bytes emitted by the wrong program;
- a versioned transaction;
- incomplete metadata and truncated logs.

Each fixture records its cluster, signature, slot, RPC retrieval date, and expected verdict. Fixtures must be sanitized, deterministic, and contain no provider credentials.

## Regenerate the devnet demo fixture

An authorized operator with a funded devnet fee payer can submit both demo instructions and replace the public fixture without editing source code:

```bash
npm run fixtures:devnet -- --keypair /secure/path/to/devnet-fee-payer.json
```

The default keypair is `~/.config/solana/id.json`. Use `--rpc-url` for a private devnet RPC endpoint, `--output` for an alternate destination, or `--success-nonce` and `--failure-nonce` to override the demo values. Run `npm run fixtures:devnet -- --help` for the complete interface.

The script verifies the endpoint's devnet genesis hash, checks that the demo program is executable, waits for finalized metadata, validates the expected transaction outcomes, and attributes the decoded event payload to the demo program before writing. It writes only public evidence: cluster, program ID, event format and discriminator, nonces, signatures, slots, and expected verdicts. It never writes keypair bytes, keypair paths, RPC URLs, or credentials.

Do not commit fee-payer or program keypairs. The failed transaction is intentionally sent with preflight disabled so its emitted event and failed transaction metadata are recorded on devnet.

## Prove the hosted backend against devnet

After `tests/fixtures/devnet-demo.json` exists and the InsForge functions are deployed, an operator can run the opt-in backend smoke:

```bash
INSFORGE_BASE_URL=https://your-project.region.insforge.app npm run smoke:devnet-backend
```

The command invokes `verify-event` for both devnet fixture transactions, fetches the successful result through `get-receipt`, and fails if the intentionally failed transaction returns a verified verdict or any receipt ID. To record public evidence only, pass `--output tests/fixtures/devnet-backend-proof.json`. The output excludes wallet keypairs, API keys, RPC URLs, and credentials.
