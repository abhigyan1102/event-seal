import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

import type { EventEvidence, EventFormat, SolanaCluster } from "./types.js";

export interface ReceiptIdentity {
  cluster: SolanaCluster;
  signature: string;
  event: EventEvidence;
}

export interface VerificationReceiptIdentity extends ReceiptIdentity {
  commitment: "finalized";
  expectedProgramId: string;
  eventFormat: EventFormat;
  eventDiscriminator: string;
}

/**
 * Creates the legacy v1 ID for an observed event.
 *
 * @deprecated New verification receipts must use `createVerificationReceiptId`
 * so the ID also binds the independently trusted event identity.
 */
export function createReceiptId(identity: ReceiptIdentity): string {
  const canonical = [
    "eventseal:v1",
    identity.cluster,
    identity.signature,
    identity.event.eventPosition.toString(10),
    identity.event.emitterProgramId,
    identity.event.eventDataHash,
  ].join(":");

  return `es_${bytesToHex(sha256(new TextEncoder().encode(canonical)))}`;
}

/** Creates a stable v2 ID that binds the trusted request and observed event. */
export function createVerificationReceiptId(
  identity: VerificationReceiptIdentity,
): string {
  const canonical = [
    "eventseal:v2",
    identity.cluster,
    identity.commitment,
    identity.signature,
    identity.expectedProgramId,
    identity.eventFormat,
    identity.eventDiscriminator,
    identity.event.eventPosition.toString(10),
    identity.event.emitterProgramId,
    identity.event.eventDataHash,
  ].join(":");

  return `es_${bytesToHex(sha256(new TextEncoder().encode(canonical)))}`;
}

export function hashEventData(data: Uint8Array): string {
  return bytesToHex(sha256(data));
}
