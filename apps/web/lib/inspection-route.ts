import type { TransactionInspection } from "@eventseal/sdk";

import {
  type BrowserInspectTransactionInput,
  validateBrowserInspectTransactionInput,
} from "./inspection-request";
import { isTransactionInspection } from "./inspection-result";

export const MAX_INSPECTION_BODY_BYTES = 4_096;

type InvokeInspection = (
  input: BrowserInspectTransactionInput,
) => Promise<TransactionInspection>;

type AdapterErrorCode = "NOT_CONFIGURED" | "UPSTREAM_FAILED";

export class InspectionAdapterError extends Error {
  constructor(readonly code: AdapterErrorCode) {
    super(code);
    this.name = "InspectionAdapterError";
  }
}

export function createInspectionRoute(invokeInspection: InvokeInspection) {
  return async function POST(request: Request): Promise<Response> {
    const mediaType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (mediaType !== "application/json") {
      return errorResponse("Content-Type must be application/json", 415);
    }

    const declaredLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_INSPECTION_BODY_BYTES
    ) {
      void request.body?.cancel().catch(() => undefined);
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

    const validation = validateBrowserInspectTransactionInput(value);
    if (!validation.ok) {
      return errorResponse(validation.error, 400);
    }

    try {
      const result = await invokeInspection(validation.value);
      if (!isTransactionInspection(result)) {
        throw new InspectionAdapterError("UPSTREAM_FAILED");
      }
      return Response.json(result, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      if (
        error instanceof InspectionAdapterError &&
        error.code === "NOT_CONFIGURED"
      ) {
        return errorResponse("Inspection is not configured", 503);
      }
      return errorResponse("Inspection failed", 502);
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
      if (byteLength > MAX_INSPECTION_BODY_BYTES) {
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
