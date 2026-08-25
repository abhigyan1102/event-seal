import type { VerificationResult } from "@eventseal/sdk";

import {
  type BrowserVerifyEventInput,
  validateBrowserVerifyEventInput,
} from "./verification-request";

export const MAX_REQUEST_BODY_BYTES = 4_096;

type InvokeVerification = (
  input: BrowserVerifyEventInput,
) => Promise<VerificationResult>;

type AdapterErrorCode = "NOT_CONFIGURED" | "UPSTREAM_FAILED";

export class VerificationAdapterError extends Error {
  constructor(readonly code: AdapterErrorCode) {
    super(code);
    this.name = "VerificationAdapterError";
  }
}

export function createVerifyRoute(invokeVerification: InvokeVerification) {
  return async function POST(request: Request): Promise<Response> {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return errorResponse("Content-Type must be application/json", 415);
    }

    const declaredLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_REQUEST_BODY_BYTES
    ) {
      return errorResponse("Request body is too large", 413);
    }

    let value: unknown;
    try {
      const body = await request.text();
      if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BODY_BYTES) {
        return errorResponse("Request body is too large", 413);
      }
      value = JSON.parse(body) as unknown;
    } catch {
      return errorResponse("Request body must be valid JSON", 400);
    }

    const validation = validateBrowserVerifyEventInput(value);
    if (!validation.ok) {
      return errorResponse(validation.error, 400);
    }

    try {
      const result = await invokeVerification(validation.value);
      return Response.json(result, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      if (
        error instanceof VerificationAdapterError &&
        error.code === "NOT_CONFIGURED"
      ) {
        return errorResponse("Verification is not configured", 503);
      }
      return errorResponse("Verification failed", 502);
    }
  };
}

function errorResponse(error: string, status: number): Response {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
