import type { VerificationResult } from "@eventseal/sdk";

import type { BrowserVerifyEventInput } from "./verification-request";
import { isVerificationResult } from "./verification-result";

export async function requestVerification(
  input: BrowserVerifyEventInput,
): Promise<VerificationResult> {
  const response = await fetch("/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(readError(body) ?? "Verification failed.");
  }
  if (!isVerificationResult(body)) {
    throw new Error("The verifier returned an invalid response.");
  }
  return body;
}

function readError(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.error !== "string") return undefined;
  return value.error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
