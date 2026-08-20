import type { VerifyEventInput } from "../packages/sdk/src/index.ts";

import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  optionsResponse,
} from "./_shared/http.ts";
import {
  applyServerRpcUrl,
  validateVerifyEventInput,
} from "./_shared/validation.ts";
import { verifyAndPersist } from "./_shared/verify-and-persist.ts";

const responseHeaders = corsHeaders(["POST", "OPTIONS"]);

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return optionsResponse(responseHeaders);
  }
  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405, responseHeaders);
  }

  let input: VerifyEventInput;
  try {
    const body: unknown = await request.json();
    const validation = validateVerifyEventInput(body);
    if (!validation.ok) {
      return errorResponse(validation.error, 400, responseHeaders);
    }
    const serverRpcInput = applyServerRpcUrl(
      validation.value,
      Deno.env.get("SOLANA_RPC_URL"),
    );
    if (!serverRpcInput.ok) {
      globalThis.console.error(
        "EventSeal verification configuration invalid",
        serverRpcInput.error,
      );
      return errorResponse(
        "Verification is not configured",
        500,
        responseHeaders,
      );
    }
    input = serverRpcInput.value;
  } catch {
    return errorResponse(
      "Request body must be valid JSON",
      400,
      responseHeaders,
    );
  }

  try {
    const result = await verifyAndPersist(input);
    return jsonResponse(result, 200, responseHeaders);
  } catch (error) {
    globalThis.console.error("EventSeal verification failed", error);
    return errorResponse("Verification failed", 500, responseHeaders);
  }
}
