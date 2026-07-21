import { createAdminClient } from "npm:@insforge/sdk";

import {
  verifyEvent,
  type VerificationResult,
  type VerifyEventInput,
} from "../../packages/sdk/src/index.ts";

export async function verifyAndPersist(
  input: VerifyEventInput,
): Promise<VerificationResult> {
  const rpcUrl = input.rpcUrl ?? Deno.env.get("SOLANA_RPC_URL");
  const result = await verifyEvent({ ...input, rpcUrl });

  if (!result.receiptId) return result;

  const baseUrl = Deno.env.get("INSFORGE_BASE_URL");
  const apiKey = Deno.env.get("INSFORGE_API_KEY");
  if (!baseUrl || !apiKey) {
    throw new Error(
      "INSFORGE_BASE_URL and INSFORGE_API_KEY are required to store receipts.",
    );
  }

  const client = createAdminClient({ baseUrl, apiKey });
  const { error } = await client.database.from("verification_receipts").upsert({
    receipt_id: result.receiptId,
    signature: result.signature,
    cluster: result.cluster,
    slot: result.slot,
    verdict: result.verdict,
    reason_code: result.reasonCode,
    emitter_program_id: result.event?.emitterProgramId,
    event_position: result.event?.eventPosition,
    event_data_hash: result.event?.eventDataHash,
    evidence: result.evidence,
  });

  if (error) {
    throw new Error(`Receipt persistence failed: ${error.message}`);
  }

  return result;
}
