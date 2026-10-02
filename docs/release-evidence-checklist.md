# Release evidence checklist

This checklist is for an operator preparing a web or backend release. It separates local checks from live proof so a green build is not reported as a deployed verification flow.

## Before deployment

1. Record the intended Git commit, target InsForge project, target web environment, and Solana cluster. Compare the server-only RPC configuration with the selected cluster.
2. Run the repository's required local checks and build from that commit. Review changed public files for secrets, private planning material, and accidental generated artifacts.
3. Confirm the expected program ID and event discriminator come from the approved deployment and matching schema, not from inspection output.
4. Review migration and function changes against the [InsForge deploy runbook](./insforge-deploy-runbook.md). A merge does not apply migrations, deploy functions, or configure credentials.

## After deployment

1. Confirm the web route and function deployments use the intended revision and environment. Check that the internal function credential is configured on both sides without printing its value.
2. Exercise `POST /api/inspect` with a known transaction. Confirm it returns discovery data without a verdict or receipt.
3. Exercise `POST /api/verify` with a known successful event and a known failed transaction. The successful case must have the expected identity and `verified`; the failed transaction must be `rejected` and must not authorize an action.
4. Exercise receipt lookup and any signed-in saved-receipt flow in the target environment. Check owner-only list behavior with a second account when that flow is part of the release.
5. Confirm a direct call to a protected function without the internal credential is rejected. Confirm malformed and oversized public requests do not reach verification.
6. Record the exact evidence, time, environment, and unresolved gates. Do not claim production proof from local mocks, preview data, or a historical devnet run.

If a gate fails, stop promotion or pause the affected consumer action. Use the [incident response checklist](./incident-response.md) for unexpected verification or receipt behavior.
