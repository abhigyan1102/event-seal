export type SolanaCluster = "mainnet-beta" | "devnet" | "testnet";

export type EventFormat = "anchor-log" | "anchor-cpi";

export type VerificationVerdict = "verified" | "rejected" | "indeterminate";

export type VerificationReasonCode =
  | "VERIFIED"
  | "TX_FAILED"
  | "TX_NOT_FOUND"
  | "TX_NOT_FINALIZED"
  | "RPC_UNAVAILABLE"
  | "METADATA_MISSING"
  | "LOGS_UNAVAILABLE"
  | "EVENT_NOT_FOUND"
  | "AMBIGUOUS_EVENT"
  | "PROGRAM_MISMATCH"
  | "DISCRIMINATOR_MISMATCH"
  | "CPI_EVENT_UNSUPPORTED"
  | "INVALID_REQUEST";

export interface VerifyEventInput {
  signature: string;
  cluster: SolanaCluster;
  expectedProgramId: string;
  event: {
    format: EventFormat;
    /** Eight-byte Anchor event discriminator encoded as 16 lowercase hex characters. */
    discriminator: string;
  };
  commitment?: "finalized";
  /** Optional custom endpoint. Useful for private RPC providers and tests. */
  rpcUrl?: string;
}

export interface EventEvidence {
  eventPosition: number;
  emitterProgramId: string;
  eventDataHash: string;
}

export interface VerificationEvidence {
  check: string;
  passed: boolean;
  detail: string;
}

export interface VerificationResult {
  verdict: VerificationVerdict;
  reasonCode: VerificationReasonCode;
  reason: string;
  signature: string;
  cluster: SolanaCluster;
  commitment: "finalized";
  slot?: number;
  expectedProgramId: string;
  receiptId?: string;
  event?: EventEvidence;
  evidence: VerificationEvidence[];
}
