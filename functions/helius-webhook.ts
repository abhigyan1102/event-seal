import type { VerifyEventInput } from "../packages/sdk/src/index.ts";

import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  optionsResponse,
} from "./_shared/http.ts";
import {
  validateHeliusPayload,
  validateWebhookConfiguration,
} from "./_shared/validation.ts";
import { verifyAndPersist } from "./_shared/verify-and-persist.ts";

const responseHeaders = corsHeaders(
  ["POST", "OPTIONS"],
  ["X-EventSeal-Webhook-Secret"],
);

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return optionsResponse(responseHeaders);
  }
  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405, responseHeaders);
  }

  const webhookSecret = Deno.env.get("EVENTSEAL_WEBHOOK_SECRET");
  if (!webhookSecret || webhookSecret.trim().length === 0) {
    return errorResponse(
      "Webhook authentication is not configured",
      500,
      responseHeaders,
    );
  }
  if (request.headers.get("X-EventSeal-Webhook-Secret") !== webhookSecret) {
    return errorResponse("Unauthorized", 401, responseHeaders);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(
      "Request body must be valid JSON",
      400,
      responseHeaders,
    );
  }
  const payloadValidation = validateHeliusPayload(payload);
  if (!payloadValidation.ok) {
    return errorResponse(payloadValidation.error, 400, responseHeaders);
  }

  try {
    const configuration = readConfiguration();
    const results = await Promise.all(
      payloadValidation.value.map((signature) =>
        verifyAndPersist({ ...configuration, signature }),
      ),
    );

    return jsonResponse(
      { processed: results.length, results },
      200,
      responseHeaders,
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Webhook processing failed",
      500,
      responseHeaders,
    );
  }
}

function readConfiguration(): Omit<VerifyEventInput, "signature"> {
  const configuration = validateWebhookConfiguration({
    EVENTSEAL_CLUSTER: Deno.env.get("EVENTSEAL_CLUSTER"),
    EVENTSEAL_EXPECTED_PROGRAM_ID: Deno.env.get(
      "EVENTSEAL_EXPECTED_PROGRAM_ID",
    ),
    EVENTSEAL_EVENT_FORMAT: Deno.env.get("EVENTSEAL_EVENT_FORMAT"),
    EVENTSEAL_EVENT_DISCRIMINATOR: Deno.env.get(
      "EVENTSEAL_EVENT_DISCRIMINATOR",
    ),
    SOLANA_RPC_URL: Deno.env.get("SOLANA_RPC_URL"),
  });

  if (!configuration.ok) {
    throw new Error(configuration.error);
  }

  return configuration.value;
}
