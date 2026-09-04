import type { TransactionInspection } from "@eventseal/sdk";

import type { BrowserInspectTransactionInput } from "./inspection-request";
import { isTransactionInspection } from "./inspection-result";

export async function requestInspection(
  input: BrowserInspectTransactionInput,
): Promise<TransactionInspection> {
  const response = await fetch("/api/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(readError(body) ?? "Inspection failed.");
  }
  if (!isTransactionInspection(body)) {
    throw new Error("The inspector returned an invalid response.");
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
