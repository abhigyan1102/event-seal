import type {
  InspectTransactionInput,
  TransactionInspection,
} from "../../packages/sdk/src/index.ts";
import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  optionsResponse,
} from "./http.ts";
import { readRpcEnvironment } from "./rpc-environment.ts";
import {
  applyServerRpcUrl,
  validateInspectTransactionInput,
} from "./validation.ts";

const MAX_BODY_BYTES = 4096;

/** Public, read-only inspection: no database client or receipt persistence dependency. */
export function createInspectTransactionHandler(dependencies: {
  getEnv(name: string): string | undefined;
  inspectTransaction(
    input: InspectTransactionInput,
  ): Promise<TransactionInspection>;
}): (request: Request) => Promise<Response> {
  const headers = {
    ...corsHeaders(["POST", "OPTIONS"]),
    "Cache-Control": "no-store",
  };
  return async (request) => {
    if (request.method === "OPTIONS") return optionsResponse(headers);
    if (request.method !== "POST")
      return errorResponse("Method not allowed", 405, headers);
    if (
      request.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase() !== "application/json"
    )
      return errorResponse(
        "Content-Type must be application/json",
        415,
        headers,
      );
    if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
      void request.body?.cancel().catch(() => {});
      return errorResponse("Request body too large", 413, headers);
    }
    const reader = request.body?.getReader();
    if (!reader)
      return errorResponse("Request body must be valid JSON", 400, headers);
    let body: unknown;
    try {
      let bytes = 0;
      let text = "";
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY_BYTES) {
          void reader.cancel().catch(() => {});
          return errorResponse("Request body too large", 413, headers);
        }
        text += decoder.decode(value, { stream: true });
      }
      body = JSON.parse(text + decoder.decode());
    } catch {
      return errorResponse("Request body must be valid JSON", 400, headers);
    } finally {
      reader.releaseLock();
    }
    const validation = validateInspectTransactionInput(body);
    if (!validation.ok) return errorResponse(validation.error, 400, headers);
    const configured = applyServerRpcUrl(
      validation.value,
      readRpcEnvironment(dependencies.getEnv),
    );
    if (!configured.ok)
      return errorResponse("Inspection is not configured", 500, headers);
    try {
      return jsonResponse(
        await dependencies.inspectTransaction(configured.value),
        200,
        headers,
      );
    } catch {
      return errorResponse("Inspection failed", 502, headers);
    }
  };
}
