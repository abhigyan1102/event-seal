import { createAdminClient } from "npm:@insforge/sdk";

import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  optionsResponse,
} from "./_shared/http.ts";
import { validateReceiptId } from "./_shared/validation.ts";

const responseHeaders = corsHeaders(["GET", "OPTIONS"]);

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return optionsResponse(responseHeaders);
  if (request.method !== "GET")
    return errorResponse("Method not allowed", 405, responseHeaders);

  const receiptId = validateReceiptId(
    new URL(request.url).searchParams.get("receiptId"),
  );
  if (!receiptId.ok)
    return errorResponse(receiptId.error, 400, responseHeaders);

  const baseUrl = Deno.env.get("INSFORGE_BASE_URL");
  const apiKey = Deno.env.get("INSFORGE_API_KEY");
  if (!baseUrl || !apiKey) {
    return errorResponse(
      "Receipt storage is not configured",
      500,
      responseHeaders,
    );
  }

  try {
    const client = createAdminClient({
      baseUrl,
      apiKey,
    });
    const { data, error } = await client.database
      .from("verification_receipts")
      .select("*")
      .eq("receipt_id", receiptId.value)
      .maybeSingle();

    if (error) {
      globalThis.console.error("EventSeal receipt lookup failed", error);
      return errorResponse("Receipt lookup failed", 500, responseHeaders);
    }
    if (!data) return errorResponse("Receipt not found", 404, responseHeaders);
    return jsonResponse(data, 200, responseHeaders);
  } catch (error) {
    globalThis.console.error("EventSeal receipt lookup failed", error);
    return errorResponse("Receipt lookup failed", 500, responseHeaders);
  }
}
