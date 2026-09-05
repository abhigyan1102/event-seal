import {
  createVerificationReceiptId,
  type VerificationResult,
  type VerifyEventInput,
} from "../../packages/sdk/src/index.ts";
import {
  isStoredVerificationReceipt,
  STORED_RECEIPT_COLUMNS,
  type StoredReceiptV2,
} from "./stored-receipt.ts";

interface DatabaseError {
  message: string;
}

interface ReceiptTableClient {
  upsert(
    values: readonly Omit<StoredReceiptV2, "created_at">[],
    options: { onConflict: "receipt_id"; ignoreDuplicates: true },
  ): Promise<{ error: DatabaseError | null }>;
  select(columns: string): {
    eq(
      column: "receipt_id",
      value: string,
    ): {
      maybeSingle(): Promise<{
        data: unknown;
        error: DatabaseError | null;
      }>;
    };
  };
}

export interface ReceiptPersistenceClient {
  database: {
    from(table: "verification_receipts"): ReceiptTableClient;
  };
}

export async function persistVerificationReceipt(
  client: ReceiptPersistenceClient,
  input: VerifyEventInput,
  result: VerificationResult,
): Promise<void> {
  if (!result.receiptId) return;

  const record = buildReceiptRecord(input, result);
  const { error } = await client.database
    .from("verification_receipts")
    .upsert([record], {
      onConflict: "receipt_id",
      ignoreDuplicates: true,
    });
  if (error) throw new Error("Receipt persistence failed");

  const stored = await client.database
    .from("verification_receipts")
    .select(STORED_RECEIPT_COLUMNS)
    .eq("receipt_id", record.receipt_id)
    .maybeSingle();
  if (stored.error || !isStoredVerificationReceipt(stored.data)) {
    throw new Error("Receipt persistence verification failed");
  }
  if (!matchesRecord(stored.data, record)) {
    throw new Error("Receipt persistence integrity check failed");
  }
}

export function buildReceiptRecord(
  input: VerifyEventInput,
  result: VerificationResult,
): Omit<StoredReceiptV2, "created_at"> {
  if (
    !result.receiptId ||
    !result.event ||
    result.signature !== input.signature ||
    result.cluster !== input.cluster ||
    result.expectedProgramId !== input.expectedProgramId ||
    result.commitment !== "finalized"
  ) {
    throw new Error("Receipt result does not match its verification request");
  }

  const expectedReceiptId = createVerificationReceiptId({
    cluster: input.cluster,
    commitment: result.commitment,
    signature: input.signature,
    expectedProgramId: input.expectedProgramId,
    eventFormat: input.event.format,
    eventDiscriminator: input.event.discriminator,
    event: result.event,
  });
  if (result.receiptId !== expectedReceiptId) {
    throw new Error("Receipt ID does not match its verification identity");
  }

  return {
    receipt_version: 2,
    receipt_id: result.receiptId,
    signature: result.signature,
    cluster: result.cluster,
    commitment: result.commitment,
    slot: result.slot ?? null,
    verdict: result.verdict,
    reason_code: result.reasonCode,
    reason: result.reason,
    expected_program_id: input.expectedProgramId,
    event_format: input.event.format,
    event_discriminator: input.event.discriminator,
    emitter_program_id: result.event.emitterProgramId,
    event_position: result.event.eventPosition,
    event_data_hash: result.event.eventDataHash,
    evidence: result.evidence,
  };
}

function matchesRecord(
  stored: StoredReceiptV2 | { receipt_version: 1 },
  expected: Omit<StoredReceiptV2, "created_at">,
): boolean {
  if (stored.receipt_version !== 2) return false;

  return (
    stored.receipt_id === expected.receipt_id &&
    stored.signature === expected.signature &&
    stored.cluster === expected.cluster &&
    stored.commitment === expected.commitment &&
    stored.slot === expected.slot &&
    stored.verdict === expected.verdict &&
    stored.reason_code === expected.reason_code &&
    stored.reason === expected.reason &&
    stored.expected_program_id === expected.expected_program_id &&
    stored.event_format === expected.event_format &&
    stored.event_discriminator === expected.event_discriminator &&
    stored.emitter_program_id === expected.emitter_program_id &&
    stored.event_position === expected.event_position &&
    stored.event_data_hash === expected.event_data_hash &&
    sameEvidence(stored.evidence, expected.evidence)
  );
}

function sameEvidence(
  left: readonly StoredReceiptV2["evidence"][number][],
  right: readonly StoredReceiptV2["evidence"][number][],
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        item.check === other.check &&
        item.passed === other.passed &&
        item.detail === other.detail
      );
    })
  );
}
