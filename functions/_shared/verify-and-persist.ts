import { createAdminClient } from "npm:@insforge/sdk";

import {
  verifyEvent,
  type VerificationResult,
  type VerifyEventInput,
} from "../../packages/sdk/src/index.ts";
import {
  persistVerificationReceipt,
  type ReceiptPersistenceClient,
} from "./receipt-persistence.ts";

export async function verifyAndPersist(
  input: VerifyEventInput,
): Promise<VerificationResult> {
  // Hosted handlers resolve cluster-specific configuration before reaching here.
  const result = await verifyEvent(input);

  if (!result.receiptId) return result;

  const baseUrl = Deno.env.get("INSFORGE_BASE_URL");
  const apiKey = Deno.env.get("INSFORGE_API_KEY");
  if (!baseUrl || !apiKey) {
    throw new Error(
      "INSFORGE_BASE_URL and INSFORGE_API_KEY are required to store receipts.",
    );
  }

  const client = createAdminClient({ baseUrl, apiKey });
  await persistVerificationReceipt(
    client as unknown as ReceiptPersistenceClient,
    input,
    result,
  );

  return result;
}
