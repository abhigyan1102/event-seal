import {
  isArcSettlementResult,
  validateArcSettlementRequest,
  type ArcSettlementRequest,
  type ArcSettlementResult,
} from "./arc-settlement";

export const ARC_SETTLEMENT_MAX_REQUEST_BODY_BYTES = 2_048;

type VerifySettlement = (
  request: ArcSettlementRequest,
) => Promise<ArcSettlementResult>;

export function createArcSettlementRoute(verifySettlement: VerifySettlement) {
  return async function POST(request: Request): Promise<Response> {
    const mediaType = (request.headers.get("content-type") ?? "")
      .split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (mediaType !== "application/json") {
      return errorResponse("Content-Type must be application/json", 415);
    }

    const declaredLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > ARC_SETTLEMENT_MAX_REQUEST_BODY_BYTES
    ) {
      return errorResponse("Request body is too large", 413);
    }

    let value: unknown;
    try {
      value = JSON.parse(await readLimitedBody(request)) as unknown;
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return errorResponse("Request body is too large", 413);
      }
      return errorResponse("Request body must be valid JSON", 400);
    }

    const validation = validateArcSettlementRequest(value);
    if (!validation.ok) {
      return errorResponse(validation.error, 400);
    }

    try {
      const result = await verifySettlement(validation.value);
      if (!isArcSettlementResult(result)) {
        throw new Error("Invalid verifier result");
      }
      return Response.json(result, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      return errorResponse("Arc settlement verification failed", 502);
    }
  };
}

class RequestBodyTooLargeError extends Error {}

async function readLimitedBody(request: Request): Promise<string> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      byteLength += value.byteLength;
      if (byteLength > ARC_SETTLEMENT_MAX_REQUEST_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function errorResponse(error: string, status: number): Response {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
