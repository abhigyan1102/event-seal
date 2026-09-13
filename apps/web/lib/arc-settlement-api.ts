import {
  isArcSettlementResult,
  type ArcSettlementRequest,
  type ArcSettlementResult,
} from "./arc-settlement";

export async function requestArcSettlementVerification(
  request: ArcSettlementRequest,
): Promise<ArcSettlementResult> {
  const response = await fetch("/api/arc/verify-settlement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const body = (await response.json().catch(() => undefined)) as unknown;
  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Arc settlement verification failed";
    throw new Error(message);
  }
  if (!isArcSettlementResult(body)) {
    throw new Error("Arc settlement verification returned an invalid response");
  }
  return body;
}
