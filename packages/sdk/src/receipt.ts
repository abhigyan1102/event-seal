import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

import type { EventEvidence, SolanaCluster } from "./types.js";

export interface ReceiptIdentity {
  cluster: SolanaCluster;
  signature: string;
  event: EventEvidence;
}

/** Creates a stable, content-addressed ID for idempotent webhook processing. */
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

export function hashEventData(data: Uint8Array): string {
  return bytesToHex(sha256(data));
}
