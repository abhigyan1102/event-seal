import type { VerificationResult } from "@eventseal/sdk";

import {
  type BrowserVerifyEventInput,
  validateBrowserVerifyEventInput,
} from "./verification-request";
import { isVerificationResult } from "./verification-result";

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
      const body = await readLimitedBody(request);
      value = JSON.parse(body) as unknown;
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return errorResponse("Request body is too large", 413);
      }
      return errorResponse("Request body must be valid JSON", 400);
    }

    const validation = validateBrowserVerifyEventInput(value);
    if (!validation.ok) {
      return errorResponse(validation.error, 400);
    }

    try {
      const result = await invokeVerification(validation.value);
      if (!isVerificationResult(result)) {
        throw new VerificationAdapterError("UPSTREAM_FAILED");
      }
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
      if (byteLength > MAX_REQUEST_BODY_BYTES) {
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
